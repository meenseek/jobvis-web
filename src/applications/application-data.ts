export type ApplicationStage =
  | "applied"
  | "screening"
  | "interview"
  | "offer";

export type ApplicationResult = "active" | "offered" | "rejected";
export type ApplicationStatus =
  | ApplicationStage
  | Exclude<ApplicationResult, "active">;
export type ApplicationDisplayStatus =
  | "review"
  | "application"
  | "test"
  | "interview"
  | "offer"
  | "offered"
  | "rejected";
export type ApplicationProgressStatus = Exclude<
  ApplicationDisplayStatus,
  "review"
>;
export type ScheduleType =
  | "application"
  | "test"
  | "interview"
  | "followup"
  | "other";

export type ApplicationEmail = {
  id: string;
  subject: string;
  sender: string;
  receivedAt: string;
  summary: string;
};

export type ApplicationActivity = {
  id: string;
  type: "email" | "note" | "status" | "task";
  title: string;
  description: string;
  occurredAt: string;
};

export type ApplicationChange = {
  id: string;
  title: string;
  description: string;
  occurredAt: string;
};

export type Application = {
  id: string;
  version: number;
  company: string;
  position: string;
  location: string;
  employmentType: string;
  appliedAt: string;
  stage: ApplicationStage;
  highestStageReached: ApplicationStage;
  screeningPassed: boolean;
  result: ApplicationResult;
  needsReview: boolean;
  source: string;
  scheduleType: ScheduleType;
  nextActionTitle?: string | null;
  nextActionAt: string | null;
  nextActionCompleted: boolean;
  memo: string;
  emails: ApplicationEmail[];
  activities: ApplicationActivity[];
  changes: ApplicationChange[];
};

export const STAGE_OPTIONS: Array<{
  value: ApplicationStage;
  label: string;
}> = [
  { value: "applied", label: "지원 완료" },
  { value: "screening", label: "서류 검토" },
  { value: "interview", label: "면접 진행" },
  { value: "offer", label: "처우 협의" },
];

export const STATUS_OPTIONS: Array<{
  value: ApplicationStatus;
  label: string;
}> = [
  ...STAGE_OPTIONS,
  { value: "offered", label: "최종 합격" },
  { value: "rejected", label: "전형 종료" },
];

export const DISPLAY_STATUS_OPTIONS: Array<{
  value: ApplicationDisplayStatus;
  label: string;
}> = [
  { value: "review", label: "확인 필요" },
  { value: "application", label: "지원·서류" },
  { value: "test", label: "과제·테스트" },
  { value: "interview", label: "면접 진행" },
  { value: "offer", label: "처우 협의" },
  { value: "offered", label: "최종 합격" },
  { value: "rejected", label: "전형 종료" },
];

export const PROGRESS_STATUS_OPTIONS: Array<{
  value: ApplicationProgressStatus;
  label: string;
}> = DISPLAY_STATUS_OPTIONS.filter(
  (option): option is { value: ApplicationProgressStatus; label: string } =>
    option.value !== "review",
);

export const SCHEDULE_TYPE_OPTIONS: Array<{
  value: ScheduleType;
  label: string;
}> = [
  { value: "application", label: "지원·서류" },
  { value: "test", label: "과제·테스트" },
  { value: "interview", label: "면접" },
  { value: "followup", label: "회신·결과 확인" },
  { value: "other", label: "기타" },
];

export function scheduleTypeLabel(scheduleType: ScheduleType) {
  return (
    SCHEDULE_TYPE_OPTIONS.find((option) => option.value === scheduleType)
      ?.label ?? "기타"
  );
}

export type ApplicationFilter = "all" | ApplicationDisplayStatus;

export function normalizeApplicationFilter(
  candidate: string | null,
): ApplicationFilter {
  if (
    candidate &&
    DISPLAY_STATUS_OPTIONS.some((option) => option.value === candidate)
  ) {
    return candidate as ApplicationDisplayStatus;
  }

  if (candidate === "applied" || candidate === "screening") {
    return "application";
  }

  if (candidate === "active") return "all";

  return "all";
}

export const stageRank: Record<ApplicationStage, number> = {
  applied: 0,
  screening: 1,
  interview: 2,
  offer: 3,
};

export function stageLabel(application: Application) {
  if (application.result === "offered") return "최종 합격";
  if (application.result === "rejected") return "전형 종료";
  return (
    STAGE_OPTIONS.find((option) => option.value === application.stage)?.label ??
    "지원 완료"
  );
}

