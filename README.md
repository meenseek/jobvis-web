# Jobvis Web

Jobvis는 메일에서 수집한 지원 기록을 확인하고 다음 행동을 정리하는 구직 활동
대시보드입니다. 현재 구현은 프론트엔드 MVP로, 브라우저 세션 동안 공유되는 데모
데이터를 사용합니다.

## 제공 화면

- `/`: 오늘 할 일, 새 상태 변경, 다가오는 일정
- `/applications`: 검색·상태 필터·추가가 가능한 지원 현황
- `/applications/[id]`: 진행 상태, 관련 메일, 타임라인, 메모를 관리하는 지원 상세
- `/calendar`: 월 이동과 지원·테스트·면접·회신·기타 일정 필터
- `/analytics`: 기간별 지원 수, 서류 통과율, 면접 전환율
- `/settings`: 로그인 계정과 채용 메일 연결 관리

지원 추가, 상태 변경, 메모 저장, 할 일 완료는 공통 상태에 반영되어 페이지를
이동해도 같은 브라우저 세션에서 유지됩니다. 새로고침하면 데모 데이터로 돌아옵니다.

## 기술 구성

- Vinext 기반 Next.js App Router 호환 프론트엔드와 React
- `@measure-twice/react` 컴포넌트 및 의미 기반 토큰
- Pretendard Variable
- Cloudflare Sites 호환 빌드

## 로컬 실행

```bash
npm install
npm run dev
```

검증은 다음 명령으로 수행합니다.

```bash
npm run lint
npm test
```
