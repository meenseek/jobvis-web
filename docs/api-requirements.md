# Jobvis API Change Requirements

이 문서는 현재 `jobvis-api` 구현을 기준으로, `jobvis-web` 화면과 클라이언트 코드에 맞추기 위해 **변경해야 하는 API**와 **추가해야 하는 API**만 정리합니다.

웹은 `/api/backend/*` Next Route Handler를 통해 백엔드 `/api/v1/*`로 프록시합니다.

## 우선순위

| 우선순위 | 구분 | 대상 | 필요한 이유 |
| --- | --- | --- | --- |
| P0 | 변경 | 지원 기본 정보 수정 | web 기본정보 편집에서 `appliedAt`을 함께 저장함 |
| P0 | 변경 | 지원 진행 상태 변경 | web 상태 체계에 `과제·테스트`가 있고, 현재 backend stage만으로는 구분이 부족함 |
| P0 | 변경 | 일정 등록/수정 | web은 날짜 중심 일정 등록을 기대하지만 backend는 상세 schedule 수정 payload를 요구함 |
| P0 | 추가 | 진행 타임라인 삭제 | 상세 타임라인 row hover 삭제 버튼이 API를 필요로 함 |
| P1 | 변경 | 지원 목록 응답 | 홈/목록/캘린더에서 `nextActionTitle`, 최근 변화 표시가 필요함 |
| P1 | 추가 | 확인 필요 일괄 완료 | 지원내역에서 확인 필요 항목을 한 번에 처리해야 함 |
| P1 | 추가/변경 | 메일 연결 요약/동기화 | 홈/설정 배너와 수동/자동 동기화 UI에 맞는 응답 형태가 필요함 |
| P2 | 변경 | 통계 요약 | web 통계 화면의 기간 필터와 차트 형태에 맞는 집계가 필요함 |
| P2 | 추가 | 캘린더 전용 일정 조회 | 캘린더가 지원 목록에서 일정을 역산하지 않고 일정만 조회할 수 있어야 함 |

## 상태 체계 정리

web에서 쓰는 표시 상태는 아래 기준입니다. `확인 필요`는 진행 상태가 아니라 `needsReview` 플래그입니다.

| 화면 표시 | web 값 | backend 저장 기준 |
| --- | --- | --- |
| 지원·서류 | `application` | `stage=applied` 또는 `stage=screening` |
| 과제·테스트 | `test` | `stage=screening`, `scheduleType=test` |
| 면접 진행 | `interview` | `stage=interview` |
| 처우 협의 | `offer` | `stage=offer` |
| 최종 합격 | `offered` | `result=offered` |
| 전형 종료 | `rejected` | `result=rejected` |
| 확인 필요 | `review` | `needsReview=true` |

backend의 `ApplicationStage` label은 현재 `지원 완료`, `서류 검토`, `면접 진행`, `처우 협의`입니다. web 화면에서는 `지원 완료`와 `서류 검토`를 묶어 `지원·서류`로 보여주고, `scheduleType=test`일 때 `과제·테스트`로 보여줍니다.

## 변경 필요

### 1. 기본 정보 수정에 `appliedAt` 반영

대상:

```http
PATCH /api/v1/applications/{applicationId}/details
```

web 요청:

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

필요한 변경:

- `UpdateDetailsRequest`에 `appliedAt: LocalDate` 추가
- application entity 업데이트 로직에 `appliedAt` 변경 반영
- 변경 이력에 `지원일` 변경 기록 추가
- 응답 `ApplicationResponse.appliedAt`은 변경된 날짜로 반환

처리 기준:

- 기본정보 편집은 회사명, 포지션, 근무지, 고용형태, 지원일만 수정합니다.
- 다음 일정은 여기서 수정하지 않습니다.
- 변경된 필드만 `changes`에 남깁니다.
- activity는 만들지 않습니다.

### 2. 진행 상태 변경에 `progressStatus` 지원

대상:

```http
POST /api/v1/applications/{applicationId}/status
```

web 요청:

```json
{
  "mutationId": "uuid",
  "expectedVersion": 3,
  "status": "screening",
  "progressStatus": "test"
}
```

필요한 변경:

- `UpdateStatusRequest`에 선택 필드 `progressStatus` 추가
- `progressStatus=test`이면 `stage=screening`, `scheduleType=test`로 저장
- `progressStatus=application`이면 `stage=screening` 또는 기존 정책값, `scheduleType=application`으로 저장
- `offered`, `rejected`는 `stage`가 아니라 `result` 변경으로 처리
- 타임라인/activity 문구는 화면 표시 상태 기준으로 생성

상태별 activity title:

