# DB Design v0.2

## 1. 검사 생성 시 TC Snapshot
관리자가 이후 체크 항목 문구/테스트 방법을 수정해도 과거 검사 결과가 바뀌면 안 된다.
검사 생성 순간 조건에 맞는 `test_items`를 `inspection_items`로 복제한다.

## 2. 결과 현재값 + 전체 이력 분리
- `test_results`: 현재 최신 판정
- `test_result_history`: 모든 변경 이력

화면에는 history 최신 2건만 보여주고 DB에는 전체 보존한다.

## 3. 완료 상태는 저장하지 않고 계산
별도 `COMPLETED` 컬럼/버튼을 두지 않는다.

`PASS + FAIL + SKIP == 전체 inspection_items 수` → 완료(100%)

FAIL/SKIP도 수행 완료로 계산하고, 미실행이 하나라도 있으면 진행 중이다. 결과 보고서는 진행 중에도 조회 가능하다.

## 4. 카테고리 기본값
카테고리의 플랫폼/검사유형은 새 항목 생성 시 기본값이다. 기존 하위 항목에 강제 상속하지 않는다.

## 5. 관리자 전체 노출
관리 화면은 적용 조건과 관계없이 전체 categories/test_items를 조회한다. 검사 생성 시에만 플랫폼 + 검사 유형 조건으로 필터링한다.

## 6. 삭제 정책
- 프로젝트: 삭제 금지, 비활성화
- TC/카테고리: 과거 사용 이력이 있으면 비활성화
- inspection_items snapshot으로 과거 결과 보존

## 7. 계정/권한
- 가입 신청: PENDING
- ADMIN 승인 후 APPROVED
- USER: 테스트 수행
- LEADER: USER + 프로젝트/검사 생성
- ADMIN: LEADER + 사용자 승인 + 카테고리/항목 관리
- ADMIN 역할은 시스템에 1개만 운용

## 8. 관리자 동시 로그인
관리자 편집 잠금 대신 ADMIN 계정 자체의 동시 로그인만 막는다.
활성 ADMIN 세션이 있으면 새 ADMIN 로그인을 차단해 미저장 관리 작업 손실을 예방한다.

## 9. 공개 데모 배포
로컬 DB 설정과 별도로 `DATABASE_URL`, `DB_SSL`, `CORS_ORIGINS`를 환경변수화한다.
같은 코드베이스를 Vercel + 관리형 PostgreSQL/백엔드 호스팅 조합으로 배포할 수 있게 한다.
