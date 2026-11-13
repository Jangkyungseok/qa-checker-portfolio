import { allowedTransitions, FINAL_STATES, TRANSITIONS } from './defect-workflow';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AuthUser } from '../common/auth-user';
import { DbService } from '../db/db.service';
import { CreateDefectDto, UpdateDefectDto, ListDefectsDto, DefectStatusDto } from './dto/defect.dto';
const SELECT = `SELECT d.*, 'BUG-' || lpad(d.defect_no::text,greatest(6,length(d.defect_no::text)),'0') AS defect_code,
  creator.name AS created_by_name, updater.name AS updated_by_name,
  related.project_id AS related_project_id, related.title AS related_issue_title,
  CASE WHEN related.id IS NOT NULL THEN 'BUG-' || lpad(related.defect_no::text,greatest(6,length(related.defect_no::text)),'0') END AS related_issue_code
  FROM defects d JOIN users creator ON creator.id=d.created_by JOIN users updater ON updater.id=d.updated_by
  LEFT JOIN defects related ON related.id=d.related_defect_id`;
@Injectable()
export class DefectsService {
  constructor(private readonly db:DbService) {}
  async list(dto:ListDefectsDto,user:AuthUser) {
    const values=[dto.projectId,dto.search?'%'+dto.search.replace(/^ISSUE-/i,'BUG-').replace(/[\\%_]/g,'\\$&')+'%':null,dto.status??null,dto.priority??null,dto.reproducibility??null];
    const where=`WHERE d.project_id=$1 AND ($2::text IS NULL OR d.title ILIKE $2 OR ('BUG-' || lpad(d.defect_no::text,greatest(6,length(d.defect_no::text)),'0')) ILIKE $2)
      AND ($3::text IS NULL OR d.status=$3) AND ($4::text IS NULL OR d.priority=$4) AND ($5::text IS NULL OR d.reproducibility=$5)`;
    const rows=await this.db.query(`${SELECT} ${where} ORDER BY d.updated_at DESC,d.id LIMIT $6 OFFSET $7`,[...values,dto.pageSize,(dto.page-1)*dto.pageSize]);
    const total=await this.db.query(`SELECT count(*)::int AS total FROM defects d ${where}`,values);
    return {items:rows.rows.map(r=>({...r,allowed_transitions:allowedTransitions(r,user)})),total:total.rows[0].total,page:dto.page,pageSize:dto.pageSize};
  }
  async get(id:string,user?:AuthUser) {
    const r=await this.db.query(`${SELECT} WHERE d.id=$1`,[id]);if(!r.rowCount)throw new NotFoundException('이슈를 찾을 수 없습니다.');
    return {...r.rows[0],allowed_transitions:user?allowedTransitions(r.rows[0],user):[]};
  }
  private async related(client:PoolClient,code:string|null|undefined,id?:string) {
    if(code===undefined)return undefined;if(code===null)return null;
    const r=await client.query('SELECT id FROM defects WHERE defect_no=$1::bigint FOR KEY SHARE',[code.replace(/^(BUG|ISSUE)-/,'')]);
    if(!r.rowCount)throw new BadRequestException('연계 이슈 번호가 존재하지 않습니다.');
    if(r.rows[0].id===id)throw new BadRequestException('자기 자신은 연계할 수 없습니다.');return r.rows[0].id as string;
  }
  private async activity(client:PoolClient,id:string,actor:string,event:string,changes:object={},commentId:string|null=null) {
    await client.query('INSERT INTO defect_activities(defect_id,actor_id,event_type,changes,comment_id) VALUES($1,$2,$3,$4,$5)',[id,actor,event,JSON.stringify(changes),commentId]);
  }
  async create(dto:CreateDefectDto,user:AuthUser) {
    const id=await this.db.transaction(async c=>{
      if(!(await c.query('SELECT id FROM projects WHERE id=$1 FOR SHARE',[dto.projectId])).rowCount)throw new NotFoundException('프로젝트를 찾을 수 없습니다.');
      const related=await this.related(c,dto.relatedIssueCode);
      const r=await c.query(`INSERT INTO defects(project_id,title,description,steps_to_reproduce,fix_direction,reproducibility,priority,build_version,device_os,related_defect_id,created_by,updated_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING id`,[dto.projectId,dto.title,dto.description,dto.stepsToReproduce,dto.fixDirection,dto.reproducibility,dto.priority,dto.buildVersion,dto.deviceOs,related??null,user.id]);
      await this.activity(c,r.rows[0].id,user.id,'CREATED',{status:'NEW',priority:dto.priority,reproducibility:dto.reproducibility,build_version:dto.buildVersion,device_os:dto.deviceOs});return r.rows[0].id;
    });return this.get(id,user);
  }
  private async locked(c:PoolClient,id:string) {
    const r=await c.query('SELECT * FROM defects WHERE id=$1 FOR UPDATE',[id]);if(!r.rowCount)throw new NotFoundException('이슈를 찾을 수 없습니다.');return r.rows[0];
  }
  private checkVersion(row:any,version:number) {if(row.version!==version)throw new ConflictException('다른 사용자가 변경했습니다. 새로고침 후 다시 시도해 주세요.');}
  async update(id:string,dto:UpdateDefectDto,user:AuthUser) {
    await this.db.transaction(async c=>{
      const row=await this.locked(c,id);this.checkVersion(row,dto.version);
      if(user.role==='USER'&&row.created_by!==user.id)throw new ForbiddenException('본인이 등록한 이슈만 수정할 수 있습니다.');
      if(FINAL_STATES.includes(row.status))throw new ConflictException('확인된 이슈는 재오픈 후 수정해 주세요.');
      const related=await this.related(c,dto.relatedIssueCode,id);
      const input:Record<string,unknown>={...dto,relatedDefectId:related};
      const fields:Record<string,string>={title:'title',description:'description',stepsToReproduce:'steps_to_reproduce',fixDirection:'fix_direction',reproducibility:'reproducibility',priority:'priority',buildVersion:'build_version',deviceOs:'device_os',relatedDefectId:'related_defect_id'};
      const updates:string[]=[],values:unknown[]=[id,user.id],content:Record<string,unknown>={};
      for(const [key,column] of Object.entries(fields)){
        const value=input[key];if(value===undefined||value===row[column])continue;
        values.push(value);updates.push(column+'=$'+values.length);const change={from:row[column],to:value};
        if(key==='priority')await this.activity(c,id,user.id,'PRIORITY_CHANGED',change);else content[column]=change;
      }
      if(!updates.length)return;
      await c.query(`UPDATE defects SET ${updates.join(',')},updated_by=$2,updated_at=now(),version=version+1 WHERE id=$1`,values);
      if(Object.keys(content).length)await this.activity(c,id,user.id,'CONTENT_UPDATED',content);
    });return this.get(id,user);
  }
  async status(id:string,dto:DefectStatusDto,user:AuthUser) {
    await this.db.transaction(async c=>{
      const row=await this.locked(c,id);this.checkVersion(row,dto.version);
      if(!(TRANSITIONS[row.status]??[]).includes(dto.status))throw new BadRequestException('허용되지 않은 상태 변경입니다.');
      if(!allowedTransitions(row,user).includes(dto.status))throw new ForbiddenException('최종 확인과 재오픈은 LEADER/ADMIN만 가능합니다.');
      await c.query(`UPDATE defects SET status=$2::varchar,closed_by=$3,closed_at=CASE WHEN $3::uuid IS NOT NULL THEN now() ELSE NULL END,
        updated_by=$4,updated_at=now(),version=version+1 WHERE id=$1`,[id,dto.status,FINAL_STATES.includes(dto.status)?user.id:null,user.id]);
      await this.activity(c,id,user.id,'STATUS_CHANGED',{from:row.status,to:dto.status,action:FINAL_STATES.includes(row.status)?'REOPENED':undefined});
    });return this.get(id,user);
  }
  async comments(id: string) {
    await this.get(id);
    return (await this.db.query(`SELECT c.id,c.defect_id,c.author_id,u.name AS author_name,c.created_at,c.updated_at,c.version,c.deleted_at,
      CASE WHEN c.deleted_at IS NULL THEN c.body ELSE NULL END AS body FROM defect_comments c
      JOIN users u ON u.id=c.author_id WHERE c.defect_id=$1 ORDER BY c.created_at,c.id`,[id])).rows;
  }
  async addComment(id: string, body: string, user: AuthUser) {
    return this.db.transaction(async client => {
      await this.locked(client,id);
      const result = await client.query('INSERT INTO defect_comments(defect_id,author_id,body) VALUES($1,$2,$3) RETURNING id',[id,user.id,body]);
      await this.activity(client,id,user.id,'COMMENT_CREATED',{},result.rows[0].id);
      return result.rows[0];
    });
  }
  async changeComment(id: string, commentId: string, user: AuthUser, update?: {body: string;version: number}) {
    return this.db.transaction(async client => {
      await this.locked(client,id);
      const result = await client.query('SELECT * FROM defect_comments WHERE id=$1 AND defect_id=$2 FOR UPDATE',[commentId,id]);
      const row = result.rows[0];
      if (!row) throw new NotFoundException('코멘트를 찾을 수 없습니다.');
      if (update ? row.author_id !== user.id : row.author_id !== user.id && user.role === 'USER')
        throw new ForbiddenException('코멘트 변경 권한이 없습니다.');
      if (row.deleted_at) throw new ConflictException('이미 삭제된 코멘트입니다.');
      if (update) this.checkVersion(row,update.version);
      await client.query(update
        ? 'UPDATE defect_comments SET body=$2,updated_at=now(),version=version+1 WHERE id=$1'
        : 'UPDATE defect_comments SET deleted_at=now(),deleted_by=$2,updated_at=now(),version=version+1 WHERE id=$1',
        [commentId,update ? update.body : user.id]);
      await this.activity(client,id,user.id,update ? 'COMMENT_UPDATED' : 'COMMENT_DELETED',{},commentId);
      return { success:true };
    });
  }
  async activities(id: string) {
    await this.get(id);
    return (await this.db.query(`SELECT a.*,u.name AS actor_name FROM defect_activities a JOIN users u ON u.id=a.actor_id
      WHERE a.defect_id=$1 ORDER BY a.created_at,a.id`,[id])).rows;
  }
}
