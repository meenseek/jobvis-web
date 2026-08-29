# Jobvis Web Feature Map

이 문서는 현재 웹 화면 기준으로 메뉴별 기능, 화면 문구가 결정되는 기준, 연결된 API와
아직 연결이 필요한 API를 정리합니다.

## API 연결 기준

웹은 `/api/backend/*` Next Route Handler를 통해 백엔드 `/api/v1/*`로 요청을
프록시합니다. 기본 백엔드 주소는 `http://127.0.0.1:8080`이고,
`JOBVIS_API_BASE_URL`로 바꿀 수 있습니다.

`JOBVIS_API_MODE=mock`일 때는 `src/mock-api/applications.ts`의 메모리 mock API를
사용합니다. 백엔드가 꺼져 있거나 502/503/504가 내려오면 지원 이력 변경은 브라우저
상태로 fallback합니다.

현재 웹에서 직접 연결한 API는 지원 이력 중심입니다.

| 영역 | API | 현재 웹 연결 |
| --- | --- | --- |
| 지원 목록 | `GET /api/v1/applications` | 연결됨 |
| 지원 추가 | `POST /api/v1/applications` | 연결됨 |
| 기본 정보 수정 | `PATCH /api/v1/applications/{id}/details` | 연결됨 |
| 메모 저장 | `PUT /api/v1/applications/{id}/memo` | 연결됨 |
| 상태 변경 | `POST /api/v1/applications/{id}/status` | 연결됨 |
| 일정 완료 | `POST /api/v1/applications/{id}/schedule/complete` | 연결됨 |
| 검토 완료 | `POST /api/v1/applications/{id}/review/complete` | 연결됨 |
| 인증 | `/api/v1/auth/*` | 백엔드 있음, 웹은 임시 로컬 인증 |
| 메일 연결 | `/api/v1/connections/*` | 백엔드 있음, 웹은 로컬 상태 |
| 메일 가져오기 | `/api/v1/import-runs`, `/api/v1/import-drafts` | 백엔드 있음, 웹 미연결 |
| 캘린더 내보내기 | `/api/v1/calendar-exports/*` | 백엔드 있음, 웹 미연결 |
| 통계 요약 | `GET /api/v1/analytics/summary` | 백엔드 있음, 웹은 프론트 계산 |

## 상태 기준

Jobvis에서 `지원 상태`와 `일정 종류`는 다른 개념입니다.

- 원천 지원 상태: 백엔드가 저장하는 실제 전형 위치입니다. `stage`, `result`,
  `needsReview`로 표현하고, 상태 변경 API에는 이 값을 보냅니다.
- 표시 지원 상태: 사용자가 화면에서 보는 상태입니다. 지원 현황, 홈, 캘린더의 status
  badge와 지원 현황 필터는 모두 이 값을 기준으로 표시합니다.
- 일정 종류: 캘린더에서 일정 필터링과 보조 설명에만 사용합니다.

표시 지원 상태 badge 기준:

| 우선순위 | 조건 | 표시 라벨 | badge tone |
| --- | --- | --- | --- |
| 1 | `needsReview === true` | 확인 필요 | `review` |
| 2 | `result === "offered"` | 최종 합격 | `offered` |
| 3 | `result === "rejected"` | 전형 종료 | `rejected` |
| 4 | `stage === "offer"` | 처우 협의 | `offer` |
| 5 | `stage === "interview"` | 면접 진행 | `interview` |
| 6 | `scheduleType === "test"` | 과제·테스트 | `test` |
| 7 | 그 외 진행 중 지원 | 지원·서류 | `application` |

프론트에서는 `applicationDisplayStatusLabel()`과 `applicationStatusBadgeTone()`을
공통으로 사용합니다. 캘린더의 `지원·서류`, `과제·테스트`, `면접`,
`회신·결과 확인`, `기타`는 일정 종류라서 필터링에 사용하고, status badge 색은
표시 지원 상태가 결정합니다.

