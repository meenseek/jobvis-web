# Jobvis API 요구사항

이 문서는 현재 `jobvis-web` UI와 사용자 흐름을 제품 기준으로 삼아 `jobvis-api`가
제공해야 하는 최소 계약만 정리합니다. 기존 API의 이름이나 응답 형태가 UI와 다르면
기존 구현이 아니라 이 문서의 화면 의미를 기준으로 조정합니다.

## 설계 결론

- 전역 `ApplicationProvider`가 모든 화면에서 전체 지원 목록을 읽는 구조를 제거하고,
  각 route가 자기 화면에 필요한 bounded read model만 조회합니다.
- 기존 paged list, detail, history cursor, analytics, connection, import-run API를
  재사용합니다. 새 read endpoint는 shell count, 홈 top-N과 캘린더 날짜 범위입니다.
- 진행 상태와 일정 종류는 서로 다른 값입니다.
- `needsReview`는 진행 상태가 아니며 `확인 완료` 명령으로만 해제합니다.
- 메일 연결은 로그인 계정과 분리하며, 사용자당 non-revoked MAIL 연결은 최대 하나만
  허용합니다.
- UI 전용 wrapper, 호환 alias와 silent limit은 만들지 않습니다.

화면별 읽기 소유권은 다음과 같습니다.

| 화면 | 정본 API | 범위 |
| --- | --- | --- |
| 공통 shell | `GET /applications/counts`, filtered `GET /connections` | 지원 count와 MAIL 0/1건 |
| 지원 목록 | `GET /applications/page` | filter된 page와 aggregate count |
| 홈 | `GET /home/summary` | count와 각 영역 최대 5개 |
| 지원 상세 | `GET /applications/{id}`와 history cursor API | core 1건과 history page |
| 캘린더 | `GET /calendar/schedules?from&to` | 표시 월 범위 |
| 지원 통계 | `GET /analytics/summary?from&to` | DB 집계 |
| 설정 | `GET /connections/capabilities`, shell의 filtered connection state, latest `GET /import-runs` | 연결 capability, 관리 action과 최근 실행 상태 |

기존 `GET /applications`의 200건 silent cap을 무제한 응답으로 바꾸지 않습니다. web은
`/applications/page`로 이동하고 legacy endpoint는 사용 중단 후 제거합니다.

## Schema 변경 gate

이 계약에서 schema 영향이 있는 목표 상태는 persisted `TEST`, normalized source type,
optional/all-day schedule, 사용자별 `reviewRevision`, bulk-capable application mutation
ledger, 수동 import mutation key, terminal provider-message ledger, provider process binding,
Naver stable provider-message key, legacy import-draft terminal outcome/error code, 사용자당
non-revoked MAIL 최대 1개입니다. 소유자는 `jobvis-api`입니다.
구현 전에 현재 V1 schema가 비폐기 환경에 적용·공유됐는지 확인합니다. 적용된 적이
없다면 현재 목표 schema의 baseline에 합치고, 적용·공유됐다면 기존 파일을 고치지 않고
append-only migration을 추가합니다. 적용 여부를 확인할 수 없으면 baseline을 다시 쓰지
않습니다. 기존 중복 MAIL row 0건 확인, revision 초기화 검증, source type backfill 건수와
unknown 목록 검증, provider process binding constraint 적용과 pending draft 0건 확인이
끝나면 이 migration 부채가 해소됩니다. 기존 default schedule row는 자동 삭제하지 않고
미편집 placeholder임이 확인된 것만 정리하며,
판별할 수 없는 row는 보존합니다. 기존에 실제로 저장된 schedule은 `allDay=false`로
backfill하고 시각만 보고 date-only였다고 추정하지 않습니다.

V3는 어떤 V3+ 변경보다 먼저 legacy `PENDING` draft 0건, 사용자별 non-revoked MAIL 연결
최대 1건, `scheduled_at IS NULL`인 기존 일정 0건을 한 transaction에서 검사합니다. 기존
버전의 import와 monitor를 먼저 멈추고 public draft UI에서 모든 PENDING을 승인 또는
거절하며, 연결 충돌과 시각 없는 일정을 운영자가 명시적으로 정리합니다. 조건이 어긋나면
V3가 schema 변경 전에 실패하므로 V2 상태로 안전하게 돌아갈 수 있어야 합니다.

기존 화면 상태를 보존하는 `TEST` backfill은 active `APPLIED|SCREENING`이면서 현재
`scheduleType=TEST`로 표시되던 application에만 적용합니다. application의
`highestStatus`는 낮아지지 않게 합니다. source type은 `직접 추가 → manual`, 대소문자를
구분하지 않은 `gmail 메일|naver 메일|outlook 메일 → gmail|naver|outlook`로 backfill합니다.
그 밖의 값은 원문 표시 문자열을 보존한 채 `other`로 저장하고 analytics의 `기타`로
노출합니다. backfill 완료 후 source type은 non-null이어야 합니다. 기존 데이터의 process
binding은 legacy 값에서 추측해 만들지 않습니다. 새 collector가 post-rollout message에서
정확한 provider process key를 처음 확인할 때부터 binding을 만듭니다. exact 재수집된
`FINALIZED` ledger에 non-null applicationId가 있으면 그 message의 process key만
conflict-check해 application에 bind하고 duplicate로 끝냅니다. application, history와
reviewRevision은 이 bridge에서 변경하지 않습니다. `IGNORED` ledger는 binding하지 않습니다.

legacy `import_drafts`는 구버전에서 이미 결정한 `ACCEPTED|REJECTED` row만 migration으로
넘깁니다. 모든 terminal row는 `decidedAt`이 있고, `acceptedApplicationId`는 `ACCEPTED`에만
필수입니다. 기존 decision mutation/fingerprint는 audit 값으로 보존합니다. 새 pipeline은
draft row를 만들거나 legacy draft를 다시 결정하지 않으며 terminal row는 기존
`purgeAfter`까지 내부 migration audit로만 보존합니다. 목표 draft status constraint는
`ACCEPTED|REJECTED|FAILED`만 허용합니다.

기존 ledger의 `ACCEPTED`는 같은 `(userId, connectionId, providerMessageId)`의 보존된
`application_emails`를 우선 exact lookup하고 terminal draft를 보조 증빙으로 사용해
`applicationId`를 채운 뒤 `FINALIZED`로 변환합니다. 두 증빙이 충돌하거나 어느 쪽에서도
소유 application을 찾지 못하면 rollout을 중단합니다. `REJECTED`는 `IGNORED`로 변환합니다.
목표 constraint는 `FINALIZED`에 non-null applicationId, `IGNORED`에 null applicationId를
강제합니다. `DRAFTED`는
V3 preflight 뒤 남은 `DRAFTED`는 연결된 PENDING이 없는 orphan reservation이므로 삭제해
이후 정상 수집이 재시도할 수 있게 합니다. ledger의 목표 constraint는
`FINALIZED|IGNORED`만 허용합니다. 전환 전후 draft/ledger 상태별 건수를 reconcile하고 draft
`PENDING=0`, ledger `DRAFTED=0`, constraint 교체까지 검증해야 migration이 끝납니다. old
draft writer를 완전히 중지한 뒤 V3~V9 expand migration, rollout reconciliation/constraint
교체, 새 collection 활성화 순서로 전환합니다.