| progressStatus | activity title |
| --- | --- |
| `application` | `지원·서류 상태가 되었습니다` |
| `test` | `과제·테스트 상태가 되었습니다` |
| `interview` | `면접 진행 상태가 되었습니다` |
| `offer` | `처우 협의 상태가 되었습니다` |
| `offered` | `최종 합격 상태가 되었습니다` |
| `rejected` | `전형 종료 상태가 되었습니다` |

처리 기준:

- 상태 변경 시 진행 타임라인 activity와 변경 기록 change를 모두 생성합니다.
- 같은 상태로 저장하면 중복 activity/change를 만들지 않습니다.
- `needsReview=true`인 지원건의 상태를 변경해도 자동으로 확인 완료 처리할지는 정책 결정이 필요합니다. 현재 web UX에서는 확인 완료 버튼을 별도로 보여줍니다.

### 3. 일정 등록/수정 payload를 web에 맞게 단순화

대상:

```http
PATCH /api/v1/applications/{applicationId}/schedule
```

web 요청:

```json
{
  "mutationId": "uuid",
  "expectedVersion": 3,
  "nextActionAt": "2026-08-30",
  "nextActionTitle": "포트폴리오 점검",
  "scheduleType": "other"
}
```

필요한 변경:

- web이 호출하는 `PATCH /schedule` 지원
- date-only `nextActionAt`을 서버 기준 timezone으로 저장 가능한 schedule 시각으로 변환
- `nextActionTitle`을 schedule action/title로 저장
- `scheduleType`은 web 내부 분류값 그대로 수용
- 응답은 수정 후 `ApplicationResponse` 반환

현재 web UX 기준:

- 캘린더 상단 `일정 등록` 버튼은 기본 날짜를 오늘로 열고, 다이얼로그에서 날짜를 선택합니다.
- 선택 날짜 패널에서 일정 추가 시 선택된 날짜를 기본값으로 사용합니다.
- 캘린더 다이얼로그에는 일정 종류 선택이 없습니다.
- 일정 종류는 선택한 지원건의 현재 진행 상태/scheduleType을 기준으로 backend가 정하거나 web이 숨겨진 값으로 전달합니다.

처리 기준:

- 일정 등록/수정 시 `nextActionCompleted=false`로 초기화합니다.
- 진행 타임라인 activity를 생성합니다.
- 변경 기록 change를 생성합니다.
- `nextActionAt=null`이면 다음 일정 제거로 처리할지 별도 endpoint로 분리할지 정책 결정이 필요합니다.

### 4. 지원 응답에 `nextActionTitle` 추가

대상:

```http
GET /api/v1/applications
GET /api/v1/applications/{applicationId}
```

필요한 변경:

- `ApplicationResponse`와 목록 item 응답에 `nextActionTitle: String?` 추가
- 기존 `nextAction`은 호환이 필요하면 유지하되, web에서는 `nextActionTitle`을 우선 사용
- schedule의 `action` 값을 `nextActionTitle`로 내려줌

필요한 이유:

- web의 `Application` 모델은 `nextActionTitle`을 사용합니다.
- 캘린더 선택 날짜 패널과 상세 진행 요약에서 일정명 표시가 필요합니다.

### 5. 지원 목록 응답에 홈/목록 표시용 최근 변화 추가

대상:

```http
GET /api/v1/applications
GET /api/v1/applications/page
```

필요한 변경:

- 목록 item에 최근 activity 요약 필드 추가

권장 응답 필드:

```json
{
  "latestActivity": {
    "id": "uuid",
    "type": "status",
    "title": "면접 진행 상태가 되었습니다",
    "description": "현재 지원 진행 상황에 반영했습니다.",
    "occurredAt": "2026-08-30T09:00:00Z"
  }
}
```

필요한 이유:

- 홈 `진행 중인 지원`은 상태 badge와 함께 최근 변화를 보여줍니다.
- 목록 응답만으로 홈을 구성하려면 최신 activity가 필요합니다.
- 상세 화면은 별도 `GET /applications/{id}`를 호출해 전체 emails/activities/changes/memo를 받는 방식이 더 적합합니다.

### 6. 메일 연결 상태를 web 배너/설정 UI에 맞게 정규화

대상 후보:

```http
GET /api/v1/connections/mail
```

또는 기존 connection list 응답에 web용 derived 필드를 추가합니다.

web에서 필요한 형태:

```json
{
  "connected": true,
  "connectionId": "uuid",
  "provider": "naver",
  "accountEmail": "user@example.com",
  "status": "connected",
  "autoSyncEnabled": true,
  "lastSyncedAt": "2026-08-30T09:00:00Z",
  "nextSyncAfter": "2026-08-30T10:00:00Z",
  "monitoringPaused": false,
  "lastErrorCode": null,
  "version": 2
}
```

