import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";

// WXT 빌드 출력 디렉터리. 테스트 전에 `wxt build`가 먼저 실행되어야 한다.
const pathToExtension = path.resolve(import.meta.dirname, "../.output/chrome-mv3");

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    // 확장은 persistent context에서만 로드된다. channel: 'chromium'은 headless 실행을 위한 설정.
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    // MV3 확장의 background는 service worker다. 아직 없으면 생성될 때까지 기다린다.
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) serviceWorker = await context.waitForEvent("serviceworker");
    // chrome-extension://<extensionId>/background.js 에서 <extensionId> 부분
    await use(serviceWorker.url().split("/")[2]!);
  },
});

export const expect = test.expect;
