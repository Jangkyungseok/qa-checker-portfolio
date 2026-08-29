import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly db: DbService) {}

  async list(includeInactive = false) {
    const result = await this.db.query(
      `SELECT id, name, is_active, created_by, created_at, updated_at
         FROM projects
        WHERE ($1::boolean = true OR is_active = true)
        ORDER BY is_active DESC, name ASC`,
      [includeInactive],
    );
    return result.rows;
  }

  async create(nameInput: string, userId: string) {
    const name = nameInput.trim();
    try {
      const result = await this.db.query(
        `INSERT INTO projects (name, created_by)
         VALUES ($1, $2)
         RETURNING id, name, is_active, created_by, created_at, updated_at`,
        [name, userId],
      );
      return result.rows[0];
    } catch (error: any) {
      if (error?.code === '23505') throw new ConflictException('이미 존재하는 프로젝트명입니다.');
      throw error;
    }
  }

  async setActive(id: string, isActive: boolean) {
    const result = await this.db.query(
      `UPDATE projects SET is_active = $2, updated_at = now()
        WHERE id = $1
        RETURNING id, name, is_active, created_by, created_at, updated_at`,
      [id, isActive],
    );
    if (!result.rowCount) throw new NotFoundException('프로젝트를 찾을 수 없습니다.');
    return result.rows[0];
  }
}