필요한 이유:

- 홈 메일 연결 온보딩 배너
- 설정의 메일 동기화 상태
- 수동 동기화/자동 동기화 버튼 상태
- 로그인 계정 표시와 채용메일 계정 표시를 분리해야 함

처리 기준:

- 로그인 계정 이메일과 채용메일 연결 계정은 다른 개념입니다.
- 설정 화면에서 보여줄 이메일은 `accountEmail`이어야 합니다.
- 메일 미연결이면 홈/설정 모두 같은 배너 컴포넌트로 연결 CTA를 보여줍니다.

### 7. 수동 동기화 API 응답을 설정 UI에 맞게 조정

대상 후보:

```http
POST /api/v1/mail/sync
```

또는 import run 생성 API를 web에서 쓰기 쉽게 감싼 endpoint를 추가합니다.

web 요청:

```json
{
  "connectionId": "uuid",
  "dateFrom": "2026-08-01",
  "dateTo": "2026-08-30"
}
```

web에서 필요한 응답:

```json
{
  "runId": "uuid",
  "status": "queued",
  "scannedCount": 0,
  "draftCount": 0,
  "duplicateCount": 0,
  "startedAt": null,
  "completedAt": null
}
```

필요한 이유:

- 설정 페이지의 `수동 동기화` 버튼 클릭 후 진행 상태/결과 표시가 필요합니다.
- 동기화 후 `lastSyncedAt`을 다시 갱신할 수 있어야 합니다.

### 8. 자동 동기화 설정 API 응답을 설정 UI에 맞게 조정

대상 후보:

```http
PATCH /api/v1/mail/sync-settings
```

또는 connection monitoring consent API를 web UI 용어로 매핑합니다.

web 요청:

```json
{
  "connectionId": "uuid",
  "expectedVersion": 2,
  "autoSyncEnabled": true
}
```

web에서 필요한 응답:

```json
{
  "connectionId": "uuid",
  "autoSyncEnabled": true,
  "nextSyncAfter": "2026-08-30T10:00:00Z",
  "version": 3
}
```

필요한 이유:

- 설정에서 자동 동기화 토글을 제공합니다.
- 연결 상태 배너와 설정 화면이 같은 상태값을 봐야 합니다.

### 9. 통계 요약을 현재 차트 구성에 맞게 확장

대상:

```http
GET /api/v1/analytics/summary
```

web query:

```http
GET /api/v1/analytics/summary?range=90
GET /api/v1/analytics/summary?range=all
```

필요한 변경:

- `range=30|90|180|all` 지원 또는 web이 `from/to`로 변환할 수 있도록 기준을 명확히 문서화
- 월별 지원 흐름 차트용 series 추가
- 전형 단계 전환 차트용 conversion metrics 추가
- 지원 이력 출처 차트용 source breakdown 추가

권장 응답:

```json
{
  "range": "90",
  "from": "2026-06-01",
  "to": "2026-08-30",
  "summary": {
    "total": 12,
    "active": 8,
    "offered": 1,
    "rejected": 3,
    "screeningPassRate": 41.7,
    "interviewRate": 33.3,
    "offerRate": 8.3
  },
  "monthlyFlow": [
    { "month": "2026-06", "applied": 3, "screening": 2, "interview": 1, "offered": 0 }
  ],
  "conversion": [
    { "label": "서류 합격률", "value": 41.7 },
    { "label": "면접 진행률", "value": 33.3 },
    { "label": "최종 합격률", "value": 8.3 }
  ],
  "sources": [
    { "label": "직접 추가", "count": 4 },
    { "label": "메일 자동 분류", "count": 8 }
  ]
}
```

필요한 이유:

- 현재 web 통계 화면은 기간 선택을 오른쪽 정렬된 작은 select로 보여주고, 차트만 카드로 표현합니다.
- `전체 지원 100%`를 차트 항목으로 보여주는 방식은 제거하고, 총 지원건 대비 전환율을 보여줘야 합니다.

## 추가 필요

### 1. 진행 타임라인 삭제

대상:

```http
DELETE /api/v1/applications/{applicationId}/activities/{activityId}
```

web 요청:

```json
{
  "mutationId": "uuid",
  "expectedVersion": 3
}
```

응답:

```json
{
  "id": "application-id",
  "version": 4,
  "activities": [],
  "changes": []
}
```

필요한 처리:

- 해당 activity가 사용자의 지원건에 속하는지 검증
- activity 삭제
- 삭제 자체를 변경 기록에 남김
- 수정 후 `ApplicationResponse` 반환

변경 기록 예:

```json
{
  "title": "진행 타임라인",
  "description": "과제·테스트 상태가 되었습니다 → 삭제됨",
  "occurredAt": "2026-08-30T09:00:00Z"
}
```

정책:

- activity 삭제는 상태를 되돌리지 않습니다.
- 상태를 되돌리는 기능은 별도 상태 변경 API로 처리합니다.

### 2. 확인 필요 일괄 완료

대상:

```http
POST /api/v1/applications/review/complete-bulk
```

web 요청:

```json
{
  "mutationId": "uuid",
  "applicationIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

응답:

```json
{
  "updatedIds": ["uuid-1", "uuid-2"],
  "skippedIds": ["uuid-3"],
  "applications": []
}
```

필요한 처리:

- `needsReview=true`인 항목만 `false`로 변경
- 각 항목에 변경 기록 추가
- 이미 확인 완료된 항목은 `skippedIds`로 반환
- web은 버튼 클릭 전 확인 다이얼로그를 보여줍니다.

### 3. 캘린더 전용 일정 조회

대상 후보:

```http
GET /api/v1/calendar/schedules?from=2026-08-01&to=2026-08-31
```

응답:

```json
{
  "items": [
    {
      "applicationId": "uuid",
      "company": "우아한형제들",
      "position": "Backend Developer",
      "scheduleType": "test",
      "title": "과제 제출",
      "date": "2026-08-30",
      "completed": false,
      "needsReview": false
    }
  ]
}
```

필요한 이유:

- 캘린더 화면은 월 단위 일정 표시가 필요합니다.
- 현재 web은 지원 목록에서 `nextActionAt`을 모아 캘린더를 구성할 수 있지만, 일정이 많아지면 전용 조회가 더 적합합니다.

### 4. 홈 요약 서버 산출

대상 후보:

```http
GET /api/v1/home/summary?date=2026-08-30&timezone=Asia/Seoul
```

응답:

```json
{
  "briefing": {
    "source": "rule",
    "message": "지원자님, 확인 필요한 지원 2개가 있어요. 오늘은 이 항목부터 보면 좋아요.",
    "reason": "needsReview"
  },
  "counts": {
    "needsReview": 2,
    "openTasks": 3,
    "weeklySchedules": 4,
    "activeApplications": 8
  },
  "priorityItems": [],
  "upcomingSchedules": [],
  "activeApplications": [],
  "mailConnection": {
    "connected": false,
    "provider": null,
    "lastSyncedAt": null
  }
}
```

필요한 이유:

- 현재 홈 안내 문구는 random이 아니라 rule 기반입니다.
- rule을 client에 둘 수도 있지만, 메일 분류 결과/일정/지원 상태를 함께 판단하려면 서버 산출이 더 안정적입니다.

rule 입력값:

- `needsReview` 개수
- 미완료 일정 개수
- 5일 이내 일정
- 진행 중 지원 수
- 채용메일 연결 상태

우선순위 기준:

1. `needsReview=true`
2. 5일 이내 미완료 일정
3. 진행 중이며 최근 activity가 있는 지원건

### 5. 독립 일정 등록

대상 후보:

```http
POST /api/v1/calendar/schedules
```

web 요청:

```json
{
  "mutationId": "uuid",
  "applicationId": "uuid",
  "date": "2026-08-30",
  "title": "포트폴리오 점검"
}
```

필요한 이유:

- 캘린더 상단에서 날짜를 먼저 선택하지 않고도 일정 등록을 시작할 수 있어야 합니다.
- 선택 날짜 패널에서 등록할 때는 같은 다이얼로그를 열되, 선택된 날짜만 기본값으로 넣습니다.

정책 결정 필요:

- Jobvis의 일정은 항상 지원건에 연결할지, 개인 일정도 허용할지 결정해야 합니다.
- 개인 일정을 허용하면 `applicationId`는 nullable이어야 하고, 캘린더 응답도 개인 일정 item을 포함해야 합니다.

## frontend 연결 시 정리할 점

- 상세 화면 직접 진입 시 목록 데이터만 쓰지 말고 `GET /applications/{id}` 또는 history API를 호출해야 합니다.
- 목록 응답에 `emails`, `activities`, `changes`, `memo` 전체를 싣는 방식은 규모가 커지면 부담이 큽니다.
- `nextAction`과 `nextActionTitle` 중 하나로 명칭을 통일해야 합니다. web 기준은 `nextActionTitle`입니다.
- `scheduleType=test`는 진행 상태 표시에도 영향을 줍니다. 상태 변경 API와 일정 API가 서로 같은 규칙을 써야 합니다.
- `needsReview`는 status badge가 아니라 검토 플래그로 유지합니다.
