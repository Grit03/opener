import { describe, expect, it } from "vitest";
import { mount } from "./helpers/mount";
import { collectTextForTranslation } from "@/utils/text-collection";

describe("collectTextForTranslation", () => {
  // R1: 본문 우선 선택 · R9: 같은 위치의 중복 수집 방지
  it("main을 우선하고 그 안의 article을 중복 수집하지 않는다", () => {
    mount(`<p>Outside</p><main><article><p>Hello</p></article></main><article>Other</article>`);
    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Hello"]);
  });

  // R1: 본문 선택 · R4: 문서 순서 유지 · R9: 중첩 영역의 중복 수집 방지
  it("main이 없으면 바깥 article들을 문서 순서로 수집한다", () => {
    mount(
      `<p>Outside</p><article><p>First</p><article><p>Nested</p></article></article><article>Last</article>`,
    );
    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["First", "Nested", "Last"]);
  });

  // R1: 본문 표시가 없으면 문서에서 수집 · R4: 문서 순서 유지
  it("본문 표시가 없으면 body의 직접 텍스트도 수집한다", () => {
    mount(`First<p>Second</p>Last`);
    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["First", "Second", "Last"]);
  });

  // R4: CSS의 시각적 순서가 아닌 DOM 문서 순서 유지
  it("CSS 순서가 달라도 DOM 순서를 유지한다", () => {
    mount(
      `<main style="display:flex;flex-direction:column-reverse"><p>First</p><p>Second</p></main>`,
    );
    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["First", "Second"]);
  });

  // R9: 빈 글 제외, 중복 여부는 문자열이 아닌 DOM 위치로 판단
  it("빈 글은 버리고 서로 다른 위치의 같은 글은 둘 다 남긴다", () => {
    mount(`<main><p> \n </p><p>Hello</p><p>Hello</p></main>`);
    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Hello", "Hello"]);
    expect(result[0]!.sourceNodes[0]).not.toBe(result[1]!.sourceNodes[0]);
  });

  // R9·C5: 호출마다 같은 위치의 글을 한 번씩 담은 새 결과 반환
  it("원본 참조를 반환하고 반복 호출은 이전 결과에 누적하지 않는다", () => {
    mount(`<main><p>Hello</p></main>`);
    const paragraph = document.querySelector("p")!;
    const first = collectTextForTranslation(document);
    const second = collectTextForTranslation(document);
    expect(first).toEqual([
      {
        text: "Hello",
        anchor: paragraph,
        sourceNodes: [paragraph.firstChild],
      },
    ]);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second[0]!.sourceNodes).not.toBe(first[0]!.sourceNodes);
  });

  // R10·C6: 수집 중 원문 글·요소·링크를 변경하지 않음
  it("원문 DOM을 변경하지 않는다", () => {
    mount(`<main><p>Hello</p><a href="/world">World</a><input value="initial"></main>`);
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    try {
      collectTextForTranslation(document);

      expect(observer.takeRecords()).toEqual([]);
    } finally {
      observer.disconnect();
    }
  });

  // R10·C6: 사용자가 입력한 현재 값 보존
  it("사용자가 입력한 값을 유지한다", () => {
    mount(`<main><p>Hello</p><input value="initial"></main>`);
    document.querySelector("input")!.value = "User draft";

    collectTextForTranslation(document);

    expect(document.querySelector("input")!.value).toBe("User draft");
  });
});
