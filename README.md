# Jobvis Web

Jobvis는 메일에서 수집한 지원 기록, 진행 상태와 일정을 정리하는 구직 활동
대시보드입니다. 공식 Next.js App Router 기반으로 동작하며, 기본 모드에서는
`jobvis-api`에 연결합니다. 백엔드 없이 확인할 때는 명시적인 mock 모드를 사용합니다.

## 제공 화면

- `/`: 오늘 할 일, 새 상태 변경, 다가오는 일정
- `/applications`: 검색·상태 필터·추가가 가능한 지원 현황
- `/applications/[id]`: 진행 상태, 관련 메일, 타임라인, 메모를 관리하는 지원 상세
- `/calendar`: 월 이동과 지원·테스트·면접·회신·기타 일정 필터
- `/analytics`: 기간별 지원 수, 서류 통과율, 면접 전환율
- `/settings`: 채용 메일 연결과 권한 설정 관리

메뉴별 세부 기능, 화면 문구 결정 규칙과 현재 연결된 API는
[`docs/features.md`](docs/features.md)에 정리합니다.

처음 진입하면 로그인 화면을 먼저 보여줍니다. API 모드에서는 Google Identity
Services의 ID token을 `jobvis-api`의 challenge/exchange API로 검증합니다. API가 발급한
opaque session은 Next Route Handler가 `HttpOnly` 쿠키로 보관하고 브라우저
JavaScript에는 session token을 노출하지 않습니다.

지원 추가, 상태 변경, 메모 저장, 할 일 완료는 `jobvis-api`의 지원 이력 API에
저장됩니다. 실제 API/local 모드에서는 API가 확인한 성공 응답만 화면 상태에 반영하며,
연결 또는 저장 실패는 화면에 표시합니다. 데모 데이터는 mock 모드에서만 사용합니다.

## API 계약

정식 계약의 소유자는 `jobvis-api/openapi/jobvis-v1.yaml`입니다. 두 저장소가 같은 상위
디렉터리에 있을 때 아래 명령으로
`src/contracts/jobvis-api.generated.ts`를 다시 만들고, 애플리케이션 API client는 이
생성 타입을 import합니다. 웹 저장소가 백엔드 소스나 런타임 패키지를 직접 import하지는
않습니다.

```bash
npm run contract:generate
```

계약 파일을 바꾸는 API 변경은 생성 타입과 웹 consumer 변경을 같은 릴리스 단위에서
검증합니다.

## 기술 구성

- Next.js App Router와 React
- `@measure-twice/react` 컴포넌트 및 의미 기반 토큰
- Pretendard Variable
- route root allowlist를 적용한 `/api/backend/*` 프록시와 `/api/auth/*` 인증 BFF

## 디렉터리 구조

- `app/`: Next.js 라우트, 레이아웃, 페이지, API Route Handler
- `src/auth/`: Google 로그인, `HttpOnly` 세션 BFF와 mock/local 데모 게이트
- `src/analytics/`: 쿼리 문자열과 사용자 ID를 제외한 GA4 화면 경로 측정
- `src/shell/`: 사이드바, 상단바, 열린 상세 탭 등 앱 공통 프레임
- `src/applications/`: 지원 이력 타입, 상태, Provider, URL 유틸, API client
- `src/contracts/`: API 소유 OpenAPI에서 생성한 읽기 전용 TypeScript 계약
- `src/home/`: API-backed 홈 화면과 briefing 문구
- `src/settings/`: 메일 연결·가져오기 API 상태
- `src/mock-api/`: `dev:mock`에서 사용하는 메모리 기반 API 응답

스타일은 `app/globals.scss`에 몰아넣지 않고 기능 옆에 둡니다. 공통 토큰과 base
reset은 `app/tokens.scss`, `app/base.scss`에 두고, 화면별 스타일은 해당 route나
`src/*` 도메인 폴더의 `*.module.scss` 파일에 둡니다.

## 로컬 실행

```bash
npm install
npm run dev
```

기본 API 모드는 실제 `jobvis-api` 프록시입니다. API 주소는
`http://127.0.0.1:8080`이며, 필요하면 환경 변수로 바꿀 수 있습니다.

```bash
NEXT_PUBLIC_JOBVIS_GOOGLE_CLIENT_ID=<Google Web Client ID> \
JOBVIS_API_BASE_URL=http://127.0.0.1:8080 \
npm run dev:api
```

