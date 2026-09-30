import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const pollingCode = ts.transpileModule(readFileSync(new URL('../src/settings/import-run-polling.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const apiCode = ts.transpileModule(readFileSync(new URL('../src/api/jobvis-api-client.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { startImportRunPolling } = await import(`data:text/javascript;base64,${Buffer.from(pollingCode).toString('base64')}`);
const { JobvisApiUnavailableError, JobvisAuthenticationRequiredError, apiRequest } = await import(`data:text/javascript;base64,${Buffer.from(apiCode).toString('base64')}`);

function clock() {
  const callbacks = new Map();
  const delays = [];
  const cancelled = [];
  let id = 0;
  return {
    callbacks, delays, cancelled,
    setTimeout(fn, delay) { delays.push(delay); callbacks.set(++id, fn); return id; },
    clearTimeout(key) { cancelled.push(key); callbacks.delete(key); },
    async fire() {
      const [key, fn] = callbacks.entries().next().value;
      callbacks.delete(key);
      fn();
      await new Promise(resolve => setImmediate(resolve));
    },
  };
}

function setup(fetchRun) {
  const timers = clock();
  const runs = [], errors = [], signals = [];
  let exhausted = 0, calls = 0;
  const options = {
    timers,
    fetchRun(signal) { signals.push(signal); return fetchRun(++calls, signal); },
    isTerminal: run => ['completed', 'failed', 'cancelled'].includes(run.status),
    isTransient: error => error instanceof JobvisApiUnavailableError,
    onRun: run => runs.push(run),
    onError: error => errors.push(error),
    onExhausted: () => exhausted++,
  };
  const polling = startImportRunPolling(options);
  return { timers, runs, errors, signals, options, polling, calls: () => calls, exhausted: () => exhausted };
}

test('일시적 오류에서 회복하면 1초 간격으로 돌아가고 재시도 횟수를 초기화한다', async () => {
  const state = setup(async call => {
    if ([1, 3].includes(call)) throw new JobvisApiUnavailableError('일시적 오류');
    return { status: 'running' };
  });
  for (let i = 0; i < 4; i++) await state.timers.fire();
  assert.deepEqual(state.timers.delays, [1000, 2000, 1000, 2000, 1000]);
  assert.equal(state.runs.length, 2);
  assert.equal(state.exhausted(), 0);
  state.polling.dispose();
});

test('최대 5회 재시도 후 정지하고 수동 재개는 같은 조회만 다시 수행한다', async () => {
  const state = setup(async call => {
    if (call <= 6) throw new JobvisApiUnavailableError('502');
    return { id: 'existing-run', status: 'running' };
  });
  for (let i = 0; i < 6; i++) await state.timers.fire();
  assert.deepEqual(state.timers.delays, [1000, 2000, 4000, 8000, 16000, 30000]);
  assert.equal(state.calls(), 6);
  assert.equal(state.exhausted(), 1);
  assert.equal(state.timers.callbacks.size, 0);
  state.polling.dispose();
  const resumed = startImportRunPolling(state.options);
  await state.timers.fire();
  assert.deepEqual(state.runs, [{ id: 'existing-run', status: 'running' }]);
  assert.equal(state.calls(), 7);
  assert.equal(state.timers.callbacks.size, 1);
  resumed.dispose();
});

for (const error of [new JobvisAuthenticationRequiredError('인증 실패'), new Error('400')]) {
  test(`${error.constructor.name}은 재시도하지 않는다`, async () => {
    const state = setup(async () => { throw error; });
    await state.timers.fire();
    assert.deepEqual(state.errors, [error]);
    assert.equal(state.calls(), 1);
    assert.equal(state.exhausted(), 0);
    assert.equal(state.timers.callbacks.size, 0);
    state.polling.dispose();
  });
}

for (const status of ['completed', 'failed', 'cancelled']) {
  test(`${status} 작업은 다음 조회를 예약하지 않는다`, async () => {
    const state = setup(async () => ({ status }));
    await state.timers.fire();
    assert.deepEqual(state.runs, [{ status }]);
    assert.equal(state.calls(), 1);
    assert.equal(state.timers.callbacks.size, 0);
    state.polling.dispose();
  });
}

for (const reason of ['연결 해제', '화면 종료', '새 작업 전환']) {
  test(`${reason}는 예약과 진행 중 요청을 취소하고 늦은 응답을 무시한다`, async () => {
    let resolve;
    const state = setup(() => new Promise(done => { resolve = done; }));
    await state.timers.fire();
    state.polling.dispose();
    assert.equal(state.signals[0].aborted, true);
    resolve({ status: 'completed' });
    await new Promise(done => setImmediate(done));
    assert.deepEqual(state.runs, []);
    assert.deepEqual(state.errors, []);
    assert.equal(state.timers.callbacks.size, 0);
    const pending = setup(async () => ({ status: 'running' }));
    const queued = pending.timers.callbacks.values().next().value;
    pending.polling.dispose();
    assert.deepEqual(pending.timers.cancelled, [1]);
    queued();
    assert.equal(pending.calls(), 0);
  });
}

test('취소한 요청의 늦은 오류도 표시하거나 재시도하지 않는다', async () => {
  let reject;
  const state = setup(() => new Promise((_, fail) => { reject = fail; }));
  await state.timers.fire();
  state.polling.dispose();
  reject(new JobvisApiUnavailableError('late'));
  await new Promise(done => setImmediate(done));
  assert.deepEqual(state.errors, []);
  assert.equal(state.timers.callbacks.size, 0);
});

test('상태 조회 API는 네트워크 오류와 502·503·504를 일시적 오류로 분류한다', async t => {
  for (const status of [502, 503, 504]) {
    t.mock.method(globalThis, 'fetch', async () => new Response('', { status }));
    await assert.rejects(apiRequest('/import-runs/existing-run'), JobvisApiUnavailableError);
    t.mock.restoreAll();
  }
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('network'); });
  await assert.rejects(apiRequest('/import-runs/existing-run'), JobvisApiUnavailableError);
});

test('200 응답의 본문 수신 중 네트워크 오류도 같은 작업 조회를 재시도한다', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    start(controller) { controller.error(new TypeError('body network failure')); },
  }), { status: 200 }));
  const state = setup(() => apiRequest('/import-runs/existing-run'));
  await state.timers.fire();
  assert.ok(state.errors[0] instanceof JobvisApiUnavailableError);
  assert.deepEqual(state.timers.delays, [1000, 2000]);
  assert.equal(state.timers.callbacks.size, 1);
  state.polling.dispose();
});

test('본문 취소와 JSON 형식 오류는 일시적 연결 오류로 바꾸지 않는다', async t => {
  const cancelled = new DOMException('cancelled', 'AbortError');
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    start(controller) { controller.error(cancelled); },
  }), { status: 200 }));
  await assert.rejects(apiRequest('/import-runs/existing-run'), error => error === cancelled);
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => new Response('{', { status: 200 }));
  const state = setup(() => apiRequest('/import-runs/existing-run'));
  await state.timers.fire();
  assert.ok(state.errors[0] instanceof SyntaxError);
  assert.equal(state.timers.callbacks.size, 0);
  assert.equal(state.exhausted(), 0);
  state.polling.dispose();
});
