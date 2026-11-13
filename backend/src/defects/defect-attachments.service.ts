import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { extname } from 'node:path';
import { DbService } from '../db/db.service';
import { AuthUser } from '../common/auth-user';
import { DefectFileStore } from './defect-file-store';
import { FINAL_STATES } from './defect-workflow';

const MB = 1024*1024;
const configured = Number(process.env.DEFECT_VIDEO_MAX_MB ?? 25);
if (!Number.isInteger(configured) || configured < 1 || configured > 100) throw new Error('DEFECT_VIDEO_MAX_MB must be 1..100');
export const EVIDENCE_POLICY = {maxFiles:5,imageMaxBytes:5*MB,videoMaxBytes:configured*MB,
  mimeTypes:['image/png','image/jpeg','image/webp','application/pdf','video/mp4','video/quicktime']};
export const MAX_EVIDENCE_BYTES = Math.max(EVIDENCE_POLICY.imageMaxBytes,EVIDENCE_POLICY.videoMaxBytes);
const PUBLIC_COLUMNS = 'a.id,a.defect_id,a.original_filename,a.mime_type,a.size_bytes,a.uploaded_by,a.created_at';

@Injectable()
export class DefectAttachmentsService {
  private readonly logger = new Logger(DefectAttachmentsService.name);
  constructor(private readonly db:DbService,private readonly files:DefectFileStore) {}
  private validate(file:Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('업로드할 파일을 선택해 주세요.');
    const b=file.buffer,mime=file.mimetype,extension=extname(file.originalname).toLowerCase();
    const extensions:Record<string,string[]>={'image/png':['.png'],'image/jpeg':['.jpg','.jpeg'],'image/webp':['.webp'],'application/pdf':['.pdf'],'video/mp4':['.mp4'],'video/quicktime':['.mov']};
    const valid = mime==='image/png' ? b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : mime==='image/jpeg' ? b[0]===255&&b[1]===216&&b[2]===255
      : mime==='image/webp' ? b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'
      : mime==='application/pdf' ? b.toString('ascii',0,5)==='%PDF-'
      : ['video/mp4','video/quicktime'].includes(mime) ? b.length>=24&&b.toString('ascii',4,8)==='ftyp'&&b.readUInt32BE(0)>=16&&b.readUInt32BE(0)<=b.length&&
        (mime==='video/quicktime'?b.toString('ascii',8,12)==='qt  ':['isom','iso2','iso4','iso5','iso6','mp41','mp42','avc1','M4V ','MSNV'].includes(b.toString('ascii',8,12))) : false;
    if (!valid || !extensions[mime]?.includes(extension)) throw new BadRequestException('파일 형식과 확장자를 확인해 주세요. PNG, JPG, WEBP, PDF, MP4, MOV만 지원합니다.');
    const limit=mime.startsWith('video/')?EVIDENCE_POLICY.videoMaxBytes:EVIDENCE_POLICY.imageMaxBytes;
    if (b.length>limit) throw new BadRequestException(`이 파일은 ${limit/MB}MB 이하만 업로드할 수 있습니다.`);
    const decoded=Buffer.from(file.originalname,'latin1').toString('utf8');
    const name=(decoded.includes('\uFFFD')?file.originalname:decoded).split(/[\\/]/).pop()!.replace(/[\x00-\x1f\x7f]/g,'').trim();
    if (!name || name.length>255) throw new BadRequestException('파일명은 1~255자로 입력해 주세요.');
    return {name,extension};
  }
  async list(id:string) {
    if (!(await this.db.query('SELECT id FROM defects WHERE id=$1',[id])).rowCount) throw new NotFoundException('이슈를 찾을 수 없습니다.');
    return (await this.db.query(`SELECT ${PUBLIC_COLUMNS},u.name AS uploaded_by_name FROM defect_attachments a JOIN users u ON u.id=a.uploaded_by WHERE a.defect_id=$1 AND a.deleted_at IS NULL ORDER BY a.created_at,a.id`,[id])).rows;
  }
  async upload(id:string,uploadId:string,file:Express.Multer.File,user:AuthUser) {
    const {name,extension}=this.validate(file);let uploadedPath:string|undefined;
    try {
      return await this.db.transaction(async c=>{
        const r=await c.query('SELECT * FROM defects WHERE id=$1 FOR UPDATE',[id]);const issue=r.rows[0];
        if (!issue) throw new NotFoundException('이슈를 찾을 수 없습니다.');
        if (user.role==='USER'&&issue.created_by!==user.id) throw new ForbiddenException('본인이 등록한 이슈에만 증빙을 추가할 수 있습니다.');
        const existing=await c.query(`SELECT ${PUBLIC_COLUMNS},a.deleted_at FROM defect_attachments a WHERE a.id=$1`,[uploadId]);
        if(existing.rowCount){const row=existing.rows[0];if(row.defect_id===id&&row.uploaded_by===user.id&&!row.deleted_at)return row;throw new ConflictException('첨부 요청 번호가 이미 사용됐습니다. 파일을 다시 선택해 주세요.');}
        if (FINAL_STATES.includes(issue.status)) throw new ConflictException('최종 확인된 이슈는 재요청 후 증빙을 추가해 주세요.');
        const count=(await c.query('SELECT count(*)::int n FROM defect_attachments WHERE defect_id=$1 AND deleted_at IS NULL',[id])).rows[0].n;
        if(count>=EVIDENCE_POLICY.maxFiles)throw new BadRequestException('증빙 자료는 최대 5개까지 등록할 수 있습니다.');
        const key=`defects/${id}/${uploadId}${extension}`;
        await this.files.upload(key,file.buffer,file.mimetype);uploadedPath=key;
        const inserted=await c.query(`INSERT INTO defect_attachments(id,defect_id,original_filename,storage_path,mime_type,size_bytes,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,defect_id,original_filename,mime_type,size_bytes,uploaded_by,created_at`,[uploadId,id,name,key,file.mimetype,file.buffer.length,user.id]);
        await c.query("INSERT INTO defect_activities(defect_id,actor_id,event_type,changes) VALUES($1,$2,'ATTACHMENT_ADDED',$3)",[id,user.id,JSON.stringify({attachmentId:uploadId,filename:name,mimeType:file.mimetype,sizeBytes:file.buffer.length})]);
        await c.query('UPDATE defects SET updated_at=now(),updated_by=$2,version=version+1 WHERE id=$1',[id,user.id]);
        return inserted.rows[0];
      });
    } catch(e) {
      if(uploadedPath)try{await this.files.remove(uploadedPath);}catch{this.logger.error(`Evidence compensation failed for ${uploadedPath}; storage cleanup required.`);}
      throw e;
    }
  }
  async remove(id:string,attachmentId:string,user:AuthUser) {
    return this.db.transaction(async c=>{
      const issue=(await c.query('SELECT * FROM defects WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(!issue)throw new NotFoundException('이슈를 찾을 수 없습니다.');
      const row=(await c.query('SELECT * FROM defect_attachments WHERE id=$1 AND defect_id=$2 AND deleted_at IS NULL FOR UPDATE',[attachmentId,id])).rows[0];
      if(!row)throw new NotFoundException('증빙 자료를 찾을 수 없습니다.');
      if(user.role==='USER'&&row.uploaded_by!==user.id)throw new ForbiddenException('본인이 등록한 증빙만 삭제할 수 있습니다.');
      if(FINAL_STATES.includes(issue.status))throw new ConflictException('최종 확인된 이슈는 재요청 후 증빙을 삭제해 주세요.');
      await c.query('UPDATE defect_attachments SET deleted_at=now(),deleted_by=$2 WHERE id=$1',[attachmentId,user.id]);
      await c.query("INSERT INTO defect_activities(defect_id,actor_id,event_type,changes) VALUES($1,$2,'ATTACHMENT_REMOVED',$3)",[id,user.id,JSON.stringify({attachmentId,filename:row.original_filename})]);
      await c.query('UPDATE defects SET updated_at=now(),updated_by=$2,version=version+1 WHERE id=$1',[id,user.id]);
      // Retain the private object for audit; deleted attachments cannot be downloaded through the API.
      return {success:true};
    });
  }
  async file(id:string,attachmentId:string) {
    const row=(await this.db.query('SELECT original_filename,mime_type,storage_path FROM defect_attachments WHERE id=$1 AND defect_id=$2 AND deleted_at IS NULL',[attachmentId,id])).rows[0];
    if(!row)throw new NotFoundException('증빙 자료를 찾을 수 없습니다.');
    return {...row,data:await this.files.download(row.storage_path)};
  }
}
