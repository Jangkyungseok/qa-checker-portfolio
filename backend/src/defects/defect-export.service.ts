import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { DbService } from '../db/db.service';
import { DefectReportService } from './defect-report.service';
import { DefectExportDto } from './dto/defect-export.dto';
import { REPORT_COHORT, reportParams } from './report-filter';

export const EXPORT_LIMITS = { issues: 5000, relatedRows: 20000, textBytes: 10 * 1024 * 1024 };
import { STATES, PRIORITIES, FREQUENCIES } from './issue-labels';
const label = (map: Record<string, string>, key: string) => map[key] ?? '미등록';
const code = (n: unknown) => n == null ? '' : `ISSUE-${String(n).padStart(6, '0')}`;
// Excel has no timezone; store numeric dates representing the displayed Korean wall time.
const date = (v: string | Date | null): Date | null => v ? new Date(new Date(v).getTime() + 9 * 3600000) : null;
const dateText = (v: Date) => v.toISOString().slice(0, 19).replace('T', ' ');
type Cell = string | number | Date | null;
type Row = Record<string, any>;
export const ISSUE_COLUMNS = ['이슈 번호','상태','우선순위','발생 빈도','빌드 버전','발생 단말 / OS','제목','재현 절차','이슈 내용','수정 방향','연계 이슈','등록자','등록일','최종 수정일'];
const issueRow = (d: Row): Cell[] => [code(d.defect_no),label(STATES,d.status),label(PRIORITIES,d.priority),label(FREQUENCIES,d.reproducibility),d.build_version ?? '',d.device_os,d.title,d.steps_to_reproduce,d.description,d.fix_direction ?? '',code(d.related_no),d.author,date(d.created_at),date(d.updated_at)];
export function csvCell(value: Cell) {
  let text = value instanceof Date ? dateText(value) : String(value ?? '');
  // Quoting alone does not stop spreadsheet formula injection.
  if (/^[\s\uFEFF]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

@Injectable()
export class DefectExportService {
  private busy = false;
  constructor(private readonly db: DbService, private readonly reports: DefectReportService) {}

  async export(dto: DefectExportDto) {
    if (this.busy) throw new ServiceUnavailableException('다른 내보내기가 진행 중입니다. 잠시 후 다시 시도해 주세요.');
    this.busy = true;
    try {
      const data = await this.db.transaction(async client => {
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        await client.query("SET LOCAL statement_timeout = '15s'");
        const params = reportParams(dto);
        const issuesSql = `SELECT d.id,d.defect_no,d.status,d.priority,d.reproducibility,d.build_version,d.device_os,
          d.title,d.steps_to_reproduce,d.description,d.fix_direction,d.created_at,d.updated_at,
          u.name AS author,r.defect_no AS related_no FROM defects d
          JOIN users u ON u.id=d.created_by LEFT JOIN defects r ON r.id=d.related_defect_id WHERE ${REPORT_COHORT}`;
        const eventsSql = `SELECT d.defect_no,a.defect_id,a.changes->>'from' AS previous,a.changes->>'to' AS next,
          u.name AS actor,a.created_at,a.id FROM defect_activities a JOIN defects d ON d.id=a.defect_id
          JOIN users u ON u.id=a.actor_id WHERE ${REPORT_COHORT} AND a.event_type='STATUS_CHANGED' AND a.created_at<=now()`;
        const commentsSql = `SELECT d.defect_no,u.name AS author,c.created_at,c.updated_at,
          CASE WHEN c.deleted_at IS NULL THEN c.body ELSE '삭제된 코멘트입니다.' END AS body,c.id
          FROM defect_comments c JOIN defects d ON d.id=c.defect_id JOIN users u ON u.id=c.author_id
          WHERE ${REPORT_COHORT} AND c.created_at<=now()`;
        const attachmentsSql = `SELECT d.defect_no,a.original_filename,a.mime_type,a.size_bytes,u.name AS author,
          a.created_at,a.deleted_at,a.id FROM defect_attachments a JOIN defects d ON d.id=a.defect_id
          JOIN users u ON u.id=a.uploaded_by WHERE ${REPORT_COHORT} AND a.created_at<=now()`;
        // Count and measure before fetching text into Node. CSV does not load ancillary data.
        const queries = dto.format === 'csv' ? [issuesSql] : [issuesSql,eventsSql,commentsSql,attachmentsSql];
        let bytes = 0, related = 0;
        for (let i=0;i<queries.length;i++) {
          const size = (await client.query(`SELECT count(*)::int AS n,coalesce(sum(octet_length(row_to_json(q)::text)),0) AS bytes FROM (${queries[i]}) q`,params)).rows[0];
          bytes += Number(size.bytes); if (i) related += size.n;
          if ((!i && size.n > EXPORT_LIMITS.issues) || related > EXPORT_LIMITS.relatedRows || bytes > EXPORT_LIMITS.textBytes)
            throw new BadRequestException('내보내기 한도를 초과했습니다 (이슈 5,000건, 연관 이력 20,000건, 데이터 10MB). 기간 또는 빌드 조건을 좁혀 주세요.');
        }
        const report = await this.reports.get(dto,client);
        const issues = (await client.query(issuesSql+' ORDER BY d.defect_no',params)).rows;
        const events = dto.format === 'xlsx' ? (await client.query(eventsSql+' ORDER BY a.created_at,a.id',params)).rows : [];
        const comments = dto.format === 'xlsx' ? (await client.query(commentsSql+' ORDER BY c.created_at,c.id',params)).rows : [];
        const attachments = dto.format === 'xlsx' ? (await client.query(attachmentsSql+' ORDER BY a.created_at,a.id',params)).rows : [];
        return {report,issues,events,comments,attachments};
      });
      const {report,issues,events,comments,attachments} = data;
      const safeName = report.project.name.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,'').replace(/[. ]+$/g,'').slice(0,60) || '프로젝트';
      const filename = `QA_Checker_Issue_Report_${safeName}_${date(report.generatedAt)!.toISOString().slice(0,10).replace(/-/g,'')}.${dto.format}`;
      if (dto.format === 'csv') return {filename, mime:'text/csv; charset=utf-8', buffer:Buffer.from('\uFEFF'+[ISSUE_COLUMNS,...issues.map(issueRow)].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n','utf8')};
      const book = new Workbook(); book.creator = 'QA Checker';
      const sheet = (name:string,headers:string[],rows:Cell[][]) => {
        const s=book.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]});
        s.addRow(headers); rows.forEach(row=>s.addRow(row));
        s.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,s.rowCount),column:headers.length}};
        s.columns.forEach((col,i)=>{col.width=/내용|절차|방향|코멘트|제목/.test(headers[i])?48:/일시|등록일|수정일/.test(headers[i])?23:20;});
        s.eachRow(row=>row.eachCell(cell=>{
          cell.alignment={vertical:'top',wrapText:true};
          cell.font={name:'맑은 고딕',size:11};
          if(cell.value instanceof Date)cell.numFmt='yyyy-mm-dd hh:mm:ss';
          if(typeof cell.value==='number')cell.numFmt='#,##0';
        }));
        s.getRow(1).font={name:'맑은 고딕',size:11,bold:true};
        s.getRow(1).height=30;
        return s;
      };
      const overview:Cell[][]=[['프로젝트명',report.project.name],['조회 기간',dto.period==='ALL'?'전체':`최근 ${dto.period}일 (오늘 포함)`],['등록 시작 (한국시간)',date(report.filters.from)],['빌드 버전',dto.buildVersion??'전체 빌드'],['조회 기준일시 (한국시간)',date(report.generatedAt)],
        ['전체 이슈',report.totals.total],['미처리',report.totals.pending],['대응 중',report.totals.inProgress],['대응 완료',report.totals.responded],['수정 확인',report.totals.verified],['SKIP',report.totals.skip],['처리율',report.completion.rate/100],
        ...Object.entries(report.byStatus).map(([k,v])=>['상태 · '+label(STATES,k),v as number]),
        ['현재 재요청',report.rerequest.current],['재요청 발생 이슈',report.rerequest.affectedIssues],['총 재요청 횟수',report.rerequest.totalTransitions],['SKIP 요청',report.skip.requested],['SKIP 확인',report.skip.confirmed],['SKIP 비율',report.skip.rate/100]];
      const summary=sheet('이슈 현황',['항목','값'],overview);summary.getColumn(1).width=30;summary.getColumn(2).width=45;
      overview.forEach((row,i)=>{if(['처리율','SKIP 비율'].includes(String(row[0])))summary.getCell(i+2,2).numFmt='0.0%';});
      sheet('전체 이슈',ISSUE_COLUMNS,issues.map(issueRow));
      sheet('잔여 이슈',ISSUE_COLUMNS,issues.filter(d=>!['VERIFIED','SKIP_CONFIRMED'].includes(d.status)).map(issueRow));
      const repeated=new Map<string,Row[]>();
      for(const event of events)if(event.next==='RE_REQUESTED'){const list=repeated.get(event.defect_id)??[];list.push(event);repeated.set(event.defect_id,list);}
      sheet('재요청 이슈',['이슈 번호','현재 상태','우선순위','제목','현재 재요청 여부','총 재요청 횟수','최초 재요청 일시','최근 재요청 일시','빌드 버전','발생 단말 / OS'],issues.filter(d=>d.status==='RE_REQUESTED'||repeated.has(d.id)).map(d=>{
        const list=repeated.get(d.id)??[];return [code(d.defect_no),label(STATES,d.status),label(PRIORITIES,d.priority),d.title,d.status==='RE_REQUESTED'?'예':'아니오',list.length,date(list[0]?.created_at),date(list.at(-1)?.created_at),d.build_version??'',d.device_os];
      }));
      sheet('상태 변경 이력',['이슈 번호','변경 전 상태','변경 후 상태','변경자','변경 일시'],events.map(e=>[code(e.defect_no),label(STATES,e.previous),label(STATES,e.next),e.actor,date(e.created_at)]));
      sheet('코멘트',['이슈 번호','작성자','작성 일시','수정 일시','코멘트'],comments.map(c=>[code(c.defect_no),c.author,date(c.created_at),date(c.updated_at),c.body]));
      sheet('증빙 자료',['이슈 번호','파일명','MIME','파일 크기 (bytes)','등록자','등록일','삭제 여부'],attachments.map(a=>[code(a.defect_no),a.original_filename,a.mime_type,Number(a.size_bytes),a.author,date(a.created_at),a.deleted_at?'삭제':'유지']));
      return {filename,mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await book.xlsx.writeBuffer())};
    } catch (error) {
      if ((error as {code?:string}).code==='57014') throw new ServiceUnavailableException('내보내기 조회 시간이 초과되었습니다. 조건을 좁혀 다시 시도해 주세요.');
      throw error;
    } finally { this.busy=false; }
  }
}