collector는 provider message ID와 별도로 `providerProcessKeys` set을 보존합니다. Gmail은
`threadId`, Outlook은 `conversationId` 하나를 넣습니다. Naver는 RFC `References`의 root,
없으면 `In-Reply-To`, 둘 다 없으면 현재 `Message-ID`를 선택 key로 쓰고, 현재
`Message-ID`가 있으면 그 key도 alias로 같은 set에 넣습니다. 이 값이 모두 없는 메일만
빈 set입니다. binding의 canonical identity는
기존 connection이 provider account를 소유한다는 경계를 재사용한
`(userId, connectionId, providerProcessKey)`이며 이 tuple이 정확히 한 application만
가리키도록 unique/FK constraint와 application ownership 검증을 둡니다.

Naver ledger의 기존 `providerMessageId=folder + UIDVALIDITY + UID`는 mailbox locator와
legacy lookup을 위해 보존합니다. nullable `stableProviderMessageKey`에는 unfolded/trimmed RFC
`Message-ID`의 SHA-256 key를 저장하고
`(userId, connectionId, stableProviderMessageKey) WHERE stableProviderMessageKey IS NOT NULL`
partial unique index를 둡니다. Naver process key set도 root/parent/current message ID를 같은
normalization/hash 함수로 만듭니다. 현재 message ID alias를 함께 binding하므로
`References`가 없는 연쇄 답장도 이전 message alias를 통해 같은 application을 찾습니다.
Gmail message ID와 Outlook immutable message ID의 기존 ledger key는 유지합니다.

Naver ledger lookup은 stable key를 먼저, 기존 UID key를 fallback으로 조회합니다. legacy UID
row가 일치하고 stable key가 비어 있으면 같은 transaction에서 hash를 채우고, 새 row는 UID와
stable key를 함께 저장합니다. 두 lookup이 서로 다른 ledger row 또는 terminal outcome을
가리키면 `MESSAGE_LEDGER_CONFLICT`로 실패하며 semantic write를 하지 않습니다. header가
없는 message는 stable key 없이 UID key만 사용합니다.

공유 DB에서 새 Naver collection을 켜기 전에 기존 Naver ledger row를 저장된 folder,
UIDVALIDITY와 UID로 provider에 exact refetch하여 stable key를 backfill합니다. `unresolved=0`,
stable-key collision 0건, ledger row count/terminal state 보존을 검증합니다. credential 부재,
UIDVALIDITY 변경 등으로 정확히 역매핑할 수 없는 기존 row는 fuzzy backfill하지 않고 해당
connection을 `NAVER_LEDGER_MIGRATION_REQUIRED` error로 두어 collection 활성화를 막습니다.
exact refetch로 `Message-ID` 부재가 확인된 row는 unresolved가 아니라 검증된 UID-only로
기록합니다.

`NAVER_LEDGER_MIGRATION_REQUIRED`는 credential reconnect나 같은 account의 revoke/reconnect로
자동 해제하지 않습니다. operator reconciliation은 provider/export evidence 또는 사용자가
명시적으로 확인한 mapping만 audit와 함께 stable key에 기록합니다. 그 뒤 해당 connection의
unresolved/collision 0건과 ledger count/state를 다시 검증한 transaction에서만 error를 지우고
collection을 활성화합니다. 정확한 mapping을 만들 수 없으면 block을 유지합니다.

## Canonical 화면 모델

### 저장 상태와 화면 표시 상태

API의 현재 상태는 `status` 하나입니다.

| status | 생성 화면 | 상세 화면 표시 | 의미 |
| --- | --- | --- | --- |
| `applied` | 지원 완료 | 지원·서류 | 지원 완료 |
| `screening` | 서류 검토 | 지원·서류 | 서류 검토 중 |
| `test` | 미노출 | 과제·테스트 | 과제 또는 코딩 테스트 진행 중 |
| `interview` | 면접 진행 | 면접 진행 | 면접 진행 중 |
| `offer` | 처우 협의 | 처우 협의 | 처우 협의 중 |
| `offered` | 미노출 | 최종 합격 | 최종 합격 |
| `rejected` | 미노출 | 전형 종료 | 전형 종료 |

`application`은 API 저장값이 아니라 web이 `applied|screening`을 묶어 보여주는 표시값입니다.
상세 화면에서 사용자가 `application`을 선택하면 web은 `screening`을 전송합니다.
API 요청에 `status`와 `progressStatus`를 함께 받지 않습니다.

`highestStatus`는 `applied < screening < test < interview < offer` 순서의 최고 도달
상태이며 뒤로 이동하거나 terminal 상태가 되어도 낮아지지 않습니다. `offered`와
`rejected`는 현재 결과이고 `highestStatus`의 값으로 넣지 않습니다. `offered` 전환은
최소 `offer` 도달로 기록하지만 `rejected` 전환 자체는 최고 도달 상태를 올리지 않습니다.
회사별 전형 순서가 다르므로 서류 통과 여부를 `highestStatus`에서 추론하지 않습니다. 기존
`highestStatus`와 `screeningPassed` 사실은 backend에 유지하되 application list/core에는
노출하지 않고 analytics에서만 집계합니다. `screeningPassed`는 한 번 true가 되면
낮아지지 않습니다. import evidence가 true이거나 수동/자동 상태가 `interview|offer|offered`
에 도달하면 true로 만들고, `test` 진입이나 `rejected` 전환만으로는 바꾸지 않습니다.

backend가 내부적으로 stage/result를 분리해 저장한다면 stage와 DB constraint에 `TEST`를
추가하고 API 경계에서 위 단일 `status`로 변환해야 합니다. `test`를 `scheduleType=test`로
대신 저장하면 안 됩니다. import classifier/finalizer도 과제·테스트 진행을 persisted
`status=test`와 `highestStatus`에 반영합니다. `needsReview`는 독립 boolean이며 상태
변경으로 자동 해제하지 않습니다.

### 다음 일정

`scheduleType`은 `application|test|interview|followup|other`입니다. 현재 UI는 일정에서
아래 값만 입력하거나 표시합니다.

- 연결된 지원건
- 일정 이름
- 일정 날짜
- 완료 여부
- 화면 표시용 일정 종류

`nextActionAt`은 web이 편집하는 서울 기준 `LocalDate` view입니다. 이 편집은 기존
schedule의 `scheduleType`, timezone 기준 시작 시각, duration, location, description을
보존하는 partial update입니다. `Asia/Seoul` timed schedule의 날짜가 바뀌면 기존 local
time과 duration을 그 날짜로 옮기고, 제목만 바뀌면 시각은 건드리지 않습니다. legacy
non-Seoul timed schedule의 날짜 변경은 현재 date-only UI로 의미를 보존할 수 없으므로
거부하고 제목 변경만 허용합니다. date-only 입력을 이유로 메일에서 가져온 timed
schedule을 임의의 all-day 일정으로 바꾸지 않습니다.

