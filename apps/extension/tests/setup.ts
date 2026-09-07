import { afterEach, beforeEach, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

vi.stubGlobal("chrome", fakeBrowser);
vi.stubGlobal("browser", fakeBrowser);

beforeEach(() => {
  fakeBrowser.reset();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});