export function getApplicationDisplayStatus(
  application: Pick<
    Application,
    "needsReview" | "result" | "stage" | "scheduleType"
  >,
): ApplicationDisplayStatus {
  if (application.needsReview) return "review";
  return getApplicationProgressStatus(application);
}

export function getApplicationProgressStatus(
  application: Pick<Application, "result" | "stage" | "scheduleType">,
): ApplicationProgressStatus {
  if (application.result === "offered") return "offered";
  if (application.result === "rejected") return "rejected";
  if (application.stage === "offer") return "offer";
  if (application.stage === "interview") return "interview";
  if (application.scheduleType === "test") return "test";
  return "application";
}

export function applicationDisplayStatusLabel(
  application: Pick<
    Application,
    "needsReview" | "result" | "stage" | "scheduleType"
  >,
) {
  const displayStatus = getApplicationDisplayStatus(application);
  return (
    DISPLAY_STATUS_OPTIONS.find((option) => option.value === displayStatus)
      ?.label ?? "지원·서류"
  );
}

export function applicationProgressStatusLabel(
  application: Pick<Application, "result" | "stage" | "scheduleType">,
) {
  const displayStatus = getApplicationProgressStatus(application);
  return (
    DISPLAY_STATUS_OPTIONS.find((option) => option.value === displayStatus)
      ?.label ?? "지원·서류"
  );
}

export function applicationProgressStatusBadgeTone(
  application: Pick<Application, "result" | "stage" | "scheduleType">,
) {
  return getApplicationProgressStatus(application);
}

export function progressStatusToApplicationStatus(
  progressStatus: ApplicationProgressStatus,
): ApplicationStatus {
  if (progressStatus === "application" || progressStatus === "test") {
    return "screening";
  }
  return progressStatus;
}

export function transitionProgressStatus(
  application: Application,
  progressStatus: ApplicationProgressStatus,
): Application {
  const transitioned = transitionStatus(
    application,
    progressStatusToApplicationStatus(progressStatus),
  );

  if (progressStatus === "test") {
    return { ...transitioned, scheduleType: "test" };
  }

  if (progressStatus === "application" && transitioned.scheduleType === "test") {
    return { ...transitioned, scheduleType: "application" };
  }

  return transitioned;
}

export function applicationStatusBadgeTone(application: {
  stage: ApplicationStage;
  result: ApplicationResult;
  needsReview: boolean;
  scheduleType: ScheduleType;
}) {
  return getApplicationDisplayStatus(application);
}

export function statusValue(application: Application): ApplicationStatus {
  return application.result === "active"
    ? application.stage
    : application.result;
}

export function transitionStatus(
  application: Application,
  status: ApplicationStatus,
): Application {
  if (status === "offered") {
    return {
      ...application,
      stage: "offer",
      highestStageReached: "offer",
      screeningPassed: true,
      result: "offered",
      needsReview: false,
    };
  }

  if (status === "rejected") {
    return {
      ...application,
      result: "rejected",
      needsReview: false,
    };
  }

  const highestStageReached =
    stageRank[status] > stageRank[application.highestStageReached]
      ? status
      : application.highestStageReached;
  return {
    ...application,
    stage: status,
    highestStageReached,
    screeningPassed:
      application.screeningPassed || stageRank[status] >= stageRank.interview,
    result: "active",
    needsReview: false,
  };
}

export function filterApplications(
  applications: Application[],
  query: string,
  filter: ApplicationFilter,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  return applications.filter((application) => {
    const matchesQuery =
      !normalizedQuery ||
      `${application.company} ${application.position} ${application.source}`
        .toLocaleLowerCase("ko-KR")
        .includes(normalizedQuery);
    const matchesFilter =
      filter === "all" ||
      filter === getApplicationDisplayStatus(application);
    return matchesQuery && matchesFilter;
  });
}

export type CalendarFilter = "all" | ScheduleType;

export function filterScheduledApplications(
  applications: Application[],
  filter: CalendarFilter,
) {
  return applications.filter((application) => {
    if (
      !application.nextActionAt ||
      application.nextActionCompleted ||
      application.result === "rejected"
    ) {
      return false;
    }
    return filter === "all" || application.scheduleType === filter;
  });
}

export function stageTone(application: Application) {
  if (application.result === "offered") return "success" as const;
  if (application.result === "rejected") return "danger" as const;
  if (application.needsReview) return "warning" as const;
  if (application.stage === "interview" || application.stage === "offer") {
    return "success" as const;
  }
  return "neutral" as const;
}

const seoulDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const seoulHourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  hour: "numeric",
  hourCycle: "h23",
});

