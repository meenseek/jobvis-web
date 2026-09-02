import type { Metadata } from "next";
import Link from "next/link";
import { PublicPage } from "@/src/public/public-page";

export const metadata: Metadata = {
  title: "Jobvis 소개",
  description: "지원 현황, 관련 메일과 일정을 한곳에서 정리하는 개인 구직 비서입니다.",
};

export default function AboutPage() {
  return (
    <PublicPage
      eyebrow="개인 구직 비서"
      title="구직 활동의 흐름을 한곳에서 정리하세요."
      description="Jobvis는 지원 내역, 전형 진행 상태, 메모와 일정을 연결해 다음 행동을 놓치지 않도록 돕습니다."
    >
      <section>
        <h2>무엇을 할 수 있나요?</h2>
        <ul>
          <li>회사와 포지션별 지원 내역 및 전형 상태 관리</li>
          <li>면접과 후속 일정, 진행 타임라인 정리</li>
          <li>사용자가 별도로 동의한 채용 메일의 읽기 전용 확인 및 요약</li>
          <li>지원 현황과 전환율을 보여주는 개인 대시보드</li>
        </ul>
      </section>

      <section>
        <h2>로그인 계정 정보는 왜 필요한가요?</h2>
        <p>
          Google 로그인에서는 계정을 식별하고 Jobvis 데이터를 사용자별로 분리하기 위해
          기본 프로필 정보만 사용합니다. Gmail 연결은 로그인과 분리되어 있으며,
          사용자가 설정에서 별도로 동의한 경우에만 시작됩니다.
        </p>
      </section>

      <section>
        <h2>데이터 사용 원칙</h2>
        <p>
          Jobvis는 구직 활동 정리 기능을 제공하는 데 필요한 범위에서만 데이터를
          처리합니다. 채용 메일 원문과 첨부파일은 저장하지 않으며, 광고 판매나 맞춤형
          광고에 사용자 데이터를 사용하지 않습니다.
        </p>
      </section>

      <section>
        <h2>시작하기 전에 확인하세요</h2>
        <p>
          자세한 처리 기준은 <Link href="/privacy">개인정보처리방침</Link>에서,
          서비스 이용 조건은 <Link href="/terms">서비스 약관</Link>에서 확인할 수
          있습니다.
        </p>
        <p>
          <Link href="/">Jobvis 로그인으로 이동</Link>
        </p>
      </section>
    </PublicPage>
  );
}
