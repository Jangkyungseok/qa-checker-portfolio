import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { AuthUser } from '../common/auth-user';
import { DefectReportService } from '../defects/defect-report.service';
import { DefectReportDto } from '../defects/dto/defect-report.dto';
import { datedCohort } from '../defects/report-filter';
import { QaCandidatesDto, QaReportDto, UpdateQaReportDto, PURPOSES } from './qa-report.dto';

const columns = `r.*,to_char(r.test_start_date,'YYYY-MM-DD') AS test_start_date,to_char(r.test_end_date,'YYYY-MM-DD') AS test_end_date,p.name AS project_name,u.name AS author_name`;
export const issueCode = (n: unknown) => `ISSUE-${String(n).padStart(6,'0')}`;

@Injectable()
export class QaReportsService {
  constructor(private readonly db: DbService,private readonly reports: DefectReportService) {}
  private async project(id:string,c?:PoolClient) {
    if(!(await (c ? c.query('SELECT id FROM projects WHERE id=$1',[id]) : this.db.query('SELECT id FROM projects WHERE id=$1',[id]))).rowCount)throw new NotFoundException('프로젝트를 찾을 수 없습니다.');
  }
  async list(projectId:string) {
    await this.project(projectId);
    return (await this.db.query(`SELECT r.id,r.title,r.target_build,r.updated_at,r.version,to_char(r.test_start_date,'YYYY-MM-DD') AS test_start_date,to_char(r.test_end_date,'YYYY-MM-DD') AS test_end_date,u.name AS author_name FROM qa_reports r JOIN users u ON u.id=r.created_by WHERE r.project_id=$1 ORDER BY r.updated_at DESC,r.id`,[projectId])).rows;
  }
  async get(projectId:string,id:string,c?:PoolClient) {
    const sql=`SELECT ${columns} FROM qa_reports r JOIN projects p ON p.id=r.project_id JOIN users u ON u.id=r.created_by WHERE r.id=$1 AND r.project_id=$2`;
    const result=c?await c.query(sql,[id,projectId]):await this.db.query(sql,[id,projectId]);
    if(!result.rowCount)throw new NotFoundException('리포트를 찾을 수 없습니다.');
    const linksSql=`SELECT l.*,d.title,d.defect_no,d.status,d.priority,d.reproducibility,d.build_version FROM qa_report_issue_links l JOIN defects d ON d.id=l.defect_id WHERE l.report_id=$1 ORDER BY l.purpose,l.sort_order`;
    const links=c?await c.query(linksSql,[id]):await this.db.query(linksSql,[id]);
    return {...result.rows[0],links:links.rows.map(x=>({...x,issue_code:issueCode(x.defect_no)}))};
  }
  private validate(dto:QaReportDto) {
    const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&v>='1900-01-01'&&v<='2100-12-31'&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
    for(const v of [dto.testStartDate,dto.testEndDate])if(v&&!validDate(v))throw new BadRequestException('테스트 날짜를 확인해 주세요.');
    if(dto.testStartDate&&dto.testEndDate&&dto.testStartDate>dto.testEndDate)throw new BadRequestException('종료일은 시작일 이후여야 합니다.');
    if(Object.entries(dto.considerations).some(([k,v])=>!PURPOSES.slice(1).includes(k as any)||typeof v!=='string'||v.length>2000))throw new BadRequestException('대응 고려사항은 분류별 2,000자 이내로 입력해 주세요.');
    for(const purpose of PURPOSES){const group=dto.links.filter(x=>x.purpose===purpose);if(group.length>(purpose==='FEATURED'?5:100)||new Set(group.map(x=>x.defectId)).size!==group.length)throw new BadRequestException('대표 이슈는 중복 없이 최대 5개, 고려사항은 분류별 최대 100개입니다.');}
    if(dto.links.length&&(!dto.testStartDate||!dto.testEndDate))throw new BadRequestException('이슈 선택 전에 테스트 기간을 입력해 주세요.');
  }
  private async validateLinks(c:PoolClient,projectId:string,dto:QaReportDto) {
    for(const link of dto.links){
      const r=await c.query(`SELECT d.id FROM defects d WHERE ${datedCohort(4,5)} AND d.id=$6 FOR SHARE`,[projectId,null,dto.filterBuildVersion||null,dto.testStartDate,dto.testEndDate,link.defectId]);
      if(!r.rowCount)throw new BadRequestException('연결 이슈가 현재 프로젝트·기간·빌드 조건에 맞지 않습니다. 선택을 다시 확인해 주세요.');
      if(link.attachmentId){
        if(link.purpose!=='FEATURED')throw new BadRequestException('대표 이슈에만 이미지를 지정할 수 있습니다.');
        const a=await c.query("SELECT id FROM defect_attachments WHERE id=$1 AND defect_id=$2 AND deleted_at IS NULL AND mime_type IN ('image/png','image/jpeg','image/webp') FOR SHARE",[link.attachmentId,link.defectId]);
        if(!a.rowCount)throw new BadRequestException('해당 이슈의 활성 이미지 증빙을 선택해 주세요.');
      }
    }
  }
  async save(projectId:string,dto:QaReportDto,user:AuthUser,id?:string) {
    this.validate(dto);
    return this.db.transaction(async c=>{
      await this.project(projectId,c);
      if(id){const row=(await c.query('SELECT version FROM qa_reports WHERE id=$1 AND project_id=$2 FOR UPDATE',[id,projectId])).rows[0];if(!row)throw new NotFoundException('리포트를 찾을 수 없습니다.');if(row.version!==(dto as UpdateQaReportDto).version)throw new ConflictException('다른 곳에서 리포트가 수정되었습니다. 새로고침 후 다시 확인해 주세요.');}
      await this.validateLinks(c,projectId,dto);
      const values=[dto.title,dto.targetBuild,dto.filterBuildVersion||null,dto.testStartDate||null,dto.testEndDate||null,dto.testScope,dto.testEnvironment,dto.testMethod,JSON.stringify(dto.considerations),dto.leadOpinion,user.id];
      if(id)await c.query(`UPDATE qa_reports SET title=$1,target_build=$2,filter_build_version=$3,test_start_date=$4,test_end_date=$5,test_scope=$6,test_environment=$7,test_method=$8,considerations=$9,lead_opinion=$10,updated_by=$11,updated_at=now(),version=version+1 WHERE id=$12`,[...values,id]);
      else id=(await c.query(`INSERT INTO qa_reports(title,target_build,filter_build_version,test_start_date,test_end_date,test_scope,test_environment,test_method,considerations,lead_opinion,created_by,updated_by,project_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12) RETURNING id`,[...values,projectId])).rows[0].id;
      await c.query('DELETE FROM qa_report_issue_links WHERE report_id=$1',[id]);
      const orders:Record<string,number>={};
      for(const link of dto.links){const order=orders[link.purpose]??0;orders[link.purpose]=order+1;await c.query('INSERT INTO qa_report_issue_links(report_id,defect_id,purpose,sort_order,attachment_id) VALUES($1,$2,$3,$4,$5)',[id,link.defectId,link.purpose,order,link.attachmentId??null]);}
      return this.get(projectId,id!,c);
    });
  }
  async candidates(projectId:string,id:string,dto:QaCandidatesDto) {
    return this.db.transaction(async c=>{
      await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const r=await this.get(projectId,id,c);
      const builds=(await c.query(`SELECT version FROM (SELECT version FROM build_histories WHERE project_id=$1 UNION SELECT build_version AS version FROM defects WHERE project_id=$1) v WHERE version IS NOT NULL AND btrim(version)<>'' ORDER BY version`,[projectId])).rows.map(x=>x.version);
      if(!r.test_start_date||!r.test_end_date)return {items:[],total:0,page:dto.page,builds,summary:null};
      const params=[projectId,null,r.filter_build_version,r.test_start_date,r.test_end_date,`%${(dto.search??'').replace(/[\\%_]/g,'\\$&')}%`];
      const where=`${datedCohort(4,5)} AND (d.title ILIKE $6 OR ('ISSUE-'||lpad(d.defect_no::text,greatest(6,length(d.defect_no::text)),'0')) ILIKE $6)`;
      const total=(await c.query(`SELECT count(*)::int n FROM defects d WHERE ${where}`,params)).rows[0].n;
      const items=(await c.query(`SELECT d.id,d.defect_no,d.title,d.status,d.priority,d.reproducibility,d.build_version,
        coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'name',a.original_filename) ORDER BY a.created_at,a.id) FROM defect_attachments a WHERE a.defect_id=d.id AND a.deleted_at IS NULL AND a.mime_type IN ('image/png','image/jpeg','image/webp')),'[]'::jsonb) images
        FROM defects d WHERE ${where} ORDER BY d.defect_no DESC LIMIT 30 OFFSET $7`,[...params,(dto.page-1)*30])).rows.map(x=>({...x,issue_code:issueCode(x.defect_no)}));
      return {items,total,page:dto.page,builds,summary:await this.summary(r,c)};
    });
  }
  private summary(r:any,c:PoolClient) {
    return this.reports.get(Object.assign(new DefectReportDto(),{projectId:r.project_id,buildVersion:r.filter_build_version??undefined}),c,{startDate:r.test_start_date,endDate:r.test_end_date});
  }
  async pdfData(projectId:string,id:string,version:number) {
    return this.db.transaction(async c=>{
      await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await c.query("SET LOCAL statement_timeout='15s'");
      const report=await this.get(projectId,id,c);
      if(report.version!==version)throw new ConflictException('다른 곳에서 리포트가 수정되었습니다. 새로고침 후 다시 확인해 주세요.');
      for(const key of ['title','target_build','test_start_date','test_end_date','test_scope','test_environment','test_method','lead_opinion'])if(!report[key]?.trim())throw new BadRequestException('PDF 생성에 필요한 기본 정보, 테스트 정보, QA 리드 최종 의견을 모두 입력해 주세요.');
      const dto=Object.assign(new QaReportDto(),{testStartDate:report.test_start_date,testEndDate:report.test_end_date,filterBuildVersion:report.filter_build_version,links:report.links.map((x:any)=>({defectId:x.defect_id,purpose:x.purpose,attachmentId:x.attachment_id}))});
      // Recheck after draft save: an issue/build or attachment may have changed.
      for(const link of dto.links){if(!(await c.query(`SELECT id FROM defects d WHERE ${datedCohort(4,5)} AND d.id=$6`,[projectId,null,dto.filterBuildVersion,report.test_start_date,report.test_end_date,link.defectId])).rowCount)throw new ConflictException('연결 이슈가 집계 조건에서 벗어났습니다. 리포트를 수정해 주세요.');}
      const featured=[];
      for(const link of report.links.filter((x:any)=>x.purpose==='FEATURED')){
        const issue=(await c.query('SELECT id,defect_no,title,priority,reproducibility,device_os,description,steps_to_reproduce FROM defects WHERE id=$1',[link.defect_id])).rows[0];
        const images=(await c.query("SELECT id,mime_type FROM defect_attachments WHERE defect_id=$1 AND deleted_at IS NULL AND mime_type IN ('image/png','image/jpeg','image/webp') ORDER BY created_at,id",[link.defect_id])).rows;
        const image=link.attachment_id?images.find(x=>x.id===link.attachment_id):images[0];
        if(link.attachment_id&&!image)throw new ConflictException('선택한 증빙 이미지가 삭제되었습니다. 이미지를 다시 선택해 주세요.');
        const video=!!(await c.query("SELECT id FROM defect_attachments WHERE defect_id=$1 AND deleted_at IS NULL AND mime_type IN ('video/mp4','video/quicktime') LIMIT 1",[link.defect_id])).rowCount;
        featured.push({...issue,issue_code:issueCode(issue.defect_no),image,video});
      }
      return {report,summary:await this.summary(report,c),featured};
    });
  }
}
