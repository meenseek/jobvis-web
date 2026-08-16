"use client";

import {
  Button,
  Dialog,
  DialogActions,
  Select,
  StatusIndicator,
  TextField,
} from "@measure-twice/react";
import {
  BriefcaseBusiness,
  CalendarCheck2,
  CircleCheckBig,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  applicationDetailPath,
  applicationListPath,
} from "../application-navigation";
import { useApplications } from "../application-provider";
import {
  ApplicationFilter,
  ApplicationStage,
  filterApplications,
  fullDate,
  normalizeApplicationFilter,
  stageLabel,
  stageTone,
  STAGE_OPTIONS,
} from "../data";

function ApplicationFilters({
  query,
  filter,
  onSearch,
  onFilter,
}: {
  query: string;
  filter: ApplicationFilter;
  onSearch: (query: string) => void;
  onFilter: (filter: ApplicationFilter, query: string) => void;
}) {
  const [draft, setDraft] = useState(query);

  return (
    <form
      className="table-filters"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(draft);
      }}
    >
      <TextField
        label="지원 이력 검색"
        size="sm"
        type="search"
        placeholder="회사 또는 포지션"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <Select
        label="진행 상태"
        size="sm"
        value={filter}
        onChange={(event) =>
          onFilter(normalizeApplicationFilter(event.target.value), draft)
        }
      >
        <option value="all">전체 상태</option>
        <option value="review">확인 필요</option>
        {STAGE_OPTIONS.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
        <option value="offered">최종 합격</option>
        <option value="rejected">전형 종료</option>
      </Select>
      <Button type="submit" size="sm" tone="neutral" variant="outline">
        검색
      </Button>
    </form>
  );
}

export default function ApplicationsPage() {
  const { applications, addApplication } = useApplications();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const filter = normalizeApplicationFilter(searchParams.get("status"));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [stage, setStage] = useState<ApplicationStage>("applied");

  const filteredApplications = useMemo(
    () => filterApplications(applications, query, filter),
    [applications, filter, query],
  );
  const currentListPath = applicationListPath(query, filter);

  function updateList(nextQuery: string, nextFilter: ApplicationFilter) {
    router.replace(applicationListPath(nextQuery, nextFilter));
  }

  const reviewCount = applications.filter(
    (application) => application.needsReview,
  ).length;
  const interviewCount = applications.filter(
    (application) =>
      application.stage === "interview" && application.result === "active",
  ).length;

  function handleAddApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!company.trim() || !position.trim()) return;
    const id = addApplication({ company, position, stage });
    setCompany("");
    setPosition("");
    setStage("applied");
    setDialogOpen(false);
    router.push(applicationDetailPath(id, currentListPath));
  }

  return (
    <main id="main-content" className="main-content">
      <section className="page-heading">
        <div>
          <h1>지원 현황</h1>
          <p>회사·포지션·상태를 비교하고 확인할 지원 건을 정리하세요.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>지원 내역 추가</Button>
      </section>

      <section className="stat-grid" aria-label="지원 현황 요약">
        <article className="stat-card">
          <span className="stat-icon" aria-hidden="true">
            <BriefcaseBusiness />
          </span>
          <div>
            <p>전체 지원</p>
            <strong>{applications.length}</strong>
            <small>모든 지원 이력</small>
          </div>
        </article>
        <article className="stat-card stat-card-review">
          <span className="stat-icon" aria-hidden="true">
            <CircleCheckBig />
          </span>
          <div>
            <p>확인 필요</p>
            <strong>{reviewCount}</strong>
            <small>자동 분류 결과</small>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon" aria-hidden="true">
            <CalendarCheck2 />
          </span>
          <div>
            <p>면접 진행</p>
            <strong>{interviewCount}</strong>
            <small>예정된 인터뷰 포함</small>
          </div>
        </article>
      </section>

      <section className="panel applications-panel">
        <div className="panel-heading applications-heading">
          <div>
            <h2>지원 목록</h2>
            <p className="section-description">
              필터는 상세 화면을 보고 돌아와도 유지됩니다.
            </p>
          </div>
          <ApplicationFilters
            key={currentListPath}
            query={query}
            filter={filter}
            onSearch={(nextQuery) => updateList(nextQuery, filter)}
            onFilter={(nextFilter, nextQuery) =>
              updateList(nextQuery, nextFilter)
            }
          />
        </div>

        <div className="table-wrap">
          <table>
            <caption>검색 및 진행 상태 필터가 적용된 지원 목록</caption>
            <thead>
              <tr>
                <th scope="col">회사 / 포지션</th>
                <th scope="col">지원일</th>
                <th scope="col">상태</th>
                <th scope="col">원문 출처</th>
                <th scope="col">다음 행동</th>
                <th scope="col">상세</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map((application) => (
                <tr key={application.id}>
                  <td>
                    <div className="company-cell">
                      <span className="company-monogram" aria-hidden="true">
                        {application.company.slice(0, 1)}
                      </span>
                      <span>
                        <strong>{application.company}</strong>
                        <small>{application.position}</small>
                      </span>
                    </div>
                  </td>
                  <td data-label="지원일">{fullDate(application.appliedAt)}</td>
                  <td data-label="상태">
                    <StatusIndicator tone={stageTone(application)}>
                      {application.needsReview
                        ? "확인 필요"
                        : stageLabel(application)}
                    </StatusIndicator>
                  </td>
                  <td data-label="원문 출처">{application.source}</td>
                  <td data-label="다음 행동">
                    <span
                      className={
                        application.needsReview ? "needs-review" : undefined
                      }
                    >
                      {application.nextAction}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <Link
                        className="detail-link"
                        href={applicationDetailPath(
                          application.id,
                          currentListPath,
                        )}
                        aria-label={`${application.company} ${application.position} 지원 상세 보기`}
                      >
                        {application.needsReview ? "확인하기" : "상세 보기"}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredApplications.length === 0 ? (
            <div className="empty-state">
              <strong>조건에 맞는 지원 이력이 없습니다.</strong>
              <p>검색어나 진행 상태를 바꿔보세요.</p>
            </div>
          ) : null}
        </div>
        <footer className="table-footer">
          <span>{filteredApplications.length}개 이력 표시 중</span>
          <span>메일 원문 연결 정보 포함</span>
        </footer>
      </section>

      <Dialog
        title="지원 내역 추가"
        description="메일에 없는 지원 이력을 직접 기록할 수 있습니다."
        closeLabel="지원 내역 추가 창 닫기"
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      >
        <form className="application-form" onSubmit={handleAddApplication}>
          <TextField
            label="회사"
            placeholder="예: 네이버"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            required
          />
          <TextField
            label="포지션"
            placeholder="예: Backend Engineer"
            value={position}
            onChange={(event) => setPosition(event.target.value)}
            required
          />
          <Select
            label="진행 상태"
            value={stage}
            onChange={(event) =>
              setStage(event.target.value as ApplicationStage)
            }
          >
            {STAGE_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <DialogActions>
            <Button
              type="button"
              tone="neutral"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
            >
              취소
            </Button>
            <Button type="submit">이력 저장</Button>
          </DialogActions>
        </form>
      </Dialog>
    </main>
  );
}
