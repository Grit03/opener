import { describe, expect, it, vi } from "vitest";
import { mount } from "./helpers/mount";
import { createTranslationDisplayController } from "@/utils/translation-display";

const translationSelector = "opener-translation";

describe("화면에 들어온 글의 번역 영역 표시", () => {
  it("문단 안에 표시하고 목록·표에서는 올바른 HTML 구조를 유지한다", async () => {
    mount(`
      <main>
        <p id="paragraph">Open <a href="#target">the link</a> and run <code>npm start</code>.</p>
        <ul><li id="item">List item</li></ul>
        <table><tbody><tr><td id="cell">Table cell</td></tr></tbody></table>
        <p id="inline" style="display:inline">Inline paragraph</p>
        <p id="unsafe">&lt;img src=x onerror="window.__executed = true"&gt;</p>
        <input value="typed value">
      </main>
    `);
    const paragraph = document.querySelector("#paragraph")!;
    const link = document.querySelector("a")!;
    const input = document.querySelector("input")!;
    const originalText = paragraph.firstChild;
    const clicked = vi.fn();
    link.addEventListener("click", (event) => {
      event.preventDefault();
      clicked();
    });

    const controller = createTranslationDisplayController(document);

    await vi.waitFor(() => expect(document.querySelectorAll(translationSelector)).toHaveLength(5));
    const paragraphTranslation = paragraph.querySelector(translationSelector);
    expect(paragraph.firstChild).toBe(originalText);
    expect(paragraphTranslation?.matches(translationSelector)).toBe(true);
    expect(paragraph.lastChild).toBe(paragraphTranslation);
    expect(paragraphTranslation?.textContent).toBe("Open the link and run npm start.");
    expect(document.querySelector("#item")?.querySelector(translationSelector)).not.toBeNull();
    expect(document.querySelector("#cell")?.querySelector(translationSelector)).not.toBeNull();
    expect(
      document
        .querySelector("#inline > opener-translation")
        ?.classList.contains("opener-translation--inline"),
    ).toBe(true);
    expect(document.querySelector("#unsafe img")).toBeNull();
    expect(document.querySelector("#unsafe > opener-translation")?.textContent).toContain("<img");
    expect(document.querySelector(translationSelector)?.getAttribute("aria-hidden")).toBe("true");
    expect(input.value).toBe("typed value");

    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(clicked).toHaveBeenCalledOnce();

    controller.destroy();
  });

  it("목록 안에서 원문이 다른 요소에 감싸져 있으면 감싼 요소 바로 뒤에 표시한다", async () => {
    mount(`
      <main>
        <ul><li id="item"><span id="wrapper">Wrapped item</span><ul><li>Child item</li></ul></li></ul>
      </main>
    `);
    const controller = createTranslationDisplayController(document);

    await vi.waitFor(() => expect(document.querySelectorAll(translationSelector)).toHaveLength(2));
    const wrapperTranslation = document.querySelector("#wrapper")?.nextElementSibling;
    expect(wrapperTranslation?.matches(translationSelector)).toBe(true);
    expect(wrapperTranslation?.textContent).toBe("Wrapped item");

    controller.destroy();
  });

  it("내부 스크롤에서 새 문장만 한 번 표시하고 OFF 동안에는 만들지 않는다", async () => {
    mount(`
      <main id="scroller" style="height:100px;overflow:auto">
        <p style="height:80px">First paragraph</p>
        <div style="height:300px"></div>
        <p id="second" style="height:80px">Second paragraph</p>
        <div style="height:300px"></div>
        <p id="third" style="height:80px">Third paragraph</p>
      </main>
    `);
    const scroller = document.querySelector<HTMLElement>("#scroller")!;
    const controller = createTranslationDisplayController(document);

    await vi.waitFor(() => expect(document.querySelectorAll(translationSelector)).toHaveLength(1));
    scroller.scrollTop = 380;
    scroller.dispatchEvent(new Event("scroll"));
    await vi.waitFor(() => expect(document.querySelectorAll(translationSelector)).toHaveLength(2));

    scroller.scrollTop = 0;
    scroller.dispatchEvent(new Event("scroll"));
    scroller.scrollTop = 380;
    scroller.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    expect(document.querySelectorAll(translationSelector)).toHaveLength(2);

    controller.disable();
    expect(document.querySelectorAll(translationSelector)).toHaveLength(0);

    document.querySelector("#third")!.firstChild!.textContent = "Updated third paragraph";
    scroller.scrollTop = 760;
    scroller.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    expect(document.querySelectorAll(translationSelector)).toHaveLength(0);

    controller.enable();
    await vi.waitFor(() =>
      expect(
        document.querySelector("#third > opener-translation")?.matches(translationSelector),
      ).toBe(true),
    );
    expect(document.querySelectorAll(translationSelector)).toHaveLength(1);
    expect(document.querySelector("#third > opener-translation")?.textContent).toBe(
      "Updated third paragraph",
    );

    controller.destroy();
  });

  it("표시 직전에 숨겨졌거나 DOM에서 빠진 원문은 건너뛴다", async () => {
    mount(`
      <main>
        <p id="hidden" style="margin-top:200vh">Hidden later</p>
        <p id="removed" style="margin-top:200vh">Removed later</p>
      </main>
    `);
    const hidden = document.querySelector<HTMLElement>("#hidden")!;
    const removed = document.querySelector("#removed")!;
    const controller = createTranslationDisplayController(document);

    hidden.style.display = "none";
    removed.remove();
    hidden.style.marginTop = "0";
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

    expect(document.querySelectorAll(translationSelector)).toHaveLength(0);
    controller.destroy();
  });

  it("화면보다 긴 문단도 처리한다", async () => {
    mount(`
      <main><p style="height:200vh">Tall paragraph</p></main>
    `);
    const controller = createTranslationDisplayController(document);

    await vi.waitFor(() => expect(document.querySelectorAll(translationSelector)).toHaveLength(1));

    controller.destroy();
  });
});
