import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DbService } from '../db/db.service';
import { AuthUser } from './auth-user';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly db: DbService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;
    const match = header?.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new UnauthorizedException('로그인이 필요합니다.');

    const tokenHash = createHash('sha256').update(match[1]).digest('hex');
    const result = await this.db.query<AuthUser & { expires_at: Date; revoked_at: Date | null }>(
      `SELECT u.id, u.email, u.name, u.role, u.status,
              s.id AS "sessionId", s.expires_at, s.revoked_at
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1
        LIMIT 1`,
      [tokenHash],
    );

    const user = result.rows[0];
    if (!user || user.revoked_at || new Date(user.expires_at).getTime() <= Date.now()) {
      throw new UnauthorizedException('세션이 만료되었습니다.');
    }
    if (user.status !== 'APPROVED') {
      throw new UnauthorizedException('승인된 계정이 아닙니다.');
    }

    request.user = user;
    void this.db.query('UPDATE user_sessions SET last_seen_at = now() WHERE id = $1', [user.sessionId]);
    return true;
  }
}
