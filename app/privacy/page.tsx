import type { Metadata } from "next";
import { PublicPage } from "@/src/public/public-page";

export const metadata: Metadata = {
  title: "Jobvis 개인정보처리방침",
  description: "Jobvis가 사용자 정보와 Google 사용자 데이터를 처리하는 기준입니다.",
};

export default function PrivacyPage() {
  return (
    <PublicPage
      eyebrow="시행일 2026년 9월 1일"
      title="개인정보처리방침"
      description="Jobvis는 구직 활동 정리 기능에 필요한 정보만 처리하고, 사용 목적과 보관 범위를 투명하게 안내합니다."
    >
      <section>
        <h2>1. 처리하는 정보</h2>
        <h3>로그인 정보</h3>
        <p>
          Google 로그인 시 Google이 제공하는 고유 계정 식별자와, 사용자가 제공에
          동의한 경우 표시 이름과 기본 이메일 주소를 처리합니다. Google 비밀번호는
          Jobvis가 받거나 저장하지 않습니다.
        </p>
        <h3>사용자가 입력하거나 생성한 정보</h3>
        <p>
          회사명, 포지션, 지원 단계, 메모, 일정, 진행 기록 등 사용자가 Jobvis에서
          입력하거나 생성한 구직 활동 정보를 처리합니다.
        </p>
        <h3>선택적 외부 연결 정보</h3>
        <p>
          사용자가 설정에서 별도로 연결한 경우 메일 계정 주소, 연결 권한, 암호화된
          OAuth 토큰 또는 Naver 앱 비밀번호를 처리합니다. 읽기 전용 채용 메일에서는
          제목, 보낸 사람, 수신 시각과 제한된 미리보기에서 만든 요약만 지원 이력에
          반영하며, 메일 원문과 첨부파일은 저장하지 않습니다.
        </p>
        <h3>운영 정보</h3>
        <p>
          보안과 장애 대응을 위해 접속 시각, IP 주소, 요청 경로와 오류 정보가 제한된
          운영 로그에 포함될 수 있습니다. 토큰, 앱 비밀번호와 메일 본문은 로그에
          기록하지 않습니다.
        </p>
        <h3>서비스 이용 통계</h3>
        <p>
          서비스 개선을 위해 Google Analytics 4를 사용하며 방문한 화면의 종류,
          방문 시각, 브라우저·기기 종류, 대략적인 지역과 가명화된 브라우저 식별자를
          처리할 수 있습니다. URL의 검색어와 로그인 오류 값, 이전 페이지 URL,
          지원 내역 식별자와 Jobvis 사용자 ID는 분석 이벤트로 보내지 않습니다.
        </p>
      </section>

      <section>
        <h2>2. 이용 목적</h2>
        <ul>
          <li>사용자 계정 생성, 로그인과 세션 유지</li>
          <li>사용자별 지원 내역, 일정과 통계 제공</li>
          <li>사용자가 동의한 외부 메일·캘린더 연결 수행</li>
          <li>화면별 이용 현황과 서비스 품질 분석</li>
          <li>오류 조사, 보안 위협 방지와 서비스 안정성 유지</li>
        </ul>
        <p>
          Google 사용자 데이터는 위 기능을 제공하는 용도로만 사용하며 판매, 맞춤형
          광고 또는 광고 프로파일링에 사용하지 않습니다.
        </p>
      </section>

      <section>
        <h2>3. 저장과 보관</h2>
        <p>
          계정과 구직 활동 정보는 서비스 제공에 필요한 동안 보관합니다. 로그인 및 OAuth
          challenge와 만료·폐기된 세션은 주기적으로 정리하며, 메일 가져오기 실행 기록의
          기본 보존 기간은 30일입니다. 외부 연결 정보는 사용자가 연결을 해제하거나 삭제를
          요청할 때까지 보관할 수 있습니다.
        </p>
        <p>
          OAuth 토큰과 Naver 앱 비밀번호는 AES-256-GCM으로 암호화해 저장하고, 로그인
          session token 원문은 데이터베이스에 저장하지 않고 SHA-256 digest만 저장합니다.
        </p>
      </section>

      <section>
        <h2>4. 제공업체와 전송</h2>
        <p>
          서비스 제공을 위해 Google 로그인, Google Analytics 4, Cloudflare Workers,
          Jobvis API와 PostgreSQL 운영 인프라를 사용합니다. 사용자가 외부
          연결을 선택한 경우 해당 Google, Microsoft 또는 Naver 서비스와 요청에 필요한
          정보가 전송됩니다. Jobvis는 사용자 정보를 데이터 브로커에게 판매하지
          않습니다.
        </p>
      </section>

      <section>
        <h2>5. 사용자의 선택과 권리</h2>
        <p>
          메일·캘린더 연결은 선택 사항이며 언제든 Jobvis 설정 또는 해당 공급자 계정에서
          연결을 해제할 수 있습니다. 자신의 정보 열람, 정정 또는 삭제를 요청하려면
          아래 이메일로 연락해 주세요. 본인 확인 후 법령상 보관 의무가 있는 정보를
          제외하고 처리합니다.
        </p>
      </section>

      <section>
        <h2>6. 문의와 변경</h2>
        <p>
          개인정보 관련 문의: <a href="mailto:taeydev59@gmail.com">taeydev59@gmail.com</a>
        </p>
        <p>
          처리 방식이 바뀌면 이 페이지의 시행일과 내용을 갱신하고, 중요한 변경은
          서비스 화면을 통해 안내합니다.
        </p>
      </section>
    </PublicPage>
  );
}