application은 schedule이 없을 수 있으며 지원 생성 시 가짜 기본 schedule을 만들지
않습니다. schedule PATCH는 없으면 생성하고 있으면 부분 수정하는 upsert입니다. 새
schedule에는 현재 status를 기준으로 `applied|screening → application`, `test → test`,
`interview → interview`, `offer|offered|rejected → followup` 기본 종류를 사용합니다.
web이 새로 만든 date-only schedule은 all-day로 기록하고, 저장 모델은 이 값과 메일에서
가져온 timed schedule을 구분할 수 있어야 합니다.

생성 이후 `scheduleType`은 진행 상태와 독립입니다. 현재 UI에는 종류 선택기가 없으므로
기존 schedule PATCH와 이후 상태 변경은 종류를 보존합니다. 일정 이름을 비워 저장하면
기존 이름을 유지하고, 새 일정에만 schedule type 기반 서버 기본 이름을 사용합니다.
현재 UI에는 일정 제거 기능이 없으므로 제거 명령은 이번 범위에 포함하지 않습니다.

application `version`을 schedule까지 포함한 aggregate version으로 사용합니다. 일반 application
mutation의 lock 순서는 선택적인 user review-state, application row를 ID 오름차순, schedule
row 순서입니다.
`needsReview` membership을 바꾸지 않는 schedule writer는 application부터 시작합니다.
모든 schedule writer는 실제 schedule 변경과 같은 transaction에서 application version도
올려야 합니다. 이 불변식을 지키면 현재 web의 application schedule PATCH에는 별도
`expectedScheduleVersion`이 필요하지 않습니다. internal import finalizer는 같은
transaction의 lock/version 불변식을 따릅니다. Calendar Export의 schedule snapshot 계약은
아래처럼 기존 schedule version을 계속 사용합니다.

## 필요한 API 계약

### 지원 목록과 shell count

shell은 item을 포함하지 않는 경량 응답만 읽습니다.

```http
GET /api/v1/applications/counts
```

```json
{
  "totalCount": 12
}
```

지원 목록은 기존 paged endpoint를 정본으로 사용합니다.

```http
GET /api/v1/applications/page?q={query}&status={filter}&page=0&limit=50
```

`status` query는 화면 필터값 `all|review|application|test|interview|offer|offered|rejected`와
선택기 전용 `schedulable`을 받습니다. `review`는 `needsReview=true`이고 나머지 화면 상태
필터는 `needsReview=false`인 row만 대상으로 합니다. 그 안에서 `application`은 저장 상태
`applied|screening`입니다. `all`은 review 여부와 무관한 전체, `schedulable`은 selector
전용으로 review 여부와 무관하게 `rejected`만 제외합니다.

```json
{
  "items": [
    {
      "id": "uuid",
      "version": 3,
      "company": "우아한형제들",
      "position": "Backend Developer",
      "appliedAt": "2026-08-14",
      "status": "test",
      "needsReview": true,
      "source": "Gmail 메일"
    }
  ],
  "page": 0,
  "limit": 50,
  "hasNext": false,
  "filteredCount": 1,
  "totalCount": 12,
  "needsReviewCount": 2,
  "reviewRevision": 9
}
```

- `filteredCount`는 현재 `q/status`, 나머지 두 count는 filter와 무관한 사용자 전체
  기준입니다.
- items, counts와 `reviewRevision`은 같은 read transaction snapshot에서 계산합니다.
- 목록 UI는 server-side 검색·필터와 page 이동 또는 더 보기를 사용합니다.
- 목록 DTO에는 detail, home, calendar, analytics 전용 필드를 넣지 않습니다.
- `source`는 검색·표시용 문구입니다. analytics는 이 문자열을 분석하지 않고 별도 저장된
  `sourceType=manual|gmail|naver|outlook|other`를 집계합니다.

### 홈 요약

```http
GET /api/v1/home/summary
```

서울 기준 오늘의 briefing과 각 목록을 계산하되 목록은 최대 5개만 반환합니다. 문구는
web이 `briefing.reason`과 `briefing.count`로 만듭니다. briefing과 세 목록은 같은 read
transaction snapshot에서 계산합니다.

```json
{
  "date": "2026-08-31",
  "briefing": { "reason": "needsReview", "count": 2 },
  "priorityItems": [
    {
      "applicationId": "uuid",
      "applicationVersion": 3,
      "company": "우아한형제들",
      "position": "Backend Developer",
      "reason": "needsReview",
      "scheduleType": null,
      "nextActionAt": "2026-08-31",
      "canComplete": false
    }
  ],
  "upcomingSchedules": [
    {
      "applicationId": "uuid",
      "company": "우아한형제들",
      "position": "Backend Developer",
      "scheduleType": "test",
      "date": "2026-09-02"
    }
  ],
  "activeApplications": [
    {
      "applicationId": "uuid",
      "company": "우아한형제들",
      "position": "Backend Developer",
      "status": "test",
      "needsReview": true,
      "nextActionAt": "2026-09-02",
      "latestActivityTitle": "과제·테스트 상태가 되었습니다"
    }
  ]
}
```

`briefing.reason`은 `needsReview`, `openTask`, `upcomingSchedule`, `idle` 순서이고 count는
선택된 이유에 해당하는 전체 건수입니다.
priority는 확인 필요 항목과 오늘까지의 미완료 일정을 합쳐 현재 UI 정렬 규칙대로 5개,
upcoming은 오늘부터 6일 뒤까지의 미완료 일정 5개, active는 열린 지원을 다음 일정과 지원일 순으로
5개 반환합니다. `upcomingSchedule` 후보 범위는 오늘부터 6일 뒤까지입니다. home query는
per-row 조회가 아니라 set-based query로 구성합니다.
일정에서 파생한 overdue/today priority와 upcoming은 `rejected` application을 제외하지만,
`needsReview` priority는 현재 결과와 무관하게 유지합니다.
priority item의 `reason`은 `needsReview|overdue|today`입니다. needsReview item은 현재 UI와
같이 완료 여부와 무관한 기존 schedule 날짜 또는 `null`을 `nextActionAt`으로 주고,
렌더하지 않는 `scheduleType`은 `null`, `canComplete=false`입니다. overdue/today item은
미완료 일정의 non-null type/date와 현재 UI 규칙으로 계산한 `canComplete`를 줍니다. active
item의 `nextActionAt`은 가장 가까운 미완료 일정만 나타내며 일정이 없거나 모두 완료됐으면
`null`입니다. `latestActivityTitle`은 최근 activity title, 없으면 원본 `source` 표시
문자열을 서버가 넣는 non-null 문자열입니다.
메일 배너는 이 응답에 합치지 않고 connection state를 사용합니다.

### 지원 상세와 history

```http
GET /api/v1/applications/{applicationId}
```

응답은 편집에 필요한 application core와 memo, schedule summary만 반환합니다.

```json
{
  "id": "uuid",
  "version": 3,
  "company": "우아한형제들",
  "position": "Backend Developer",
  "location": "서울 송파구",
  "employmentType": "정규직",
  "appliedAt": "2026-08-14",
  "status": "test",
  "needsReview": true,
  "source": "Gmail 메일",
  "schedule": {
    "nextActionTitle": "과제 제출",
    "nextActionAt": "2026-08-30"
  },
  "memo": "면접 준비 메모"
}
```