export function homeGreeting(value: string | Date = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  const hour = Number(seoulHourFormatter.format(date));

  if (hour >= 5 && hour < 12) {
    return {
      heading: "좋은 아침이에요",
      description: "오늘의 일정과 지원 흐름을 가볍게 살펴볼까요?",
    };
  }

  if (hour >= 12 && hour < 18) {
    return {
      heading: "좋은 오후예요",
      description: "지금까지의 흐름을 살피고 다음 할 일을 차분히 이어가요.",
    };
  }

  return {
    heading: "오늘도 수고했어요",
    description: "남은 일정만 가볍게 확인하고 하루를 마무리해요.",
  };
}

export function seoulDateKey(value: string | Date = new Date()) {
  const parts = seoulDateFormatter.formatToParts(
    typeof value === "string" ? new Date(value) : value,
  );
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function compareOccurredAtDesc(
  a: { occurredAt: string },
  b: { occurredAt: string },
) {
  return Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
}

const seoulDateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function fullDateTime(timestamp: string) {
  return seoulDateTimeFormatter.format(new Date(timestamp));
}

export function fullDate(isoDate: string | null) {
  if (!isoDate) return "일정 없음";
  const dateKey = isoDate.includes("T")
    ? seoulDateKey(isoDate)
    : isoDate.slice(0, 10);
  const [year, month, day] = dateKey.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

const demoApplications: Array<Omit<Application, "version" | "changes">> = [
  {
    id: "toss-payments",
    company: "토스페이먼츠",
    position: "Server Developer",
    location: "서울 강남구 · 하이브리드",
    employmentType: "정규직",
    appliedAt: "2026-08-15",
    stage: "applied",
    highestStageReached: "applied",
    screeningPassed: false,
    result: "active",
    needsReview: true,
    source: "Gmail · 지원 접수 메일",
    scheduleType: "application",
    nextActionAt: "2026-08-16",
    nextActionCompleted: false,
    memo: "채용 공고의 플랫폼 안정성 경험 요구사항을 면접 준비에 반영하기.",
    emails: [
      {
        id: "toss-mail-1",
        subject: "[토스페이먼츠] 지원이 정상적으로 접수되었습니다",
        sender: "recruit@tosspayments.com",
        receivedAt: "2026-08-15T11:20:00+09:00",
        summary:
          "Server Developer 지원 접수 안내입니다. 지원서 검토 후 결과를 이메일로 안내할 예정입니다.",
      },
    ],
    activities: [
      {
        id: "toss-activity-1",
        type: "email",
        title: "지원 접수 메일을 가져왔습니다",
        description: "Gmail 원문에서 회사와 포지션을 추출했습니다.",
        occurredAt: "2026-08-15T11:22:00+09:00",
      },
      {
        id: "toss-activity-2",
        type: "status",
        title: "지원 완료 상태로 생성했습니다",
        description: "자동 분류 결과 확인이 필요합니다.",
        occurredAt: "2026-08-15T11:23:00+09:00",
      },
    ],
  },
  {
    id: "musinsa",
    company: "무신사",
    position: "Backend Engineer",
    location: "서울 성동구",
    employmentType: "정규직",
    appliedAt: "2026-08-13",
    stage: "screening",
    highestStageReached: "screening",
    screeningPassed: true,
    result: "active",
    needsReview: false,
    source: "Gmail · 코딩 테스트 안내",
    scheduleType: "test",
    nextActionAt: "2026-08-16",
    nextActionCompleted: false,
    memo: "주문 트래픽 경험과 장애 대응 사례를 정리해 둘 것.",
    emails: [
      {
        id: "musinsa-mail-1",
        subject: "[무신사] 온라인 코딩 테스트 안내",
        sender: "recruit@musinsa.com",
        receivedAt: "2026-08-16T09:10:00+09:00",
        summary:
          "서류 검토를 통과했습니다. 안내된 제출 기한까지 코딩 테스트를 완료해야 합니다.",
      },
    ],
    activities: [
      {
        id: "musinsa-activity-1",
        type: "status",
        title: "서류 검토 단계로 변경되었습니다",
        description: "코딩 테스트 안내 메일과 자동으로 연결했습니다.",
        occurredAt: "2026-08-16T09:12:00+09:00",
      },
      {
        id: "musinsa-activity-2",
        type: "email",
        title: "코딩 테스트 안내 메일을 가져왔습니다",
        description: "제출 기한을 일정으로 등록했습니다.",
        occurredAt: "2026-08-16T09:11:00+09:00",
      },
    ],
  },
  {
    id: "daangn",
    company: "당근",
    position: "Software Engineer, Backend",
    location: "서울 서초구 · 하이브리드",
    employmentType: "정규직",
    appliedAt: "2026-08-11",
    stage: "interview",
    highestStageReached: "interview",
    screeningPassed: true,
    result: "active",
    needsReview: true,
    source: "Naver · 인터뷰 안내",
    scheduleType: "interview",
    nextActionAt: "2026-08-20",
    nextActionCompleted: false,
    memo: "지역 기반 서비스의 데이터 일관성 사례 준비.",
    emails: [
      {
        id: "daangn-mail-1",
        subject: "[당근] 1차 인터뷰 일정을 확인해 주세요",
        sender: "talent@daangn.com",
        receivedAt: "2026-08-15T16:40:00+09:00",
        summary:
          "오후 2시 온라인 인터뷰가 예정되어 있습니다. 회의 링크는 당일 오전 다시 안내됩니다.",
      },
    ],
    activities: [
      {
        id: "daangn-activity-1",
        type: "status",
        title: "면접 진행 단계로 변경되었습니다",
        description: "인터뷰 안내 메일을 기준으로 상태를 갱신했습니다.",
        occurredAt: "2026-08-15T16:42:00+09:00",
      },
    ],
  },
  {
    id: "kakao-style",
    company: "카카오스타일",
    position: "Platform Backend Developer",
    location: "경기 성남시",
    employmentType: "정규직",
    appliedAt: "2026-08-08",
    stage: "applied",
    highestStageReached: "applied",
    screeningPassed: false,
    result: "active",
    needsReview: false,
    source: "직접 추가",
    scheduleType: "followup",
    nextActionAt: "2026-08-22",
    nextActionCompleted: false,
    memo: "직접 지원한 건. 채용 페이지를 일주일 뒤 다시 확인하기.",
    emails: [],
    activities: [
      {
        id: "kakao-style-activity-1",
        type: "status",
        title: "지원 완료 상태로 직접 추가했습니다",
        description: "메일 원문 없이 만든 지원 이력입니다.",
        occurredAt: "2026-08-08T14:10:00+09:00",
      },
    ],
  },
  {
    id: "woowa-bros",
    company: "우아한형제들",
    position: "Backend Developer",
    location: "서울 송파구 · 하이브리드",
    employmentType: "정규직",
    appliedAt: "2026-08-14",
    stage: "applied",
    highestStageReached: "applied",
    screeningPassed: false,
    result: "active",
    needsReview: false,
    source: "직접 추가",
    scheduleType: "other",
    nextActionAt: "2026-08-17",
    nextActionCompleted: false,
    memo: "프로젝트 설명과 저장소 링크가 최신인지 제출 전에 다시 확인하기.",
    emails: [],
    activities: [
      {
        id: "woowa-activity-1",
        type: "task",
        title: "포트폴리오 점검 일정을 등록했습니다",
        description: "지원 서류 제출 전 확인할 개인 일정을 추가했습니다.",
        occurredAt: "2026-08-16T10:10:00+09:00",
      },
      {
        id: "woowa-activity-2",
        type: "status",
        title: "지원 완료 상태로 직접 추가했습니다",
        description: "메일 원문 없이 만든 지원 이력입니다.",
        occurredAt: "2026-08-14T18:30:00+09:00",
      },
    ],
  },
  {
    id: "wanted-lab",
    company: "원티드랩",
    position: "Backend Engineer",
    location: "서울 송파구",
    employmentType: "정규직",
    appliedAt: "2026-07-20",
    stage: "interview",
    highestStageReached: "interview",
    screeningPassed: true,
    result: "rejected",
    needsReview: false,
    source: "Gmail · 최종 결과 안내",
    scheduleType: "other",
    nextActionAt: null,
    nextActionCompleted: true,
    memo: "면접 회고: 이벤트 처리의 재시도 전략 설명을 더 명확히 준비하기.",
    emails: [
      {
        id: "wanted-mail-1",
        subject: "[원티드랩] 채용 전형 결과 안내",
        sender: "recruit@wantedlab.com",
        receivedAt: "2026-08-05T13:00:00+09:00",
        summary: "인터뷰 결과와 향후 지원 가능 시점을 안내한 메일입니다.",
      },
    ],
    activities: [
      {
        id: "wanted-activity-1",
        type: "status",
        title: "전형 종료 상태로 변경되었습니다",
        description: "결과 안내 메일을 확인했습니다.",
        occurredAt: "2026-08-05T13:05:00+09:00",
      },
    ],
  },
  {
    id: "ridi",
    company: "리디",
    position: "Backend Engineer",
    location: "서울 강남구",
    employmentType: "정규직",
    appliedAt: "2026-06-21",
    stage: "interview",
    highestStageReached: "interview",
    screeningPassed: true,
    result: "active",
    needsReview: false,
    source: "Gmail · 서류 통과 안내",
    scheduleType: "interview",
    nextActionAt: "2026-08-19",
    nextActionCompleted: false,
    memo: "콘텐츠 메타데이터 파이프라인 관련 질문 준비.",
    emails: [
      {
        id: "ridi-mail-1",
        subject: "[리디] 2차 인터뷰 안내",
        sender: "career@ridi.com",
        receivedAt: "2026-08-14T10:30:00+09:00",
        summary: "오전 11시 리디 오피스에서 진행하는 2차 인터뷰 안내입니다.",
      },
    ],
    activities: [
      {
        id: "ridi-activity-1",
        type: "status",
        title: "면접 진행 단계로 변경되었습니다",
        description: "2차 인터뷰 일정을 캘린더에 반영했습니다.",
        occurredAt: "2026-08-14T10:32:00+09:00",
      },
    ],
  },
  {
    id: "naver-cloud",
    company: "네이버클라우드",
    position: "Cloud Platform Engineer",
    location: "경기 성남시",
    employmentType: "정규직",
    appliedAt: "2026-05-10",
    stage: "offer",
    highestStageReached: "offer",
    screeningPassed: true,
    result: "offered",
    needsReview: false,
    source: "Naver · 처우 안내",
    scheduleType: "followup",
    nextActionAt: "2026-08-21",
    nextActionCompleted: false,
    memo: "처우 조건과 입사 가능일 검토 중.",
    emails: [
      {
        id: "naver-cloud-mail-1",
        subject: "[네이버클라우드] 최종 합격 및 처우 안내",
        sender: "recruit@navercorp.com",
        receivedAt: "2026-08-14T15:20:00+09:00",
        summary: "최종 합격 결과와 처우 조건, 회신 기한을 안내한 메일입니다.",
      },
    ],
    activities: [
      {
        id: "naver-cloud-activity-1",
        type: "status",
        title: "최종 합격 상태로 변경되었습니다",
        description: "처우 안내 메일을 확인했습니다.",
        occurredAt: "2026-08-14T15:24:00+09:00",
      },
    ],
  },
  {
    id: "kurly",
    company: "컬리",
    position: "Fulfillment Backend Engineer",
    location: "서울 강남구",
    employmentType: "정규직",
    appliedAt: "2026-03-15",
    stage: "screening",
    highestStageReached: "screening",
    screeningPassed: false,
    result: "rejected",
    needsReview: false,
    source: "Gmail · 결과 안내",
    scheduleType: "other",
    nextActionAt: null,
    nextActionCompleted: true,
    memo: "물류 도메인 경험을 더 구체적인 수치로 정리할 것.",
    emails: [],
    activities: [
      {
        id: "kurly-activity-1",
        type: "status",
        title: "전형 종료 상태로 변경되었습니다",
        description: "서류 결과를 직접 기록했습니다.",
        occurredAt: "2026-03-22T17:30:00+09:00",
      },
    ],
  },
];

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const demoAnchorDate = "2026-08-16";
const currentDemoDate = seoulDateKey();
const demoDateOffset =
  (Date.parse(`${currentDemoDate}T00:00:00Z`) -
    Date.parse(`${demoAnchorDate}T00:00:00Z`)) /
  millisecondsPerDay;

function shiftDemoDate(dateKey: string) {
  const shifted = new Date(
    Date.parse(`${dateKey}T00:00:00Z`) +
      demoDateOffset * millisecondsPerDay,
  );
  return shifted.toISOString().slice(0, 10);
}

function shiftDemoTimestamp(timestamp: string) {
  return new Date(
    Date.parse(timestamp) + demoDateOffset * millisecondsPerDay,
  ).toISOString();
}

export const initialApplications: Application[] = demoApplications.map(
  (application) => ({
    ...application,
    version: 0,
    changes: [],
    appliedAt: shiftDemoDate(application.appliedAt),
    nextActionAt: application.nextActionAt
      ? shiftDemoDate(application.nextActionAt)
      : null,
    emails: application.emails.map((email) => ({
      ...email,
      receivedAt: shiftDemoTimestamp(email.receivedAt),
    })),
    activities: application.activities.map((item) => ({
      ...item,
      occurredAt: shiftDemoTimestamp(item.occurredAt),
    })),
  }),
);
