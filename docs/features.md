# Jobvis Web 현행 기능 지도

이 문서는 현재 UI가 실제로 호출하는 API와 화면별 데이터 소유권을 기록합니다. 공개
계약의 정본은 `jobvis-api/openapi/jobvis-v1.yaml`이고, 웹 타입은 이 계약에서 생성합니다.
후보 endpoint나 백엔드 내부 필드는 이 문서의 계약이 아닙니다.

## 공통 경계

- 브라우저는 `/api/backend/*` BFF만 호출합니다. BFF는 허용된 root만 `jobvis-api`의
  `/api/v1/*`로 전달합니다.
- API session은 `/api/auth/*` Route Handler가 `HttpOnly` cookie로 보관합니다. 실제
  session token은 브라우저 JavaScript에 노출하지 않습니다.
- shell은 `GET /applications/counts`만 읽습니다. 전체 지원 목록을 전역 Provider에
  적재하지 않습니다.
- 각 화면은 필요한 bounded API를 직접 소유합니다. 지원 상세 Provider는 열어 본 상세와
  mutation 복구만 캐시합니다.
- 변경 요청은 UUID `mutationId`와 응답의 최신 `version`을 사용합니다. 응답 유실이나
  `409`가 발생하면 같은 scope를 다시 읽어 서버 상태를 확인하고, 확인할 수 없을 때만 같은
  mutation ID를 다음 재시도에 유지합니다.
- API 오류의 `ProblemDetail.detail`을 공통 client에서 읽어 사용자에게 표시합니다. 인증
  만료는 로그인 화면으로 돌립니다.

## 상태 표시

API의 지원 상태는 `status` 하나입니다.

| API `status` | 기본 UI 라벨 |
| --- | --- |
| `applied`, `screening` | 지원·서류 |
| `test` | 과제·테스트 |
| `interview` | 면접 진행 |
| `offer` | 처우 협의 |
| `offered` | 최종 합격 |
| `rejected` | 전형 종료 |

`needsReview=true`이면 상태보다 먼저 `확인 필요`로 표시합니다. `stage`와 `result`를 별도
API 상태로 다시 만들지 않습니다. 일정 종류는 지원 상태와 별개이며 캘린더 분류에만
사용합니다.

## 인증

- 첫 진입에서 `/api/auth/me`로 session을 확인합니다.
- Google 로그인은 API의 provider capability, challenge, exchange를 거쳐 opaque session을
  발급합니다.
- mock/local 모드의 데모 사용자 정보만 local storage에 둘 수 있습니다.

## 홈 `/`

홈은 `GET /home/summary` 한 번으로 briefing 근거, 오늘의 우선순위, 다가오는 일정과 진행
중인 지원을 받습니다. 서버는 bounded 목록과 `reason`·count를 내리고, 최종 한국어 문구는
클라이언트가 만듭니다.

- `needsReview`, 열린 일정, 다가오는 일정 순으로 briefing을 표시합니다.
- 우선순위 일정 완료는 `POST /applications/{id}/schedule/complete`를 사용하고 홈 요약을
  다시 읽습니다.
- 메일 연결 배너는 settings가 읽은 현재 mail connection 유무를 사용합니다.

## 지원 현황 `/applications`

- `GET /applications/page?q=&status=&page=&limit=100`을 사용합니다.
- 검색어와 상태 filter는 서버가 적용하고 URL의 `q`, `status`와 동기화합니다.
- `filteredCount`, `totalCount`, `needsReviewCount`, `reviewRevision`은 같은 page 응답에서
  받아 목록과 집계의 시점을 맞춥니다.
- 다음 page는 `hasNext`일 때만 추가로 읽습니다.
- 직접 추가는 `POST /applications`에 `status` 하나를 보냅니다.
- 일괄 확인은 `POST /applications/review/complete-bulk`에 현재 `reviewRevision`을 보내 한
  번에 처리합니다. 지원별 반복 요청을 만들지 않습니다.

## 지원 상세 `/applications/{id}`

상세 진입은 다음 네 요청을 병렬 실행합니다.

- `GET /applications/{id}`: 이력을 제외한 core 상세
- `GET /applications/{id}/emails`
- `GET /applications/{id}/activities`
- `GET /applications/{id}/changes`

각 history 응답의 `nextCursor`가 있을 때만 `더 보기`를 노출합니다. 메일과 변경 기록은
`totalCount`도 표시합니다. 상세 수정, 메모, 상태, 검토 완료, 일정 완료와 활동 삭제는 모두
현재 application version과 mutation ID를 사용하고 성공 뒤 상세를 다시 읽습니다.

## 캘린더 `/calendar`

- 보이는 월의 날짜 범위만 `GET /calendar/schedules?from=&to=`로 읽습니다.
- 일정 등록 다이얼로그가 열린 동안 검색어별로
  `GET /applications/page?status=schedulable&q=&page=0&limit=20`만 읽습니다. 전체 application
  목록, 상세나 history는 읽지 않습니다.
- 날짜 UI의 일정 등록·수정은 `PATCH /applications/{id}/schedule`을 사용합니다. API는 기존
  시각·종료·시간대·장소 같은 숨은 필드를 보존합니다.
- Google Calendar 내보내기 API는 API 계약에 보존하지만 현재 화면에 조작이 없으므로 web
  BFF에는 노출하지 않습니다.

## 지원 통계 `/analytics`

선택 기간마다 `GET /analytics/summary?from=&to=`를 호출합니다. 전체 지원 목록을 내려받아
브라우저에서 다시 집계하지 않습니다. 응답의 총 지원 수, 단계 도달 수, 최종 합격 수,
월별 흐름과 source 집계를 그대로 시각화합니다.

## 설정 `/settings`

설정은 로컬 placeholder가 아니라 실제 연결 API를 사용합니다.

- `GET /connections/capabilities`
- `GET /connections?capability=mail&includeRevoked=false`
- `POST /connections/naver`
- `POST /connections/{gmail|outlook}/oauth/begin`
- `POST /connections/{gmail|outlook}/oauth/complete`
- `PATCH /connections/{id}/monitoring-consent`
- `POST /connections/{id}/monitoring/resume`
- `DELETE /connections/{id}`
- `POST /import-runs`
- `GET /import-runs?page=0&size=1`
- `GET /import-runs/{id}`

메일 가져오기는 채용 메시지를 API에서 직접 지원 이력으로 확정합니다. web에 public
`import-drafts` 승인 화면이나 route를 만들지 않습니다. 실행 응답의 `finalizedCount`,
`ignoredCount`, `duplicateCount`로 결과를 구분합니다.

## 로딩과 실패

- 화면별 최초 로딩은 해당 화면 안에서만 표시하며 shell 전체를 막지 않습니다.
- 요청을 취소한 route 전환은 오류로 표시하지 않습니다.
- mutation 성공을 확인하면 pending mutation ID를 제거하고 관련 화면과 shell count를
  무효화합니다.
- 복구 조회도 실패하면 오류를 유지하고 같은 mutation ID로 재시도할 수 있게 합니다.

## 구현 위치

- `src/contracts/`: OpenAPI 생성 타입
- `src/api/`: 공통 API 요청과 데이터 무효화 이벤트
- `src/auth/`: 로그인과 session BFF client
- `src/applications/`: 지원 계약 adapter, 화면 client와 상세 mutation cache
- `src/home/`: API-backed 홈 화면
- `src/settings/`: 연결·가져오기 API 상태
- `src/mock-api/`: 동일 공개 계약을 구현하는 개발용 메모리 API