일정이 없는 application의 `schedule`은 `null`입니다. 빈 문자열, 임의 날짜 또는
`nextActionCompleted=true`인 가짜 schedule로 표현하지 않습니다.
schedule을 core에 포함하므로 기존 `GET /applications/{applicationId}/schedule`은 web
migration 뒤 일반 화면에서는 호출하지 않습니다. 다만 Calendar Export preview가
`scheduleId`와 `expectedScheduleVersion`을 얻는 정본이므로 이 endpoint와 schedule
version은 유지합니다.

history는 기존 cursor endpoint를 그대로 사용합니다.

```http
GET /api/v1/applications/{applicationId}/emails?before={cursor}&limit=50
GET /api/v1/applications/{applicationId}/activities?before={cursor}&limit=50
GET /api/v1/applications/{applicationId}/changes?before={cursor}&limit=50
```

emails와 changes 응답은 `{ "items": [], "nextCursor": null, "totalCount": 0 }`, 전체
건수를 표시하지 않는 activities 응답은 `{ "items": [], "nextCursor": null }`입니다.
`totalCount`는 해당 첫 page와 같은 read snapshot의 사용자/application scope 전체 건수이며
web은 `items.length` 대신 이 값을 패널 count로 표시합니다. `nextCursor`가 있으면 해당
section에 더 보기를 표시합니다. 상세 core와 첫 history page를 병렬 조회하고 core가 준비되기
전에는 편집을 활성화하지 않습니다. mutation 응답은 core만 반환하며, 생성·삭제된 history가
있는 mutation 성공 후 해당 history 첫 page와 count를 갱신합니다.

### 캘린더 일정 조회

```http
GET /api/v1/calendar/schedules?from=2026-08-01&to=2026-08-31
```

`from/to`와 응답 `date`는 `Asia/Seoul` 기준 inclusive LocalDate이고 한 요청의 최대
범위는 62일입니다. 완료 일정과 `rejected` 지원은 제외합니다.

```json
{
  "items": [
    {
      "applicationId": "uuid",
      "company": "우아한형제들",
      "position": "Backend Developer",
      "status": "test",
      "needsReview": true,
      "title": "과제 제출",
      "date": "2026-08-30"
    }
  ]
}
```

일정 등록 다이얼로그의 지원 선택기는 plain 전체 select 대신
`/applications/page?status=schedulable&q={query}&page=0&limit=20` 기반 검색형 selector로
바꿉니다. 저장은 application schedule PATCH를 사용합니다. 독립 개인 일정 endpoint는
추가하지 않습니다.

### 지원 통계

기존 DB 집계 endpoint를 확장합니다.

```http
GET /api/v1/analytics/summary?from=2026-06-03&to=2026-08-31
```

30/90/180일은 web이 서울 기준 `to=today`, `from=today-(range-1)일`로 변환하고,
전체는 request의 `from`을 생략하며 response의 `from`은 `null`입니다.

```json
{
  "from": "2026-06-03",
  "to": "2026-08-31",
  "total": 12,
  "screeningPassed": 7,
  "reachedInterview": 4,
  "offered": 1,
  "monthlyFlow": [
    { "month": "2026-03", "count": 0 },
    { "month": "2026-04", "count": 0 },
    { "month": "2026-05", "count": 0 },
    { "month": "2026-06", "count": 4 },
    { "month": "2026-07", "count": 3 },
    { "month": "2026-08", "count": 5 }
  ],
  "sourceCounts": {
    "gmail": 5,
    "naver": 3,
    "manual": 3,
    "other": 1
  }
}
```

`screeningPassed`는 저장된 서류 통과 사실, `reachedInterview`는
`highestStatus >= interview`로 집계합니다. monthlyFlow는 `to`가 속한 월까지 정확히
6개를 오래된 월부터 오름차순으로 반환하고 0건인 달도 포함합니다. 각 count에는 요청의
`from/to`에 든 application만 포함합니다. sourceCounts는 저장된 provider/source type을
기준으로 양수인 key만 반환하는 sparse map입니다. 빠진 key는 0건이며 화면 row를 만들지
않습니다. 화면 표시 문자열의 prefix를 분석하지 않습니다. `other`는 화면에서 `기타`로
표시하고, 비율은 이 count들로 web이 계산합니다.

### 지원 생성

기존 endpoint를 사용합니다.

```http
POST /api/v1/applications
```

```json
{
  "mutationId": "uuid",
  "company": "우아한형제들",
  "position": "Backend Developer",
  "status": "applied"
}
```

현재 UI의 생성 다이얼로그는 회사, 포지션과 초기 단계만 입력합니다. 생성 후
application core를 반환합니다. 생성 request의 status는 현재 화면 선택지인
`applied|screening|test|interview|offer`를 허용합니다. 서버가 `source="직접 추가"`,
`sourceType=manual`을 설정하며 client에서 source를 받지 않습니다.

### 기본 정보 수정

```http
PATCH /api/v1/applications/{applicationId}/details
```

```json
{
  "mutationId": "uuid",
  "expectedVersion": 3,
  "company": "우아한형제들",
  "position": "Backend Developer",
  "location": "서울 송파구",
  "employmentType": "정규직",
  "appliedAt": "2026-08-14"
}
```

- `appliedAt`까지 같은 mutation에서 변경합니다.
- 실제로 바뀐 필드만 `changes`에 기록합니다.
- activity는 만들지 않습니다.
- 수정된 application core를 반환합니다.

### 진행 상태 변경

기존 endpoint의 request를 단일 값으로 정리합니다.

```http
POST /api/v1/applications/{applicationId}/status
```

```json
{
  "mutationId": "uuid",
  "expectedVersion": 3,
  "status": "test"
}
```

- 같은 상태면 중복 activity/change를 만들지 않습니다.
- terminal 상태에서 active pipeline 상태로 바꾸면 현재 결과를 active로 다시 열되
  `highestStatus`는 낮추지 않습니다.
- 변경 시 화면 표시 상태를 기준으로 activity와 change를 각각 하나 생성합니다.
- `needsReview`는 유지합니다.
- 수정된 application core를 반환합니다.

### 일정 등록·수정

현재 web의 date-only 편집은 아래 partial mutation을 사용합니다. 기존 `PUT /schedule`은
Calendar Export 등 full timed schedule API consumer를 위한 replacement 계약으로 유지하고,
두 writer 모두 같은 application→schedule lock/version 불변식을 지킵니다.

```http
PATCH /api/v1/applications/{applicationId}/schedule
```

```json
{
  "mutationId": "uuid",
  "expectedVersion": 3,
  "nextActionAt": "2026-08-30",
  "nextActionTitle": "포트폴리오 점검"
}
```

- aggregate `expectedVersion` 하나로 application과 schedule의 동시성을 보호합니다.
- `nextActionAt`과 `nextActionTitle`은 각각 생략할 수 있지만 둘 중 하나는 있어야 합니다.
  schedule이 없으면 `nextActionAt`이 필수이고, 있으면 생략한 값은 보존합니다.
- 두 field의 explicit JSON `null`은 일정 제거로 해석하지 않고 `400 ProblemDetail`로
  거부합니다. 기존 값 보존은 key를 생략했을 때만 적용합니다. web은 빈 제목을 `""`로
  보내고 현재 client payload의 `scheduleType`과 `null` normalization은 제거합니다.