## 공통 앱 프레임

- 첫 진입은 `AuthGate`를 거쳐 로그인/회원가입 화면을 보여줍니다.
- 현재 인증은 브라우저 로컬 세션 기반 임시 구현입니다.
- `NEXT_PUBLIC_JOBVIS_AUTH_BYPASS=1`이면 렌더링 테스트와 개발 확인에서 인증 화면을
  건너뜁니다.
- LNB는 고정 사이드바이고 홈, 지원 현황, 캘린더, 지원 통계, 설정 메뉴를 제공합니다.
- 지원 상세를 열면 LNB 안에 열린 상세 탭이 추가됩니다.

필요한 후속 작업:

- Google/Kakao 로그인 UI를 `/api/v1/auth/providers`, `/api/v1/auth/challenges`,
  `/api/v1/auth/exchange`, `/api/v1/auth/me`, `/api/v1/auth/logout`에 연결합니다.
- 임시 로컬 세션과 실제 access token/session 저장 전략을 분리합니다.

## 홈 `/`

홈은 전체 지원 이력에서 오늘 확인할 내용을 규칙 기반으로 계산합니다. 현재 구현은
백엔드가 문구를 내려주는 방식이 아니라, 클라이언트가 지원 목록 데이터를 받아
`buildRuleBasedHomeSummary`에서 문구와 목록을 만듭니다.

기능:

- 서울 시간 기준 오늘 날짜를 상단에 표시합니다.
- 안내 문구는 클라이언트에서 `buildRuleBasedHomeSummary` 규칙으로 결정합니다.
- 메일이 연결되어 있지 않으면 채용 메일 연결 배너를 보여줍니다.
- 오늘의 우선순위는 확인 필요 항목과 오늘까지 처리해야 하는 미완료 일정을 최대 5개
  보여줍니다.
- 다가오는 일정은 완료되지 않았고 전형 종료가 아닌 일정 중 오늘 이후 항목을 최대 5개
  보여줍니다.
- 진행 중인 지원은 `result === "active"`인 지원을 예정일 기준으로 정렬해 최대
  5개 보여주고, 각 행에는 최근 변화와 예정일을 표시합니다.

안내 문구 결정 순서:

| 조건 | 문구 |
| --- | --- |
| `needsReview` 항목이 1개 이상 | `지원자님, 확인 필요한 지원 N개가 있어요. 오늘은 이 항목부터 보면 좋아요.` |
| 오늘 이전/오늘의 미완료 일정이 1개 이상 | `지원자님, 오늘 먼저 처리할 항목 N개가 있어요.` |
| 이번 주 예정 일정이 1개 이상 | `지원자님, 급한 할 일은 없어요. 이번 주 일정만 가볍게 확인해볼까요?` |
| 위 조건이 모두 없음 | `지원자님, 오늘은 급한 일정 없이 지원 흐름만 가볍게 보면 돼요.` |

권장 제품 정책:

- briefing 문구는 백엔드가 완성 문장을 내려주지 않고, 백엔드의 `reason`과 count를
  기반으로 클라이언트에서 만듭니다.
- 우선순위는 `임박한 일정`과 `메일 자동 분류 후 확인 필요`를 함께 봅니다.
- 다가오는 일정은 오늘부터 5일 이내의 미완료 일정을 기본 범위로 봅니다.
- 진행 중인 지원은 `result === "active"`인 지원 중 사용자가 다음에 볼 가능성이 높은
  순서로 보여줍니다.

홈 영역별 권장 기준:

