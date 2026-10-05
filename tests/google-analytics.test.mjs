import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../src/analytics/google-analytics-runtime.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { trackPageView, analyticsPagePath, isAnalyticsOrigin } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('운영 origin과 다른 로컬·preview 주소에서는 측정하지 않는다', () => {
  const origin = 'https://jobvis.example';
  assert.equal(isAnalyticsOrigin(origin, origin), true);
  assert.equal(isAnalyticsOrigin('http://localhost:3000', origin), false);
  assert.equal(isAnalyticsOrigin('https://jobvis-preview.example', origin), false);
  assert.equal(isAnalyticsOrigin(origin, ''), false);
});

test('Google tag가 처리하는 Arguments 명령으로 한 번 구성하고 경로마다 한 번 측정한다', () => {
  const browser = {};
  const visit = path => trackPageView(browser, 'G-TEST000000', path, 'https://jobvis.example');
  visit('/');
  visit('/');
  visit('/applications/private-first');
  visit('/applications/private-second');
  visit('/');
  for (const entry of browser.dataLayer) {
    assert.equal(Object.prototype.toString.call(entry), '[object Arguments]');
  }
  const calls = browser.dataLayer.map(entry => Array.from(entry));
  const configs = calls.filter(([command]) => command === 'config');
  assert.equal(configs.length, 1);
  assert.equal(configs[0][2].send_page_view, false);
  const views = calls.filter(([command, name]) => command === 'event' && name === 'page_view');
  assert.deepEqual(views.map(([, , page]) => page.page_path), ['/', '/applications/:id', '/applications/:id', '/']);
  assert.equal(JSON.stringify(calls).includes('private-'), false);
  assert.equal(views.every(([, , page]) => page.send_to === 'G-TEST000000' && page.page_referrer === ''), true);
});

test('알 수 없는 경로와 입력값을 분석에 전달하지 않는다', () => {
  assert.equal(analyticsPagePath('/private-email@example.com'), '/other');
  assert.equal(analyticsPagePath('/applications'), '/applications');
  assert.equal(analyticsPagePath('/applications/secret/extra'), '/other');
  const browser = {};
  trackPageView(browser, 'G-TEST000000', '/oauth/callback', 'https://jobvis.example');
  const config = browser.dataLayer.map(entry => Array.from(entry)).find(([command]) => command === 'config');
  assert.equal(config[2].page_location, 'https://jobvis.example/oauth/callback');
  assert.equal(config[2].page_referrer, '');
});
