import type { Metadata } from "next";
import { PublicPage } from "@/src/public/public-page";

export const metadata: Metadata = {
  title: "Jobvis 서비스 약관",
  description: "Jobvis 서비스 이용에 적용되는 기본 조건입니다.",
};

export default function TermsPage() {
  return (
    <PublicPage
      eyebrow="시행일 2026년 9월 1일"
      title="서비스 약관"
      description="Jobvis를 안전하고 예측 가능하게 이용하기 위한 기본 조건입니다."
    >
      <section>
        <h2>1. 서비스</h2>
        <p>
          Jobvis는 개인의 지원 내역, 관련 메일, 일정과 통계를 정리하는 구직 활동 관리
          도구입니다. 채용 결과를 보장하거나 사용자 대신 지원·계약 행위를 수행하지
          않습니다.
        </p>
      </section>

      <section>
        <h2>2. 계정과 외부 연결</h2>
        <p>
          사용자는 자신의 Google 계정으로 로그인하며 계정 활동을 안전하게 관리해야
          합니다. Gmail, Outlook, Naver 또는 Calendar 연결은 선택 사항이고 각
          공급자의 약관과 정책도 함께 적용됩니다. 연결 권한은 사용자가 언제든 해제할 수
          있습니다.
        </p>
      </section>

      <section>
        <h2>3. 올바른 이용</h2>
        <p>
          사용자는 자신이 처리할 권한이 있는 정보만 등록해야 하며, 서비스 방해, 무단
          접근, 타인의 권리 침해 또는 법령 위반 목적으로 Jobvis를 이용해서는 안 됩니다.
        </p>
      </section>

      <section>
        <h2>4. 서비스 변경과 가용성</h2>
        <p>
          보안, 안정성 또는 기능 개선을 위해 서비스를 변경하거나 일시 중단할 수
          있습니다. 중요한 변경은 합리적인 방법으로 안내하며, 사용자의 저장 정보를
          보호하고 복구 가능한 운영 절차를 유지하도록 노력합니다.
        </p>
      </section>

      <section>
        <h2>5. 책임 범위</h2>
        <p>
          Jobvis가 제공하는 요약과 통계는 사용자의 확인을 돕는 보조 정보입니다. 사용자는
          지원 일정, 메일 내용과 의사결정을 직접 확인해야 합니다. 법령상 제한할 수 없는
          책임은 이 약관으로 제한하지 않습니다.
        </p>
      </section>

      <section>
        <h2>6. 문의</h2>
        <p>
          약관 및 서비스 문의: <a href="mailto:taeydev59@gmail.com">taeydev59@gmail.com</a>
        </p>
      </section>
    </PublicPage>
  );
}