| 영역 | 권장 기준 | 필요한 백엔드 데이터 |
| --- | --- | --- |
| briefing | 가장 중요한 사유 하나를 `reason`으로 고르고 클라이언트가 문구 생성 | `needsReviewCount`, `overdueTaskCount`, `todayTaskCount`, `upcomingScheduleCount` |
| 우선순위 | 확인 필요, 기한 경과, 오늘 일정, 1~2일 내 일정 순으로 최대 5개 | `needsReview`, `nextActionAt`, `nextActionCompleted`, `scheduleType`, `result` |
| 다가오는 일정 | 오늘 포함 5일 이내, 미완료, 전형 종료 제외 | `nextActionAt`, `nextActionCompleted`, `scheduleType`, `company`, `position`, `result` |
| 진행 중인 지원 | 전형 종료/최종 합격 제외. 예정일 빠른 순, 날짜 없으면 최근 지원일 순. 표시값은 상태, 최근 변화, 예정일 | `result`, `stage`, `company`, `position`, `appliedAt`, `nextActionAt`, `scheduleType`, `activities` |

briefing `reason` 우선순위:

| reason | 조건 | 클라이언트 문구 예시 |
| --- | --- | --- |
| `needsReview` | 확인 필요 지원이 1개 이상 | `지원자님, 확인 필요한 지원 N개가 있어요. 오늘은 이 항목부터 보면 좋아요.` |
| `overdueTask` | 기한이 지난 미완료 일정이 1개 이상 | `지원자님, 기한이 지난 항목 N개가 있어요. 먼저 정리해볼까요?` |
| `todayTask` | 오늘 미완료 일정이 1개 이상 | `지원자님, 오늘 먼저 처리할 항목 N개가 있어요.` |
| `upcomingSchedule` | 5일 이내 예정 일정이 1개 이상 | `지원자님, 급한 할 일은 없어요. 다가오는 일정만 가볍게 확인해볼까요?` |
| `idle` | 위 조건이 모두 없음 | `지원자님, 오늘은 급한 일정 없이 지원 흐름만 가볍게 보면 돼요.` |

안내 문구와 홈 요약 생성에 필요한 백엔드 정보:

| 필요한 정보 | 현재 사용하는 필드 | 용도 |
| --- | --- | --- |
| 확인 필요 지원 수 | `needsReview` | 안내 문구 1순위, 오늘의 우선순위 `확인 필요` 항목 생성 |
| 오늘 이전/오늘의 미완료 일정 | `nextActionAt`, `nextActionCompleted`, `result` | 안내 문구 2순위, `오늘`/`기한 경과` 항목 생성 |
| 5일 이내 예정 일정 | `nextActionAt`, `nextActionCompleted`, `result` | 안내 문구 3순위, 다가오는 일정 목록 생성 |
| 진행 중인 지원 | `result`, `appliedAt`, `nextActionAt` | 진행 중인 지원 목록 정렬 |
| 화면에 표시할 지원 기본 정보 | `id`, `company`, `position`, `stage`, `scheduleType`, `activities` | 홈 카드, 상태 badge, 최근 변화, 상세 링크 |
| 채용 메일 연결 여부 | 현재는 `mailConnection` 로컬 상태 | 메일 연결 배너 노출 여부 |

현재 클라이언트 계산 방식:

- `GET /api/v1/applications`로 전체 지원 목록을 가져옵니다.
- 클라이언트가 서울 시간 기준 `today`와 5일 이내 범위를 계산합니다.
- 클라이언트가 `needsReview`, `nextActionAt`, `nextActionCompleted`, `result`를 보고
  안내 문구, 우선순위, 다가오는 일정, 진행 중인 지원을 만듭니다.
- 장점은 별도 홈 API 없이 빠르게 구성할 수 있다는 점입니다.
- 단점은 지원 목록이 커질수록 홈에 필요 없는 데이터까지 가져오고, 문구 정책이
  프론트에 고정된다는 점입니다.

사용 데이터/API:

- `GET /api/v1/applications`: 홈 요약의 원천 데이터입니다.
- `POST /api/v1/applications/{id}/schedule/complete`: 우선순위 항목의 완료 버튼에서
  사용합니다.