- 기존 `scheduleType`, local time, duration, timezone, location, description을 보존합니다.
- 빈 제목은 기존 이름을 유지하고, 일정이 없을 때만 서버 기본 이름을 사용합니다.
- 저장하면 `nextActionCompleted=false`로 초기화합니다.
- activity와 실제 변경된 schedule 필드의 change를 생성합니다.
- 수정된 application core를 반환합니다.

일정 완료는 기존 endpoint를 사용합니다.

```http
POST /api/v1/applications/{applicationId}/schedule/complete
```

현재 web 화면에는 Calendar Export가 없지만 기존 공개 계약을 깨뜨리지 않습니다.

```http
GET /api/v1/applications/{applicationId}/schedule
POST /api/v1/calendar-exports/previews
```

schedule GET은 공통 `id`, `applicationId`, `applicationVersion`, `version`, `scheduleType`,
`action`, `location`, `description`, `completed`, `completedAt`과 아래 discriminator를
반환합니다.

- `allDay=true`: `date: LocalDate`가 필수이고 `scheduledAt`, `endsAt`, `timezone`은 `null`입니다.
- `allDay=false`: `date`는 `null`, `scheduledAt`과 `timezone`은 필수이며 `endsAt`은 nullable입니다.

```json
{
  "id": "uuid",
  "applicationId": "uuid",
  "applicationVersion": 3,
  "version": 2,
  "scheduleType": "test",
  "action": "과제 제출",
  "allDay": true,
  "date": "2026-08-30",
  "scheduledAt": null,
  "endsAt": null,
  "timezone": null,
  "location": "",
  "description": "",
  "completed": false,
  "completedAt": null
}
```

preview request의 `scheduleId`와 `expectedScheduleVersion`은 schedule GET의 `id/version`을
사용합니다. full timed `PUT /schedule`은 schedule이 없을 때 `expectedScheduleVersion`을
생략하면 생성하고, schedule이 있으면 해당 field가 필수인 conditional upsert입니다.
request의 기존 full timed fields는 모두 필수이며, all-day schedule에 실행하면 명시적인
timed replacement로 전환합니다. 응답은 schedule `id/version`과 새 application version을
반환합니다.

Calendar Export preview는 timed schedule만 받습니다. all-day schedule이면 `400
ProblemDetail`로 거부하고 full timed PUT으로 시각·timezone을 명시하라는 detail을
표시합니다. 이후 preview 조회·확인 계약은 그대로 유지합니다. 위 web PATCH에는 별도
schedule version을 받지 않고, internal import finalizer는 public version request 없이
같은 transaction에서 application aggregate version을 갱신합니다.

### 메모 저장

기존 endpoint를 사용합니다.

```http
PUT /api/v1/applications/{applicationId}/memo
```

UI의 여러 메모 블록은 빈 줄 두 개로 구분한 하나의 `memo` 문자열로 저장합니다.

### 확인 완료

개별 상세 화면은 기존 endpoint를 사용합니다.

```http
POST /api/v1/applications/{applicationId}/review/complete
```

지원 목록의 `일괄 확인`은 page와 무관하게 현재 사용자가 확인한 전체 검토 집합을
처리합니다. `/applications/page`가 준 `reviewRevision`을 snapshot 경계로 사용합니다.

```http
POST /api/v1/applications/review/complete-bulk
```

```json
{
  "mutationId": "uuid",
  "expectedReviewRevision": 9
}
```

- 같은 `mutationId`와 같은 revision 재시도는 최초 응답을 replay합니다.
- 사용자별 `reviewRevision`은 한 transaction에서 review set이 실제로 바뀌면 변경된
  application 수와 무관하게 정확히 1 증가합니다. 개별 확인과 bulk 확인을 포함해 실제
  membership을 바꾸는 모든 writer가 먼저 user review-state를 lock한 뒤 대상 application을
  ID 오름차순으로 lock합니다.
- bulk 서버는 이 순서로 lock하고 revision이 일치할 때만 현재 확인 필요 항목 전체를 한
  transaction에서 처리합니다. 관찰 뒤 새 항목이 생겼으면 `409`이고 web은 count/revision을
  다시 읽어 사용자의 재확인을 받습니다.
- 실제 변경된 각 항목에 change 하나만 생성합니다.
- 응답은 `{"completedCount": 2, "needsReviewCount": 0, "reviewRevision": 10}`이며 web은
  현재 page를 다시 읽습니다.

bulk replay는 단일 application 결과를 전제로 한 현재 `application_mutations` constraint에
억지로 넣지 않습니다. ledger가 `applicationId/resultingVersion/historyWatermark` 없는
user-scoped bulk payload도 저장하도록 명시적으로 확장합니다.

### 진행 타임라인 삭제

```http
DELETE /api/v1/applications/{applicationId}/activities/{activityId}
```

```json
{
  "mutationId": "uuid",
  "expectedVersion": 3
}
```

- activity가 현재 사용자와 application에 속하는지 검증합니다.
- 삭제는 현재 진행 상태를 되돌리지 않습니다.
- 삭제 사실을 change로 남깁니다.
- 수정된 application core를 반환합니다.

## 채용메일 연결 계약

현재 UI는 로그인 계정과 별개인 채용메일 연결 하나만 관리합니다. 사용자당
`provider IN (GMAIL, OUTLOOK, NAVER)`이고 `status != REVOKED`인 row는 최대 하나라는
불변식을 service transaction과 partial unique index로 함께 강제합니다. 다른 MAIL
연결이 있으면 새 연결은 `409`이고 사용자가 기존 연결을 먼저 해제해야 합니다. 기존
데이터가 이 불변식을 어기면 migration에서 어느 하나를 임의 선택하지 말고 명시적으로
revoke/reconcile한 뒤 constraint를 적용합니다.

### capability와 연결 상태

새 summary endpoint를 만들지 않고 기존 API를 사용합니다.

```http
GET /api/v1/connections/capabilities
GET /api/v1/connections?capability=mail&includeRevoked=false
```

기존 list에 일반 query filter를 추가하며 결과는 위 불변식 때문에 0개 또는 1개입니다.
`lastSyncedAt=null`인 연결 직후에는 shell과 settings 모두 날짜 formatter를 호출하지 않고
`동기화 전`으로 표시합니다.
`autoSyncEnabled`는 단순히 consent만 보지 않고 아래처럼 해석합니다.

| API 상태 | UI 처리 |
| --- | --- |
| 연결 없음 또는 `revoked` | 연결 안 됨, 연결 CTA |
| `connected`, `monitoringPaused=false` | 연결됨. `ongoingSyncConsent=true`일 때 자동 동기화 |
| `connected`, `monitoringPaused=true` | 자동 확인 일시 중지 경고와 resume action |
| `reauthorization_required` | Gmail/Outlook은 OAuth 재승인, Naver는 앱 비밀번호 재입력 또는 연결 해제 |
| `error`, `lastErrorCode=NAVER_LEDGER_MIGRATION_REQUIRED` | 데이터 마이그레이션 필요 안내, 동기화 비활성, 운영자 확인 필요 문구와 연결 해제만 표시 |
| `error` | Gmail/Outlook은 OAuth 재승인, Naver는 앱 비밀번호 재입력 또는 연결 해제 |

