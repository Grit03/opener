import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mount } from "./helpers/mount";
import { createTranslationDisplayController } from "@/utils/translation-display";
import { collectTextForTranslation } from "@/utils/text-collection";

const translationSelector = "opener-translation";

const translations = () => [...document.querySelectorAll(translationSelector)];
const displayedTexts = () => translations().map((element) => element.textContent);

function startDisplay() {
  const controller = createTranslationDisplayController(document);
  onTestFinished(() => controller.destroy());
  return controller;
}

async function nextFrames() {
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

describe("화면에 들어온 글의 번역 영역 표시", () => {
  it("첫 콜백(callback) 실행 전에 껐다 켜도 새로 수집한 글을 한 번만 표시한다", async () => {
    mount(`<main><p>Original paragraph</p></main>`);
    const controller = createTranslationDisplayController(document);
    onTestFinished(() => controller.destroy());

    controller.disable();
    document.querySelector("p")!.textContent = "Updated paragraph";
    controller.enable();
    controller.enable();

    await vi.waitFor(() => {
      expect(document.querySelectorAll(translationSelector)).toHaveLength(1);
      expect(document.querySelector(translationSelector)?.textContent).toBe("Updated paragraph");
    });
  });

  it("번역 표시 기능을 종료하면 다시 켜도 번역이 나타나지 않는다", async () => {
    mount(`<main><p>Visible paragraph</p></main>`);
    const controller = createTranslationDisplayController(document);
    onTestFinished(() => controller.destroy());
    await vi.waitFor(() => expect(document.querySelectorAll(translationSelector)).toHaveLength(1));

    controller.destroy();
    controller.destroy();
    controller.enable();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

    expect(document.querySelectorAll(translationSelector)).toHaveLength(0);
  });

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

describe("본문 변경에 따른 번역 표시", () => {
  it("본문이 교체되면 이전 번역을 정리하고 새 본문을 표시한다", async () => {
    mount("<main><p>First page</p></main>");
    startDisplay();
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["First page"]));
    const previousMain = document.querySelector("main")!;
    previousMain.remove();
    mount("<main><p>Second page</p></main>");

    await vi.waitFor(() => expect(displayedTexts()).toEqual(["Second page"]));
    expect(previousMain.querySelector("opener-translation")).toBeNull();
  });

  it("늦게 추가된 본문을 수집하고 본문 영역의 우선순위를 다시 적용한다", async () => {
    mount("<article><p>Fallback content</p></article>");
    startDisplay();
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["Fallback content"]));

    mount("<main><p>Loaded content</p></main>");
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["Loaded content"]));

    document.querySelector("main")!.remove();
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["Fallback content"]));
  });

  it("원문 노드를 재사용해 글을 바꾸면 오래된 번역을 교체한다", async () => {
    mount("<main><p>Original text</p></main>");
    startDisplay();
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["Original text"]));

    document.querySelector("p")!.firstChild!.textContent = "Updated text";
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["Updated text"]));
  });

  it("같은 기준 요소에 글이 추가되어도 기존 번역을 원문에 섞지 않는다", async () => {
    mount("<main>First part</main>");
    startDisplay();
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["First part"]));
    // 실제 확장 CSS처럼 번역 요소가 블록이어도 원문의 경계로 취급하지 않는다.
    translations()[0]!.setAttribute("style", "display:block");

    document.querySelector("main")!.append(" and second part");
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["First part and second part"]));
    expect(collectTextForTranslation().map((source) => source.text)).toEqual([
      "First part and second part",
    ]);
  });

  it("다른 글이 추가되어도 기존 번역 요소를 유지하고 자체 변경으로 중복하지 않는다", async () => {
    mount("<main><p>Unchanged text</p></main>");
    startDisplay();
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["Unchanged text"]));
    const originalTranslation = translations()[0];

    document.querySelector("main")!.insertAdjacentHTML("beforeend", "<p>Added text</p>");
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["Unchanged text", "Added text"]));
    await nextFrames();
    expect(translations()[0]).toBe(originalTranslation);
    expect(displayedTexts()).toEqual(["Unchanged text", "Added text"]);
  });

  it("원문이 같아도 페이지가 지운 번역은 다음 갱신에서 다시 표시한다", async () => {
    mount("<main><p>Unchanged text</p></main>");
    startDisplay();
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["Unchanged text"]));

    translations()[0]!.remove();
    document.querySelector("main")!.insertAdjacentHTML("beforeend", "<p>Added text</p>");
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["Unchanged text", "Added text"]));
  });

  it("한 문단의 첫 글만 바뀌어도 번역은 원문 순서로 표시한다", async () => {
    mount("<main><p>First line<br>Second line</p></main>");
    startDisplay();
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["First line", "Second line"]));

    document.querySelector("p")!.firstChild!.textContent = "Updated first line";
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["Updated first line", "Second line"]));
  });

  it("기준 요소의 배치가 바뀌면 기존 번역의 배치도 갱신한다", async () => {
    mount('<main><p style="display:inline">Same text</p></main>');
    startDisplay();
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["Same text"]));
    expect(translations()[0]!.className).toBe("opener-translation--inline");

    document.querySelector("p")!.style.display = "block";
    await vi.waitFor(() => expect(translations()[0]!.className).toBe("opener-translation--block"));
    expect(displayedTexts()).toEqual(["Same text"]);
  });

  it.each([
    ["hidden", ""],
    ["translate", "no"],
    ["lang", "ko"],
  ])("%s 속성 변경에 따라 대상을 갱신한다", async (attribute, value) => {
    mount("<main><p>Visible text</p></main>");
    startDisplay();
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["Visible text"]));
    const main = document.querySelector("main")!;

    main.setAttribute(attribute, value);
    await vi.waitFor(() => expect(displayedTexts()).toEqual([]));
    main.removeAttribute(attribute);
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["Visible text"]));
  });

  it("화면 밖에 추가된 글은 스크롤로 화면에 들어올 때 표시한다", async () => {
    mount('<main style="height:100px;overflow:auto"><p>First text</p></main>');
    startDisplay();
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["First text"]));
    const main = document.querySelector("main")!;

    main.insertAdjacentHTML("beforeend", '<div style="height:400px"></div><p>Later text</p>');
    await nextFrames();
    expect(displayedTexts()).toEqual(["First text"]);
    main.scrollTop = main.scrollHeight;
    await vi.waitFor(() => expect(displayedTexts()).toEqual(["First text", "Later text"]));
  });

  it.each(["disable", "destroy"] as const)(
    "갱신 예약 후 %s하면 새 번역이 나타나지 않는다",
    async (action) => {
      mount("<main><p>First text</p></main>");
      const controller = startDisplay();
      await vi.waitFor(() => expect(displayedTexts()).toEqual(["First text"]));
      document.querySelector("p")!.textContent = "Second text";
      // MutationObserver가 갱신을 예약할 기회를 준다.
      await Promise.resolve();

      controller[action]();
      await nextFrames();
      expect(displayedTexts()).toEqual([]);
      controller.enable();
      if (action === "disable") {
        await vi.waitFor(() => expect(displayedTexts()).toEqual(["Second text"]));
      } else {
        await nextFrames();
        expect(displayedTexts()).toEqual([]);
      }
    },
  );
});