- 설정의 메일 연결 상태는 현재 `AccountSettingsProvider` 로컬 상태를 사용합니다.

홈 전용 API를 만든다면 권장 형태:

```http
GET /api/v1/home/summary?date=2026-08-29&timezone=Asia/Seoul
```

백엔드는 문구 자체보다 문구를 만들 근거를 내려주는 쪽이 좋습니다. 최종 문구는
클라이언트의 copy 정책으로 만듭니다.

응답 예시:

```json
{
  "briefing": {
    "reason": "needsReview"
  },
  "counts": {
    "needsReview": 2,
    "openTasks": 3,
    "upcomingSchedulesWithinFiveDays": 4,
    "activeApplications": 8
  },
  "priorityItems": [
    {
      "applicationId": "uuid",
      "company": "토스페이먼츠",
      "position": "Server Developer",
      "reason": "needsReview",
      "nextActionAt": "2026-08-29",
      "canComplete": false
    }
  ],
  "upcomingSchedules": [],
  "activeApplications": [],
  "mailConnection": {
    "connected": false,
    "provider": null,
    "lastSyncedAt": null
  }
}
```

홈 전용 API를 만들 때 백엔드에서 결정할 것:

- 안내 문구는 클라이언트가 만들고, 백엔드는 `reason`과 count를 내려주는 방향을
  우선합니다.
- `priorityItems`, `upcomingSchedules`, `activeApplications`를 서버에서 정렬/limit해서
  내려줄지 결정합니다.
- 메일 연결 배너 판단을 위해 `/api/v1/connections`를 별도로 호출할지, 홈 summary에
  포함할지 결정합니다.

필요한 후속 작업:

- 메일 연결 상태를 `/api/v1/connections`에서 가져오도록 연결합니다.
- 수동/자동 동기화 상태와 최근 import run 상태를 홈 배너나 우선순위에 반영할지 결정합니다.
- 홈 요약을 계속 프론트 규칙으로 둘지, 별도 home summary API를 만들지 결정합니다.
- 현재 구현의 이번 주 기준을 5일 이내 기준으로 바꿀지 결정합니다.

## 지원 현황 `/applications`

지원 목록을 검색, 필터링하고 직접 추가할 수 있는 화면입니다.

기능:

- 회사, 포지션, 출처 텍스트 검색을 지원합니다.
- 전체 상태, 확인 필요, 지원·서류, 과제·테스트, 면접 진행, 처우 협의,
  최종 합격, 전형 종료 필터를 지원합니다.
- 전체 지원 수와 확인 필요 수를 요약 버튼으로 보여줍니다.
- 확인 필요 항목을 한 번에 확인 완료 처리하는 `일괄 확인` 버튼을 제공합니다.
- 지원 내역 추가 다이얼로그에서 회사, 포지션, 진행 상태를 입력합니다.
- 행 클릭 또는 회사명 클릭으로 상세 화면에 진입합니다.
- 목록 URL에는 `q`, `status` query parameter가 반영됩니다. `status`는 표시 지원
  상태(`review`, `application`, `test`, `interview`, `offer`, `offered`,
  `rejected`)를 사용합니다.

사용 데이터/API:

- `GET /api/v1/applications?q={query}&status={status}`: 백엔드 목록 조회 API입니다.
- `POST /api/v1/applications`: 직접 추가 API입니다.
- `POST /api/v1/applications/{id}/review/complete`: 일괄 확인 버튼에서 확인 필요
  항목마다 호출합니다.
- API 실패 시 `initialApplications`와 reducer 기반 로컬 상태로 fallback합니다.

일정 정보 산출 기준:

- 화면에서는 별도 행동 문구 값을 표시하지 않습니다.
- 메일에서 날짜/시간/유형을 추출하면 import draft의 `scheduleType`, `scheduledAt`,
  `scheduleEndsAt`을 수락 시 지원 일정으로 저장합니다.