provider 버튼은 capabilities의 `available=true`일 때만 활성화합니다. 설정 UI의 현재
2-state indicator는 위 상태를 표현하도록 확장해야 합니다. web이 새 Outlook 연결을
제공하지 않더라도 기존 Outlook MAIL 연결은 숨기지 않고 상태와 해제 action을 보여줍니다.

### provider 연결

기존 OAuth 경로를 그대로 사용합니다.

```http
POST /api/v1/connections/gmail/oauth/begin
POST /api/v1/connections/gmail/oauth/complete
```

1. begin에 현재 origin의 allowlisted callback `redirectUri`를 보냅니다.
2. 응답 `authorizationUrl`로 이동합니다.
3. backend는 begin의 `redirectUri`를 challenge에 보관합니다. callback의 `state`와
   `code`만 complete에 보내고, token 교환에는 보관한 동일 redirectUri를 사용합니다.
4. 입력창의 Gmail 주소가 아니라 provider가 검증해 complete 응답에 담은
   `accountEmail`을 연결 계정 정본으로 표시합니다.

- 연결 안내 동의 여부와 provider authorization 성공을 연결 성공으로 혼동하지 않습니다.
- complete의 network/`409`/`5xx`로 결과가 모호하면 filtered connection을 다시 읽습니다.
  해당 provider가 `connected`이면 성공으로 복구하고, 아니면 소비 여부를 모르는 code를
  반복 전송하지 않고 새 begin부터 다시 시작합니다.
- 현재 연결 안내 checkbox는 자동 모니터링 동의가 아니므로 complete의
  `ongoingSyncConsent`는 `false`입니다. 연결 뒤 별도 자동 동기화 toggle에서만 켭니다.
- 기존 Outlook 연결의 재승인은 같은 provider-param OAuth 흐름을 사용합니다.

최신 UI가 Naver 지원을 명시하므로 inferred provider가 Naver일 때만 앱 비밀번호 입력을
같은 dialog에 추가하고 기존 endpoint를 연결합니다. Naver submit은 account email,
non-blank app password, 안내 동의가 모두 있을 때만 활성화합니다.

```http
POST /api/v1/connections/naver
```

```json
{
  "accountEmail": "career@naver.com",
  "appPassword": "provider-app-password",
  "ongoingSyncConsent": false
}
```

- 계정과 app password를 provider에 검증한 뒤에만 연결 성공으로 처리합니다.
- app password는 TLS request body로만 보내며 persistent web state, log, analytics에
  보관하지 않고 submit/close 즉시 입력값을 지웁니다. backend는 암호화 저장하고 어떤
  response에도 credential을 반환하지 않습니다.
- 연결 안내 checkbox는 여기서도 자동 모니터링 동의가 아니므로 false로 시작합니다.
- Naver capability가 backend 설정상 unavailable이면 입력 단계와 submit을 비활성화하고
  capability notes를 표시합니다.
- 기존 connection이 `NAVER_LEDGER_MIGRATION_REQUIRED`이면 credential 검증에 성공해도 해당
  error와 collection block을 보존하고 일반 연결 성공으로 표시하지 않습니다.

### 자동 동기화

기존 monitoring consent endpoint를 사용합니다.

```http
PATCH /api/v1/connections/{connectionId}/monitoring-consent
```

web의 `autoSyncEnabled`는 request의 `enabled`, response의
`ongoingSyncConsent && status==connected && !monitoringPaused`에 대응합니다. 동의는
유지됐지만 pause된 연결의 재개는 기존
`POST /connections/{connectionId}/monitoring/resume`를 사용합니다.

### 수동 동기화

UI 전용 wrapper를 만들지 않고 기존 import-run 생성 API를 canonical command로 사용합니다.

```http
POST /api/v1/import-runs
GET /api/v1/import-runs?page=0&size=1
GET /api/v1/import-runs/{runId}
```

```json
{
  "mutationId": "uuid",
  "connectionId": "uuid"
}
```

`dateFrom/dateTo`는 기존 명시적 import client를 위해 선택 필드로 유지하되 둘을 함께
보내거나 함께 생략해야 합니다. 현재 설정 UI는 둘 다 생략합니다. 생략 시 서버는
`Asia/Seoul` 오늘을 `dateTo`로, 최초 실행은 `today - 7일`, 이후 실행은
`min(today, Asia/Seoul LocalDate(lastSyncedAt)) - 1일`을 후보 `dateFrom`으로 사용하고
최대 10년 범위로 clamp합니다. 기존 provider-message ledger가 이 1일 overlap의 중복을
제거합니다.

- 같은 mutationId와 같은 body는 같은 `ImportRunResponse`를 replay합니다.
- run list는 `createdAt DESC`입니다. 현재 사용자의 같은 connection에 다른 mutation의
  active run이 있으면 `409`입니다. 이 run이 사용자 자신의 최신 run이므로 web은 run
  list의 첫 항목을 읽어 기존 실행 상태를 표시합니다.
- 같은 provider account가 다른 사용자 scope의 run으로 처리 중이면 다른 run 정보를
  노출하지 않고 generic `429 ProblemDetail`과 `Retry-After`를 반환합니다. web은 detail을
  표시하고 그 시간 뒤 같은 create request를 재시도합니다.
- 응답은 `202 Accepted`의 기존 `ImportRunResponse`이고 web은 `id`, `connectionId`,
  `status`, `errorCode`만 소비해 run detail을 terminal 상태까지 poll합니다. 현재 UI가
  표시하지 않는 application 생성·갱신·실패 count를 새 public field로 추가하지 않고 기존
  count field도 완료 판단이나 화면 문구에 사용하지 않습니다.
- 완료 후 `GET /connections`를 다시 읽어 `lastSyncedAt`과 상태를 갱신합니다.
- connection의 `lastSyncedAt` checkpoint는 모든 message가 terminal이고 run을 `COMPLETED`로
  바꾸는 같은 transaction에서만
  `max(previous, min(completedAt, startOfDay(dateTo + 1, Asia/Seoul)))`로 전진합니다.
  `FAILED|CANCELLED` run에서는 바꾸지 않아 다음 기본 overlap run이 rollback된 message를
  다시 수집할 수 있게 합니다. 명시적 과거 기간 run의 실패는 같은 명시적 기간으로 다시
  실행합니다.
- 명시적 기간은 미래를 포함할 수 없고 최대 10년이라는 기존 검증을 유지합니다.

### 자동 분류 finalize

최신 settings 문구와 기존 확인 UX를 정본으로 삼습니다. import run은 메일을 내부 draft로
분석하는 데서 끝나지 않고 application 생성·갱신까지 완료해야 terminal입니다. 새 pipeline은
draft row를 만들지 않으며 `import_drafts`는 배포 전에 구버전에서 결정한 row의 audit
retention에만 사용합니다.
web에 public draft API나 별도 `/settings/imports` 승인 화면을 추가하지 않습니다.

메일을 application에 연결하는 규칙은 다음 하나입니다.

1. 같은 사용자의 provider process binding이 수집한 `providerProcessKeys` 중 하나 이상과
   일치하고 모두 같은 application을 가리키면 그 application을 선택하고, 같은 transaction에서
   set의 미등록 key를 모두 그 application에 claim/bind한 뒤 갱신합니다.
