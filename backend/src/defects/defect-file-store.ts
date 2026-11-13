import { Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { SupabaseStorageService } from '../storage/supabase-storage.service';

// Explicit local development adapter; production continues to use the existing Supabase service.
@Injectable()
export class DefectFileStore {
  private readonly localDir = process.env.DEFECT_ATTACHMENTS_LOCAL_DIR;
  constructor(private readonly remote: SupabaseStorageService) {
    if (this.localDir) {
      const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
      const host = url?.hostname ?? process.env.DB_HOST;
      const port = Number(url?.port ?? process.env.DB_PORT);
      if (process.env.NODE_ENV === 'production' || !isAbsolute(this.localDir) || !['localhost','127.0.0.1'].includes(host ?? '') || port !== 5433)
        throw new Error('Local evidence storage requires an absolute path and local development DB.');
    }
  }
  private path(key: string) {
    const root = resolve(this.localDir!);
    const target = resolve(root,key);
    if (!target.startsWith(root+sep)) throw new Error('Invalid storage path');
    return target;
  }
  async upload(key: string, data: Buffer, mime: string) {
    if (!this.localDir) { await this.remote.assertPrivateEvidenceBucket(mime,data.length); return this.remote.upload(key,data,mime); }
    const file = this.path(key); await mkdir(dirname(file),{recursive:true});
    await writeFile(file,data,{flag:'wx'});
  }
  async download(key: string) {
    if (!this.localDir) { await this.remote.assertPrivateEvidenceBucket(); return this.remote.download(key); }
    try { return await readFile(this.path(key)); } catch { throw new NotFoundException('저장된 증빙 자료를 찾을 수 없습니다.'); }
  }
  async remove(key: string) {
    if (!this.localDir) return this.remote.remove(key);
    await unlink(this.path(key));
  }
}
