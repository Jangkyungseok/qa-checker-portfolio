import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { DbService } from '../db/db.service';
import { AuthUser } from '../common/auth-user';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: AuthUser['role'];
  status: AuthUser['status'];
}

@Injectable()
export class AuthService {
  constructor(private readonly db: DbService) {}

  async signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.db.query('SELECT 1 FROM users WHERE email = $1 LIMIT 1', [email]);
    if (existing.rowCount) throw new ConflictException('이미 등록된 이메일입니다.');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const result = await this.db.query<Pick<UserRow, 'id' | 'email' | 'name' | 'role' | 'status'>>(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, role, status`,
      [email, passwordHash, dto.name.trim()],
    );

    return { ...result.rows[0], message: '가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.' };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const result = await this.db.query<UserRow>(
      `SELECT id, email, password_hash, name, role, status
         FROM users
        WHERE email = $1
        LIMIT 1`,
      [email],
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(dto.password, user.password_hash))) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    if (user.status !== 'APPROVED') {
      throw new UnauthorizedException('관리자 승인이 필요한 계정입니다.');
    }

    if (user.role === 'ADMIN') {
      const activeAdmin = await this.db.query(
        `SELECT 1 FROM user_sessions
          WHERE user_id = $1
            AND revoked_at IS NULL
            AND expires_at > now()
          LIMIT 1`,
        [user.id],
      );
      if (activeAdmin.rowCount) {
        throw new ConflictException('관리자 계정이 다른 환경에서 사용 중입니다.');
      }
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const sessionDays = Math.max(1, Number(process.env.SESSION_DAYS ?? 7));

    const session = await this.db.query<{ id: string; expires_at: Date }>(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3 || ' days')::interval)
       RETURNING id, expires_at`,
      [user.id, tokenHash, String(sessionDays)],
    );
    await this.db.query('UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1', [user.id]);

    return {
      token: rawToken,
      expiresAt: session.rows[0].expires_at,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  async logout(sessionId: string) {
    await this.db.query('UPDATE user_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [sessionId]);
    return { success: true };
  }
}