2. 일치하는 binding이 없으면 company/position text로 추측 병합하지 않고 새 application을
   만든 뒤 모든 process key binding을 기록합니다. key들이 서로 다른 application을
   가리키면 자동 병합하지 않고 `PROCESS_BINDING_CONFLICT`로 transaction을 실패시킵니다.
3. provider-message ledger가 이미 terminal 처리한 message면 application을 다시 바꾸지
   않습니다. 기존 `DRAFTED` row는 terminal 처리로 보지 않습니다.

생성 또는 실제 semantic update가 있으면 imported application의 `needsReview=true`로
만들어 기존 목록/상세의 `확인 필요` 흐름에 바로 나타냅니다. 처음 처리한 관련 message를
기존 application history에 연결하는 것도 semantic update입니다. 이미 true인 application은
membership이 그대로이고, false→true 또는 새 review application이 생길 때만 같은
transaction에서 `reviewRevision`을 정확히 1 올립니다. finalizer는 user review-state,
provider message key와 process key set을 각각 정렬한 ledger/binding row, application ID 오름차순,
schedule 순서로 lock합니다.

같은 process key의 동시 finalizer는 위 순서로 binding unique key를 claim합니다. insert
conflict면 전체 key set의 binding을 다시 읽어 모두 같은 winner application일 때만 진행하며,
서로 다른 application이거나 다른 사용자 소유를 가리키면 전체 transaction을
`PROCESS_BINDING_CONFLICT`로 실패시킵니다. process key set이 빈
candidate는 binding을 만들지 않고 새 application으로 finalize합니다.

collector candidate 전부가 finalizer 입력이며 finalizer가 transaction 안에서 analyzer를
실행합니다. analyzer가 무관하다고 판정한 message는 application을 만들지 않고 ledger의 terminal
`IGNORED`로 기록합니다. analyzed message의 ledger claim/`FINALIZED` 전환, application,
schedule, history, binding과 reviewRevision 변경은 하나의 DB transaction입니다. 이 transaction
안에서만 terminal ledger row를 commit하며 중간 `DRAFTED` reservation을 먼저 commit하지
않습니다. 어느 semantic write라도 실패하면 해당 message의 ledger를 포함해 전부 rollback한
뒤 run을 `FAILED`와 `errorCode`로 닫습니다. 이후 사용자가 새로 실행하거나 monitor가 만든
run이 같은 message를 다시 처리할 수 있습니다. 따라서 unique ledger conflict로 읽은
`FINALIZED|IGNORED`만 이미 처리된 message이고, `DRAFTED`나 rollback된 시도는 duplicate가
아닙니다.

- 진행 상태, `highestStatus`와 `screeningPassed`는 위 canonical 규칙으로 monotonic merge합니다.
- imported schedule은 더 최신 provider evidence이고 사용자가 수동 편집하지 않았으며
  해당 메일 이후 완료한 일정도 아닐 때만 merge합니다. 없으면 timed schedule을 생성하고,
  실제 변경 시 application aggregate version도 올립니다.
- 신규 application의 source display/type은 provider 기준으로 저장하고 원본 email/activity
  history를 같은 transaction 경계에 연결합니다.
- 수집한 message는 이미 terminal ledger에 있는 기처리, analyzer의 `IGNORED`, 또는
  application/history까지 원자적으로 반영한 `FINALIZED`로 내부 종결합니다. 어느 message든
  이 결과에 도달하지 못하면 run을 `FAILED`와 `errorCode`로 닫습니다. `COMPLETED` run의 내부 회계는
  `scanned = ignored + finalized + duplicate`여야 하며, history만 새로 연결한 related
  message도 `finalized`입니다. 전부 종결된 뒤에만 run을 `COMPLETED`로 표시합니다.
- 기존 pending draft는 배포 전에 구버전 public UI에서 승인 또는 거절합니다. V3의
  `PENDING=0` 검증을 통과한 뒤 새 버전은 public `/import-drafts` endpoint를 제공하지 않습니다.

### 연결 해제

기존 endpoint를 사용합니다.

```http
DELETE /api/v1/connections/{connectionId}
```

이미 생성된 지원 이력, 메모와 일정은 유지하고 이후 동기화만 중지합니다.

## 인증 계약

Google 로그인에 필요한 `/api/v1/auth/challenges`, `/exchange`, `/me`, `/logout`은 현재
web BFF에 연결되어 있습니다. session token은 browser JavaScript에 노출하지 않습니다.

Kakao 버튼은 실제 API 모드에서 비활성 상태이므로 이번 API 범위에 포함하지 않습니다.

## mutation과 오류 계약

application mutation과 수동 import 생성은 client가 만든 `mutationId`를
사용합니다.
같은 사용자, 같은 mutationId, 같은 operation/body는 최초 성공 응답을 replay하고, 같은
mutationId를 다른 body에 재사용하면 `409`입니다. optimistic mutation은 현재 core 또는
list item의 `version`을 `expectedVersion`으로 보냅니다.

오류 body는 backend가 이미 사용하는 RFC 9457 `ProblemDetail`입니다.

```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "다른 변경이 먼저 저장되었습니다. 최신 내용을 확인한 뒤 다시 시도해 주세요."
}
```

web 오류 파서는 `message`가 아니라 `detail`을 읽습니다. backend의 모든 `429`는 서버가
계산한 최소 대기 시간인 양의 delta-seconds `Retry-After`를 생성합니다. `/api/backend/*`와
`/api/auth/*` BFF는 upstream status/body, `Content-Type: application/problem+json`과
`Retry-After`를 보존합니다. 두 BFF와 mock API가 자체 생성하거나 변환하는 모든 non-2xx
body도 `403/502`를 포함해 같은 ProblemDetail과 content type으로 정규화합니다.

| status | 의미와 web 처리 |
| --- | --- |
| `400` | validation 오류. 입력을 유지하고 `detail` 표시 |
| `401` | session 만료. BFF cookie를 정리하고 로그인 화면으로 이동 |
| `403` | CSRF/origin 검증 실패. action을 중단하고 page/session을 새로고침 |
| `404` | 없거나 다른 사용자 소유인 resource. 같은 응답으로 정보 노출 방지 |
| `409` | version/mutation/active-run 충돌. 해당 core, page 또는 run을 다시 조회 |
| `424` | 외부 provider 재승인 필요. connection을 다시 조회해 상태 action 표시 |
| `429` | rate limit 또는 provider account busy. `Retry-After` 동안 action 비활성화 |
| `502` | upstream 응답 형식 오류. 현재 입력을 유지하고 재시도 경로 표시 |
| `503` | 일시 장애. 현재 성공 상태를 유지하고 재시도 경로 표시 |

별도 machine-readable error code는 현재 UI 분기에 필요하지 않으므로 추가하지 않습니다.
지속 상태인 connection/import 오류는 기존 `lastErrorCode`와 `errorCode`를 사용합니다.

## 구현 단계

### Backend 변경

1. application과 import 흐름에 persisted `test`, monotonic `highestStatus`, 단일 public
   `status`를 추가하고 상태 변경에서 `needsReview` 자동 해제를 제거합니다.