- 사용자가 일정을 직접 수정하면 `PUT /api/v1/applications/{id}/schedule` 결과가
  최우선 원천이 되어야 합니다.
- 직접 추가한 지원처럼 명확한 일정이 없으면 일정 없음 또는 기본 예정일만 표시합니다.

메일 자동 분류에서 일정 정보를 만들 때 필요한 정보:

| 필요한 정보 | 현재 백엔드 필드 | 용도 |
| --- | --- | --- |
| 메일 제목/본문 preview | `subject`, `textPreview` | 일정/상태 키워드 탐지 |
| 발신자 | `sender` | 회사 추론, 채용 메일 여부 판단 |
| 수신 시각 | `receivedAt` | 지원일 fallback, 일정 merge 우선순위 |
| 추출된 전형 단계 | `stage`, `highestStageReached`, `result` | 상태 기반 fallback action 생성 |
| 추출된 일정 | `scheduleType`, `scheduledAt`, `scheduleEndsAt` | 일정 종류, 예정일 생성 |
| 신뢰도 | `confidence` | `needsReview` 여부 판단 |

필요한 API 후보:

- `GET /api/v1/applications`: 일정 날짜, 완료 여부, 일정 종류 포함.
- `PUT /api/v1/applications/{id}/schedule`: 사용자가 일정을 직접 수정할 때 사용.
- `GET /api/v1/import-drafts`: 메일 자동 분류 결과의 일정 후보를 검토할 때 사용.
- `PATCH /api/v1/import-drafts/{draftId}`: 잘못 뽑힌 일정을 수정할 때 사용.
- `POST /api/v1/import-drafts/{draftId}/accept`: 검토한 일정을 지원 이력에 반영할 때 사용.

필요한 후속 작업:

- 현재 `fetchApplications`는 query/status를 API로 넘기지 않고 전체 목록을 받은 뒤
  프론트에서 필터링합니다. 목록 규모가 커지면 서버 필터 API를 직접 사용하도록 바꿉니다.
- 페이지네이션이 필요해지면 `GET /api/v1/applications/page`를 연결합니다.
- 확인 필요 항목이 많아지면 `POST /api/v1/applications/review/complete-bulk` 같은
  bulk API를 추가해 단건 요청 반복을 줄입니다.
- 사용자가 일정 종류와 날짜를 직접 수정할 수 있는 UI를 지원 상세 또는 목록에 추가합니다.

## 지원 상세 `/applications/{id}`

특정 지원 건의 기본 정보, 진행 상태, 관련 메일, 변경 기록, 메모를 관리합니다.

기능:

- 회사, 포지션, 근무지, 고용 형태를 보여줍니다.
- 확인 필요 항목이면 확인 배너와 `확인 완료` 버튼을 보여줍니다.
- 지원 이력 타임라인을 최신순으로 보여줍니다.
- 관련 메일 목록을 보여주고, 메일을 누르면 요약 미리보기 다이얼로그를 엽니다.
- 변경 기록에서 수정 전/후 값을 확인할 수 있습니다.
- 진행 상태를 select로 변경합니다.
- 메모를 작성하고 저장합니다.
- 기본 정보 편집 다이얼로그에서 회사, 포지션, 근무지, 고용 형태를 수정합니다.

사용 데이터/API:

- `PATCH /api/v1/applications/{id}/details`
- `PUT /api/v1/applications/{id}/memo`
- `POST /api/v1/applications/{id}/status`
- `POST /api/v1/applications/{id}/review/complete`
- 상세 진입 자체는 현재 Provider에 로드된 `GET /api/v1/applications` 결과에서 찾습니다.

백엔드에는 있으나 현재 화면에서 별도 호출하지 않는 API:

- `GET /api/v1/applications/{id}`
- `GET /api/v1/applications/{id}/schedule`
- `GET /api/v1/applications/{id}/emails`
- `GET /api/v1/applications/{id}/activities`
- `GET /api/v1/applications/{id}/changes`
- `PUT /api/v1/applications/{id}/schedule`

