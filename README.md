# Jobvis Web

Jobvis는 메일에서 수집한 지원 기록, 진행 상태와 일정을 정리하는 구직 활동
대시보드입니다. 공식 Next.js App Router 기반으로 동작하며, 로컬에서는
`jobvis-api`에 연결하고 API가 꺼져 있으면 데모 데이터로 화면을 유지합니다.

## 제공 화면

- `/`: 오늘 할 일, 새 상태 변경, 다가오는 일정
- `/applications`: 검색·상태 필터·추가가 가능한 지원 현황
- `/applications/[id]`: 진행 상태, 관련 메일, 타임라인, 메모를 관리하는 지원 상세
- `/calendar`: 월 이동과 지원·테스트·면접·회신·기타 일정 필터
- `/analytics`: 기간별 지원 수, 서류 통과율, 면접 전환율
- `/settings`: 채용 메일 연결과 권한 설정 관리

메뉴별 세부 기능, 화면 문구 결정 규칙, 연결된 API와 후속 연결 후보는
[`docs/features.md`](docs/features.md)에 정리합니다.

처음 진입하면 로그인/회원가입 화면을 먼저 보여줍니다. 현재 프론트 구현은 로컬
세션 기반의 임시 인증이며, 실제 소셜 로그인은 `jobvis-api`의 auth challenge /
exchange API와 OAuth SDK 연결 단계에서 붙입니다.

지원 추가, 상태 변경, 메모 저장, 할 일 완료는 `jobvis-api`의 지원 이력 API에
저장됩니다. API 연결이 불가능한 개발 환경에서는 같은 브라우저 세션의 로컬 상태로
대체됩니다.

## 기술 구성

- Next.js App Router와 React
- `@measure-twice/react` 컴포넌트 및 의미 기반 토큰
- Pretendard Variable
- `/api/backend/*` Next Route Handler를 통한 `jobvis-api` 프록시

## 디렉터리 구조

- `app/`: Next.js 라우트, 레이아웃, 페이지, API Route Handler
- `src/auth/`: 첫 진입 로그인/회원가입 화면과 임시 로컬 세션 게이트
- `src/shell/`: 사이드바, 상단바, 열린 상세 탭 등 앱 공통 프레임
- `src/applications/`: 지원 이력 타입, 상태, Provider, URL 유틸, API client
- `src/home/`: 홈 화면 클라이언트 UI와 프론트 룰 기반 홈 요약 계산
- `src/settings/`: 메일 연결 설정 상태
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
JOBVIS_API_BASE_URL=http://127.0.0.1:8080 npm run dev:api
```

백엔드 없이 화면과 API 연동 흐름만 확인할 때는 메모리 기반 mock API로 실행할 수
있습니다. 이 모드에서는 로그인 화면의 Google/Kakao 버튼이 실제 OAuth로 가지 않고
데모 사용자로 바로 홈 화면에 진입합니다.

```bash
npm run dev:mock
```

직접 환경 변수를 지정해도 됩니다.

```bash
JOBVIS_API_MODE=mock NEXT_PUBLIC_JOBVIS_API_MODE=mock npm run dev
JOBVIS_API_BASE_URL=http://127.0.0.1:8080 NEXT_PUBLIC_JOBVIS_API_MODE=api npm run dev
```

검증은 다음 명령으로 수행합니다.

```bash
npm run lint
npm test
```