2. `/applications/counts`와 `/applications/page`의 UI filter/aggregate count를 추가하고
   legacy capped list를 제거합니다.
3. home top-N, calendar range read model과 기존 analytics 집계를 구현합니다.
4. detail을 core로 줄이고 기존 history cursor endpoint를 정본으로 유지합니다.
5. 기본 정보의 `appliedAt`, partial schedule PATCH, bulk review, activity 삭제를
   구현합니다.
6. 모든 schedule writer가 application aggregate version을 올리는 불변식을 적용합니다.
7. 사용자당 non-revoked MAIL 최대 1개 constraint와 service 검증을 적용합니다.
8. collector에 provider별 stable message/process key를 보존하고 import-run request의
   optional range/mutation replay, terminal message ledger, unique process binding과 자동
   finalizer를 구현합니다. 기존 pending draft는 V3 전에 구버전에서 모두 결정합니다.
9. 모든 backend `429`에 `Retry-After`가 있는 ProblemDetail을 반환합니다.

### Frontend 연결

1. 전역 전체-list provider를 route-owned query state와 shell count state로 분리합니다.
   열린 상세 tab은 `id/company/position/returnPath`만 shell state에 보관합니다.
2. 지원 목록을 server-side search/filter/page와 bulk review에 연결합니다.
3. 상세 core와 세 history page를 병렬 조회하고 더 보기와 mutation 후 refresh를
   연결합니다.
4. API `status`와 UI display status 변환을 한 함수에서만 수행합니다.
5. 홈, 캘린더와 analytics를 각 bounded read model에 연결합니다.
6. capabilities, connection 상태, Gmail OAuth, Naver app-password, monitoring,
   import-run polling과 revoke를 설정에 연결하고 terminal run 뒤 application count/list를
   무효화합니다.
7. ProblemDetail `detail` 파싱과 status별 복구 동작을 공통 API client로 통합합니다.
8. 지원 API 외 리소스를 연결할 때 BFF allowlist에 필요한 root만 추가합니다.

## 추가하지 않는 API

아래 중복 또는 무제한 경로는 만들지 않습니다.

- 무제한 `GET /api/v1/applications`
- `GET /api/v1/connections/mail`
- `POST /api/v1/connections/{connectionId}/sync`
- `POST /api/v1/calendar/schedules`
- UI 전용 `GET /api/v1/analytics/summary?range=...` 확장
- `POST /api/v1/mail/sync`
- `PATCH /api/v1/mail/sync-settings`
- `status`와 함께 받는 `progressStatus`
- `nextAction`과 `nextActionTitle`을 함께 유지하는 응답 호환 필드

## 완료 검증

- 설정 화면에 진입할 때 application item 목록을 내려받지 않아야 합니다.
- 200건이 넘는 지원에서도 shell/list count, home briefing count와 analytics count가 정확하고,
  list/calendar/history 응답은 각각 page/range/cursor 범위를 넘지 않아야 합니다.
- 상세 URL 직접 진입에서도 서버 상세 데이터가 로드되고 기존 메모를 빈 값으로
  덮어쓰지 않아야 합니다.
- email/activity/change가 51개 이상일 때 더 보기로 마지막 항목까지 접근할 수 있어야
  하고, 관련 메일과 변경 기록 panel count는 로드한 page 수가 아니라 전체 건수여야 합니다.
- 진행 상태를 `test`로 저장한 뒤 일정을 바꾸거나 새로고침해도 상태가 유지되어야
  합니다.
- `needsReview=true`인 row는 review와 all 필터에만 나타나고, schedule selector에서는
  `rejected`가 아닌 한 나타나야 합니다.
- imported timed schedule의 날짜나 제목을 web에서 수정해도 숨겨진 시각, duration,
  timezone, location과 description이 보존되어야 합니다.
- 진행 상태 변경만으로 `needsReview`가 사라지지 않아야 합니다.
- bulk review 응답 유실 뒤 같은 mutation을 재시도해도 이후 생긴 확인 필요 항목은
  해제되지 않아야 합니다.
- 개별 확인, bulk 확인과 automatic import finalizer를 동시에 실행해도 deadlock 없이
  `reviewRevision` 순서로 직렬화되어야 합니다. finalizer는 새 review membership이나
  false→true 변경이 있을 때만 revision을 한 번 올려야 합니다.
- 일정 등록, 완료와 타임라인 삭제 응답은 최신 application version을 반환하고, bulk
  review는 최신 `reviewRevision`을 반환해야 합니다.
- 동시에 두 MAIL 연결을 만들 수 없어야 하고 숨겨진 연결이 background sync되지 않아야
  합니다.
- Gmail OAuth callback, 수동 동기화, pause/resume, 자동 동기화 변경과 연결 해제가
  새로고침 후에도 정확한 상태로 복원되어야 합니다.
- 연결 직후 `lastSyncedAt=null`은 shell과 settings에서 `동기화 전`으로 보여야 합니다.
- Naver 연결은 app password 없이는 제출되지 않고 credential이 response, log 또는
  persistent web state에 남지 않아야 합니다.
- Naver mailbox의 UIDVALIDITY가 바뀌어도 RFC `Message-ID`가 같은 메일은 application/history와
  review revision을 다시 바꾸지 않아야 합니다.
- 기존 UID-only Naver ledger row는 exact backfill 또는 첫 dual-key lookup에서 stable key로
  승격될 때 application/history/review revision을 바꾸지 않아야 합니다.
- `NAVER_LEDGER_MIGRATION_REQUIRED`는 credential 또는 같은 account 재연결만으로 사라지지
  않고, audited operator reconciliation과 unresolved/collision 0건 검증 뒤에만 해제돼야 합니다.
- import run은 수집한 모든 message가 기처리, `IGNORED` 또는 `FINALIZED`로 종결됐을 때만
  `COMPLETED`여야 합니다. 처리 실패 transaction은 rollback되고 현재 run은 `FAILED`가 되며,
  후속 run에서 같은 message를 다시 처리할 수 있어야 합니다.
- 새로 만들거나 실제로 갱신한 imported application은 목록/상세의 `needsReview=true`로
  나타나고, duplicate message는 application이나 review revision을 바꾸지 않아야 합니다.
- calendar selector에는 `offered`가 포함되고 `rejected`만 제외되어야 합니다.
- Calendar Export preview는 schedule GET의 version으로 기존 optimistic contract를
  계속 사용할 수 있어야 합니다.
- analytics monthlyFlow는 모든 기간 선택에서 `to` 월까지 zero-filled 6개여야 합니다.
- 다른 사용자 scope에서 같은 provider account를 처리 중인 경우 run 정보 없이
  `429`와 `Retry-After`만 보여야 합니다.
- `409`에서는 관련 scope를 다시 읽고, API `ProblemDetail.detail`이 사용자 오류 문구로
  표시되어야 합니다.
- BFF/mock 자체 `403/502`를 포함한 모든 non-2xx와 backend `429` fixture도 ProblemDetail
  content type과 `Retry-After` 전달을 검증해야 합니다.
- web의 consumer contract test는 빈 배열이 아닌 실제 `jobvis-api` 응답 fixture로
  page·home·detail/history·calendar·analytics·connection·import-run/finalizer·mutation shape를
  검증해야 합니다.