필요한 후속 작업:

- 상세 URL 직접 진입 시 목록 Provider 로드 전/실패 상태를 더 명확히 처리합니다.
- 메일, 이력, 변경 기록이 길어질 수 있으므로 별도 history API pagination을 연결합니다.
- 일정 편집 UI가 필요하면 `PUT /api/v1/applications/{id}/schedule`을 붙입니다.

## 캘린더 `/calendar`

지원 이력의 일정을 월간 달력과 선택 날짜 목록으로 보여줍니다.

기능:

- 오늘 기준 월을 기본으로 보여줍니다.
- 이전 달, 오늘, 다음 달 이동을 지원합니다.
- 일정 종류 필터를 제공합니다: 모든 일정, 지원·서류, 과제·테스트, 면접,
  회신·결과 확인, 기타.
- 완료된 일정, 전형 종료 지원, 날짜가 없는 항목은 제외합니다.
- 날짜 셀에는 해당 날짜의 회사명을 최대 2개 표시하고, 초과분은 `+N개`로 보여줍니다.
- 선택한 날짜의 일정은 오른쪽 패널에서 상세 링크로 제공합니다.
- 선택 일정 카드의 badge는 지원 현황과 같은 표시 지원 상태 기준으로 표시합니다.

사용 데이터/API:

- 현재는 `GET /api/v1/applications`로 가져온 지원 데이터의 `nextActionAt`,
  `scheduleType`, `nextActionCompleted`, `result`를 사용합니다.
- 캘린더 전용 조회 API는 아직 사용하지 않습니다.

백엔드에는 있으나 현재 화면에서 연결하지 않는 API:

- `POST /api/v1/calendar-exports/previews`
- `GET /api/v1/calendar-exports/{exportId}`
- `POST /api/v1/calendar-exports/{exportId}/confirm`

필요한 후속 작업:

- Google Calendar 내보내기 UI를 추가할지 결정합니다.
- 일정 편집, 완료, 외부 캘린더 동기화 상태를 캘린더 안에서 직접 다룰지 결정합니다.

## 지원 통계 `/analytics`

지원 이력 데이터에서 지원 수와 전환율을 계산해 보여줍니다.

기능:

- 최근 30일, 90일, 180일 기간을 선택할 수 있습니다.
- 선택 기간 내 지원 수를 계산합니다.
- 서류 통과율은 `screeningPassed / total`로 계산합니다.
- 면접 전환율은 `highestStageReached >= interview / total`로 계산합니다.
- 최근 6개월 월별 지원 건수 추이를 SVG 차트로 보여줍니다.
- 전형 단계 전환을 전체 지원, 서류 심사 통과, 면접 진입, 최종 합격 순서로 보여줍니다.
- 지원 이력 출처를 Gmail, Naver 메일, 직접 추가로 묶어 보여줍니다.

사용 데이터/API:

- 현재는 `GET /api/v1/applications`로 로드된 지원 목록에서 프론트가 직접 계산합니다.

백엔드에는 있으나 현재 화면에서 연결하지 않는 API:

- `GET /api/v1/analytics/summary?from={yyyy-mm-dd}&to={yyyy-mm-dd}`

필요한 후속 작업:

- 통계 계산 기준을 백엔드와 프론트 중 어디에 둘지 결정합니다.
- 지원 수가 늘어나면 `/api/v1/analytics/summary`를 사용해 서버 계산 결과를 표시합니다.

## 설정 `/settings`

채용 메일 연결과 동기화 방식을 관리하는 화면입니다.

기능:

- 로그인 계정 정보는 표시하지 않습니다.
- 채용 메일 연결 상태를 callout과 설정 row로 보여줍니다.
- 연결된 메일이 없으면 `채용 메일 연결하기` 버튼을 보여줍니다.
- 이메일 도메인으로 Gmail/Naver를 추론합니다.
- 지원하지 않는 도메인이면 연결 버튼을 비활성화합니다.
- 연결 전 동의 체크가 필요합니다.
- 연결 후에는 연결 해제, 자동 동기화 toggle, 수동 동기화 버튼을 제공합니다.
- 마지막 동기화 시간은 서울 시간의 시/분으로 표시합니다.
- 권한 사용 범위를 안내합니다.

현재 상태:

- 설정은 아직 API에 저장하지 않고 `AccountSettingsProvider` reducer의 브라우저 상태만
  사용합니다.
- Gmail/Naver 연결도 실제 OAuth/credential 저장이 아니라 UI 흐름만 구현되어 있습니다.

백엔드 연결 후보:

- `GET /api/v1/connections/capabilities`
- `GET /api/v1/connections`
- `POST /api/v1/connections/naver`
- `POST /api/v1/connections/{provider}/oauth/begin`
- `POST /api/v1/connections/{provider}/oauth/complete`
- `PATCH /api/v1/connections/{connectionId}/monitoring-consent`
- `POST /api/v1/connections/{connectionId}/monitoring/resume`
- `DELETE /api/v1/connections/{connectionId}`
- `POST /api/v1/import-runs`
- `GET /api/v1/import-runs`
- `GET /api/v1/import-drafts`
- `PATCH /api/v1/import-drafts/{draftId}`
- `POST /api/v1/import-drafts/{draftId}/accept`
- `POST /api/v1/import-drafts/{draftId}/reject`

필요한 후속 작업:

- 연결 상태 조회를 `/api/v1/connections`에 붙입니다.
- Gmail은 OAuth begin/complete 플로우를 연결합니다.
- Naver는 앱 비밀번호 입력/검증 플로우가 필요한지 UI 정책을 정합니다.
- 자동 동기화 toggle은 monitoring consent API와 연결합니다.
- 수동 동기화 버튼은 import run 생성 API와 연결하고 실행 상태를 표시합니다.
- import draft 검토 화면을 별도 메뉴로 만들지, 홈/지원 현황에 녹일지 결정합니다.

## 상태와 라벨

원천 지원 상태:

| 값 | 라벨 |
| --- | --- |
| `applied` | 지원 완료 |
| `screening` | 서류 검토 |
| `interview` | 면접 진행 |
| `offer` | 처우 협의 |
| `offered` | 최종 합격 |
| `rejected` | 전형 종료 |

표시 지원 상태:

| 값 | 라벨 | 산출 기준 |
| --- | --- | --- |
| `review` | 확인 필요 | `needsReview === true` |
| `application` | 지원·서류 | 지원 완료/서류 검토 단계 |
| `test` | 과제·테스트 | 지원 완료/서류 검토 단계이고 일정 종류가 `test` |
| `interview` | 면접 진행 | `stage === "interview"` |
| `offer` | 처우 협의 | `stage === "offer"` |
| `offered` | 최종 합격 | `result === "offered"` |
| `rejected` | 전형 종료 | `result === "rejected"` |

일정 종류:

| 값 | 라벨 |
| --- | --- |
| `application` | 지원·서류 |
| `test` | 과제·테스트 |
| `interview` | 면접 |
| `followup` | 회신·결과 확인 |
| `other` | 기타 |

## 스타일 구조

- 전역 토큰은 `app/tokens.scss`에 둡니다.
- reset/base 스타일은 `app/base.scss`에 둡니다.
- 여러 화면에서 반복되는 primitive는 `src/ui/shared.scss`에 둡니다.
- 화면이나 도메인 전용 스타일은 해당 폴더의 `*.module.scss`에 둡니다.
- SCSS 파일의 raw hex 색상은 토큰 파일에만 두고, 화면 스타일은 CSS custom property를
  참조합니다.
