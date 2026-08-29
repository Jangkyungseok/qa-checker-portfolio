import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    this.bucket =
      process.env.SUPABASE_STORAGE_BUCKET ??
      'qa-checker-attachments';

    if (!url || !secretKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SECRET_KEY are required.',
      );
    }

    this.client = createClient(
      url,
      secretKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  async upload(
    path: string,
    buffer: Buffer,
    contentType: string,
  ) {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      throw new InternalServerErrorException(
        `첨부파일 저장에 실패했습니다: ${error.message}`,
      );
    }
  }

  async download(path: string) {
    const { data, error } =
      await this.client.storage
        .from(this.bucket)
        .download(path);

    if (error || !data) {
      throw new NotFoundException(
        '저장된 첨부파일을 찾을 수 없습니다.',
      );
    }

    return Buffer.from(
      await data.arrayBuffer(),
    );
  }

  async remove(path: string) {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([path]);

    if (error) {
      throw new InternalServerErrorException(
        `첨부파일 삭제에 실패했습니다: ${error.message}`,
      );
    }
  }
}