`NEXT_PUBLIC_JOBVIS_GOOGLE_CLIENT_ID`는 `jobvis-api`의
`JOBVIS_GOOGLE_CLIENT_ID`와 같은 Google Web Client ID를 사용합니다. 운영 빌드의
session cookie는 `HttpOnly`, `Secure`, `SameSite=Lax`와 host-only 범위로 설정됩니다.
신뢰할 수 있는 인그레스가 외부 `Forwarded`와 `X-Forwarded-For`를 제거하고 다시 쓰는
운영 환경에서는 `jobvis-api`에 `JOBVIS_FORWARD_HEADERS_STRATEGY=framework`를 설정합니다.
인증 BFF가 정리된 클라이언트 주소를 API까지 전달해 로그인 rate limit을 사용자별로
적용합니다. 인그레스가 전달 헤더를 정리하지 않는 환경에서는 이 설정을 사용하지 않습니다.

실제 로그인 없이 로컬 API의 `local` 프로필과 연결할 때만 local 모드를 사용합니다.
이 모드에서는 데모 로그인 게이트를 사용하고, 프록시가 loopback API에만
`X-Jobvis-User-Id`를 전달합니다.

```bash
JOBVIS_LOCAL_USER_ID=11111111-1111-4111-8111-111111111111 npm run dev:local
```

백엔드 없이 화면과 API 연동 흐름만 확인할 때는 메모리 기반 mock API로 실행할 수
있습니다. 이 모드에서는 로그인 화면의 Google 버튼이 실제 OAuth로 가지 않고 데모
사용자로 바로 홈 화면에 진입합니다.

```bash
npm run dev:mock
```

직접 환경 변수를 지정해도 됩니다.

```bash
JOBVIS_API_MODE=mock NEXT_PUBLIC_JOBVIS_API_MODE=mock npm run dev
JOBVIS_API_BASE_URL=http://127.0.0.1:8080 NEXT_PUBLIC_JOBVIS_API_MODE=api npm run dev
```

공개 웹은 Cloudflare Workers에 배포하고 Jobvis가 발급한 `HttpOnly` session cookie를
단일 로그인 경계로 사용합니다. `wrangler.jsonc`는 공개 API 주소와 서버 실행 모드만
소유하며 비밀값은 저장하지 않습니다. Google Web Client ID는 브라우저에 공개되는 값이므로
`NEXT_PUBLIC_JOBVIS_GOOGLE_CLIENT_ID`로 빌드에 전달하고, 같은 값을 `jobvis-api`의
`JOBVIS_GOOGLE_CLIENT_ID`에 설정합니다.

Cloudflare 배포에는 다음 환경변수를 사용합니다.

| 변수 | 값 |
| --- | --- |
| `JOBVIS_API_BASE_URL` | NCP VM의 공개 API 주소(예: `https://api.jobvis.example`) |
| `JOBVIS_API_MODE` | `api` |
| `NEXT_PUBLIC_JOBVIS_API_MODE` | `api` |
| `NEXT_PUBLIC_JOBVIS_GOOGLE_CLIENT_ID` | Google Web Client ID |
| `NEXT_PUBLIC_JOBVIS_GA_MEASUREMENT_ID` | GA4 Web 데이터 스트림 측정 ID |
| `NEXT_PUBLIC_JOBVIS_WEB_ORIGIN` | GA4 측정을 허용할 실제 Workers HTTPS origin |
| `JOBVIS_WEB_ORIGIN` | 실제 Workers HTTPS origin |

API 주소에는 `/api/v1`이나 마지막 `/`를 붙이지 않습니다. API의 CORS·OAuth redirect
설정도 동일한 `JOBVIS_WEB_ORIGIN`을 사용합니다. VM용 Compose와 백업 절차는
`jobvis-api/deploy/lab/README.md`가 소유합니다.

GA4에는 화면 경로만 보내며 지원 상세의 식별자는 `/applications/:id`로 바꿉니다.
쿼리, 이전 페이지 URL과 화면의 사용자 입력은 보내지 않습니다. 운영 웹 스트림의
Enhanced Measurement를 끄고 수동 `page_view`만 사용합니다. 배포 후 해당 제품 소유
Google 계정에서 스트림의 URL·측정 ID와 Realtime 수신을 확인합니다. 개발과 preview에는
운영 측정 ID를 주입하지 않습니다. 측정 ID가 있더라도 브라우저 origin이
`NEXT_PUBLIC_JOBVIS_WEB_ORIGIN`과 다르면 태그를 로드하지 않습니다.

```bash
npm run test:cloudflare
JOBVIS_GA_MEASUREMENT_ID=G-XXXXXXXXXX npm run deploy:cloudflare
```

검증은 다음 명령으로 수행합니다.

```bash
npm run lint
npm test
```
