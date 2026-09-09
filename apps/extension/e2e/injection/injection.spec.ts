import { test, expect } from '../fixtures';

test('로컬 HTML 페이지에 content script가 주입된다', async ({ page, extensionId }) => {
  // 접속 전에 기다리기 시작해야 주입 직후의 로그를 놓치지 않는다.
  // 페이지 자체의 로그와 구분하기 위해 확장 URL도 확인한다.
  const [, response] = await Promise.all([
    page.waitForEvent('console', {
      predicate: (message) =>
        message.type() === 'log' &&
        message.text() === 'Hello content.' &&
        message.location().url.startsWith(`chrome-extension://${extensionId}/`),
      timeout: 10_000,
    }),
    page.goto('/injection/basic.html'),
  ]);

  expect(response?.ok()).toBe(true);
  await expect(
    page.getByRole('heading', { name: 'Opener E2E 테스트 페이지' }),
  ).toBeVisible();
});
