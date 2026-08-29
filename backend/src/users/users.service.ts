import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { UserRole } from '../common/auth-user';

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  async listPending() {
    const result = await this.db.query(
      `SELECT id, email, name, role, status, created_at
         FROM users
        WHERE status = 'PENDING'
        ORDER BY created_at ASC`,
    );
    return result.rows;
  }

  async approve(userId: string, role: UserRole, adminId: string) {
    if (role === 'ADMIN') {
      throw new BadRequestException('관리자 계정은 시스템에 1개만 운용합니다.');
    }
    const result = await this.db.query(
      `UPDATE users
          SET status = 'APPROVED', role = $2, approved_at = now(), approved_by = $3, updated_at = now()
        WHERE id = $1 AND status = 'PENDING'
        RETURNING id, email, name, role, status, approved_at`,
      [userId, role, adminId],
    );
    if (!result.rowCount) throw new NotFoundException('승인 대기 중인 계정을 찾을 수 없습니다.');
    return result.rows[0];
  }

  async reject(userId: string, adminId: string) {
    const result = await this.db.query(
      `UPDATE users
          SET status = 'REJECTED', approved_by = $2, updated_at = now()
        WHERE id = $1 AND status = 'PENDING'
        RETURNING id, email, name, role, status`,
      [userId, adminId],
    );
    if (!result.rowCount) throw new NotFoundException('승인 대기 중인 계정을 찾을 수 없습니다.');
    return result.rows[0];
  }
}
