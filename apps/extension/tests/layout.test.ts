// tests/layout.test.ts
import { describe, expect, it } from "vitest";
import { isBlock } from "@/utils/layout";
import { mount } from "./helpers/mount";

describe("isBlock", () => {
  it("태그가 아니라 computed display 로 판정한다", () => {
    mount(`
    <span id="block-span" style="display:block">T</span>
    <span id="inline-span">i</span>
    <div id="inline-div" style="display:inline">d</div>`);
    expect(isBlock(document.getElementById("block-span")!)).toBe(true);
    expect(isBlock(document.getElementById("inline-span")!)).toBe(false);
    expect(isBlock(document.getElementById("inline-div")!)).toBe(false);
  });
});
