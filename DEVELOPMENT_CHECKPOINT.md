# Development Checkpoint 01

## Implemented
- NestJS backend source structure
- PostgreSQL connection via local fields or `DATABASE_URL`
- Hosted DB SSL toggle (`DB_SSL`)
- CORS environment setting for future Vercel frontend
- Email/password signup request
- Pending-account approval by ADMIN
- USER / LEADER / ADMIN authorization
- One ADMIN account constraint
- ADMIN active-session duplicate login block
- Opaque Bearer sessions stored as SHA-256 hashes
- Project listing
- LEADER / ADMIN project creation
- Project deactivate/reactivate (no delete)

## Confirmed domain rule
Inspection completion is calculated, not stored:

`executed_count(PASS + FAIL + SKIP) == total_item_count`

FAIL and SKIP are executed results. Any untested item means the inspection is still in progress.

## Runtime verification status
This workspace does not currently provide Docker, and dependency installation timed out, so the NestJS build and PostgreSQL integration could not be executed here. The next local checkpoint is to run `npm install`, `npm run build`, Docker PostgreSQL, bootstrap the ADMIN, and exercise the included API smoke flow.

## Next implementation
- inspections create/list
- filter active TC by platform + inspection type
- create `inspection_items` snapshots
- QA result save/upsert
- append `test_result_history`
- recent two result writers query
- progress/result-report aggregate query
