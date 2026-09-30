const RETRY_DELAYS = [2000, 4000, 8000, 16000, 30000];

type PollingOptions<Run> = {
  fetchRun: (signal: AbortSignal) => Promise<Run>;
  isTerminal: (run: Run) => boolean;
  isTransient: (error: unknown) => boolean;
  onRun: (run: Run) => void;
  onError: (error: unknown) => void;
  onExhausted: () => void;
  timers?: Pick<typeof globalThis, "setTimeout" | "clearTimeout">;
};

// 가져오기 작업을 새로 만들지 않고 동일 작업의 상태 조회만 관리한다.
export function startImportRunPolling<Run>({
  fetchRun, isTerminal, isTransient, onRun, onError, onExhausted,
  timers = globalThis,
}: PollingOptions<Run>) {
  const controller = new AbortController();
  let active = true;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function schedule(delay: number) {
    timer = timers.setTimeout(() => {
      timer = null;
      if (active) void poll();
    }, delay);
  }

  async function poll() {
    let run: Run;
    try {
      run = await fetchRun(controller.signal);
    } catch (error) {
      if (!active) return;
      onError(error);
      if (!isTransient(error)) {
        active = false;
        return;
      }
      const retryDelay = RETRY_DELAYS[failures++];
      if (retryDelay === undefined) {
        active = false;
        onExhausted();
      } else {
        schedule(retryDelay);
      }
      return;
    }
    if (!active) return;
    failures = 0;
    onRun(run);
    if (isTerminal(run)) active = false;
    else schedule(1000);
  }

  schedule(1000);
  return {
    dispose() {
      active = false;
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
      controller.abort();
    },
  };
}
