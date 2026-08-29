# QA Checker MVP

모바일 게임 QA 검사 프로세스 관리 도구 MVP.

## Stack
- Frontend: Next.js + React + TypeScript (next step)
- Backend: NestJS + TypeScript
- Database: PostgreSQL 16
- Auth: DB-backed opaque Bearer session

## First vertical slice implemented
1. 이메일/비밀번호 가입 신청
2. 관리자 승인 후 로그인
3. USER / LEADER / ADMIN 권한
4. ADMIN 계정 1개 + 활성 관리자 세션이 있으면 신규 관리자 로그인 차단
5. 프로젝트 목록 조회
6. LEADER / ADMIN 프로젝트 생성 및 활성/비활성 전환

## Local run
```bash
# 1) DB
cd qa-checker-mvp
docker compose up -d

# 2) Backend
cd backend
cp .env.example .env
npm install
npm run build

# 3) First ADMIN account (once)
set -a; source .env; set +a
npm run bootstrap:admin

# 4) API
npm run start:dev
```

API base: `http://localhost:3001`

## API quick check
### Signup
`POST /auth/signup`
```json
{"email":"tester@example.com","password":"password123","name":"테스터"}
```

### Admin login
`POST /auth/login`
```json
{"email":"admin@example.com","password":"change-me-1234"}
```
Use returned token as `Authorization: Bearer <token>`.

### Pending users
`GET /users/pending` (ADMIN)

### Approve
`POST /users/:id/approve` (ADMIN)
```json
{"role":"LEADER"}
```

### Projects
- `GET /projects` : approved users
- `POST /projects` : LEADER, ADMIN
- `PATCH /projects/:id/deactivate` : LEADER, ADMIN
- `PATCH /projects/:id/activate` : LEADER, ADMIN

## Deployment-friendly decisions
- `DATABASE_URL` supported for Neon/Supabase/Render/Railway-style managed PostgreSQL.
- `DB_SSL=true` supported for hosted PostgreSQL.
- `CORS_ORIGINS` is environment-based for Vercel frontend URLs.
- Secrets are environment variables only; `.env` is not intended for Git.
- No paid custom domain required for the portfolio demo.

## Completion rule (confirmed)
There is no manual inspection-complete flag.
`PASS + FAIL + SKIP == total inspection items` means 100% / completed.
Otherwise the inspection is in progress. FAIL and SKIP both count as executed.

## Next checkpoint
Inspection creation + category/TC snapshot + PASS/FAIL/SKIP result/history API.
