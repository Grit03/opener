import { describe, expect, it } from "vitest";
import { mount } from "./helpers/mount";
import { collectTextForTranslation } from "@/utils/text-collection";

describe("본문 선택과 탐색", () => {
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
});

describe("문장 묶기", () => {
  // R3·C1: 링크 안팎의 글을 묶고 원본 노드를 순서대로 반환
  it("링크가 섞인 문장을 하나로 모은다", () => {
    mount(`<main><p>Hello <a href="/world">world</a>!</p></main>`);
    const paragraph = document.querySelector("p")!;
    const link = document.querySelector("a")!;

    const result = collectTextForTranslation(document);

    expect(result).toEqual([
      {
        text: "Hello world!",
        anchor: paragraph,
        sourceNodes: [paragraph.firstChild, link.firstChild, paragraph.lastChild],
      },
    ]);
  });

  // R3·R7: 강조·인라인 코드도 문장에 포함하며, 합친 뒤 공백을 정리
  it.each(["em", "strong", "code"])("%s 안팎의 글을 공백과 함께 이어 붙인다", (tag) => {
    mount(`<main><p>  Run\n <${tag}>npm start</${tag}>\t now.  </p></main>`);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Run npm start now."]);
  });

  // R3: 요소 사이에 따로 놓인 공백도 문장에 포함
  it("인라인 요소 사이의 공백을 유지한다", () => {
    mount(`<main><p><span>Hello</span> <span>world</span>!</p></main>`);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Hello world!"]);
  });
});

describe("제목·문단·목록·표·줄바꿈으로 나누기", () => {
  // R2·C2: 제목과 문단은 CSS가 인라인이어도 앞뒤 글과 따로 모음
  it.each(["h1", "h2", "h3", "h4", "h5", "h6", "p"])(
    "%s 요소는 인라인으로 표시돼도 앞뒤 글과 나눈다",
    (tag) => {
      mount(`<main>Before<${tag} style="display:inline">A<span>B</span></${tag}>After</main>`);

      const result = collectTextForTranslation(document);

      expect(result).toMatchObject([
        { text: "Before", anchor: document.querySelector("main") },
        { text: "AB", anchor: document.querySelector(tag) },
        { text: "After", anchor: document.querySelector("main") },
      ]);
    },
  );

  // R2·C2: 목록 항목은 CSS가 인라인이어도 따로 모음
  it.each(["ul", "ol"])("%s 안의 목록 항목을 각각 나눈다", (tag) => {
    mount(`
        <main><${tag}>
          <li style="display:inline">First <em>item</em></li>
          <li style="display:inline">Second <strong>item</strong></li>
        </${tag}></main>
      `);

    const result = collectTextForTranslation(document);

    expect(result).toMatchObject([
      { text: "First item", anchor: document.querySelector("li:first-child") },
      { text: "Second item", anchor: document.querySelector("li:last-child") },
    ]);
  });

  // R2·R4·R9·C2: 안쪽 문단과 하위 목록을 중복 없이 DOM 순서대로 반환
  it("목록 안의 문단과 하위 목록을 나눈 뒤 바깥 글을 이어서 모은다", () => {
    mount(`
        <main><ul><li id="outer">
          First<span> item</span>
          <p>Inner <em>paragraph</em></p>
          <ul><li id="inner">Nested <strong>item</strong></li></ul>
          Tail<span> text</span>
        </li></ul></main>
      `);

    const result = collectTextForTranslation(document);

    expect(result).toMatchObject([
      { text: "First item", anchor: document.querySelector("#outer") },
      { text: "Inner paragraph", anchor: document.querySelector("p") },
      { text: "Nested item", anchor: document.querySelector("#inner") },
      { text: "Tail text", anchor: document.querySelector("#outer") },
    ]);
  });

  // R2·C2: 용어와 설명은 CSS 배치와 무관하게 따로 모음
  it("인라인으로 표시된 용어와 설명을 나눈다", () => {
    mount(`
        <main><dl>
          <dt style="display:inline">First <em>term</em></dt>
          <dd style="display:inline">First <strong>definition</strong></dd>
        </dl></main>
      `);

    const result = collectTextForTranslation(document);

    expect(result).toMatchObject([
      { text: "First term", anchor: document.querySelector("dt") },
      { text: "First definition", anchor: document.querySelector("dd") },
    ]);
  });

  // R2·C2: 표 제목과 각 칸은 CSS 배치와 무관하게 따로 모음
  it("인라인으로 표시된 표 제목과 각 칸을 나눈다", () => {
    mount(`
        <main><table>
          <caption style="display:inline">Table <em>title</em></caption>
          <tbody><tr>
            <th style="display:inline">Column <strong>one</strong></th>
            <td style="display:inline">Cell <span>one</span></td>
            <td style="display:inline">Cell <span>two</span></td>
          </tr></tbody>
        </table></main>
      `);

    const result = collectTextForTranslation(document);

    expect(result).toMatchObject([
      { text: "Table title", anchor: document.querySelector("caption") },
      { text: "Column one", anchor: document.querySelector("th") },
      { text: "Cell one", anchor: document.querySelector("td:first-of-type") },
      { text: "Cell two", anchor: document.querySelector("td:last-of-type") },
    ]);
  });

  // R3·R9: br에서 나누고, 연속 줄바꿈으로 생긴 빈 글은 제외
  it("같은 문단에서도 br로 나뉜 글은 따로 모은다", () => {
    mount(`<main><p>First <em>line</em><br><br>Second <strong>line</strong><br></p></main>`);
    const paragraph = document.querySelector("p")!;

    const result = collectTextForTranslation(document);

    expect(result).toMatchObject([
      { text: "First line", anchor: paragraph },
      { text: "Second line", anchor: paragraph },
    ]);
  });
});

describe("CSS 배치로 나누기", () => {
  // R2·R3: span도 블록 배치이면 앞뒤 글과 따로 모음
  it.each(["block", "flex", "grid", "flow-root"])(
    "display: %s인 span의 앞뒤 글을 나눈다",
    (display) => {
      mount(
        `<main>Before<span> text</span><span id="block" style="display:${display}">Middle</span>After<span> text</span></main>`,
      );

      const result = collectTextForTranslation(document);

      expect(result).toMatchObject([
        { text: "Before text", anchor: document.querySelector("main") },
        { text: "Middle", anchor: document.querySelector("#block") },
        { text: "After text", anchor: document.querySelector("main") },
      ]);
    },
  );

  // R3: div도 인라인 배치나 contents이면 주변 글과 함께 모음
  it.each(["inline", "inline-block", "inline-flex", "inline-grid", "inline-table", "contents"])(
    "display: %s인 div의 글을 주변 글과 묶는다",
    (display) => {
      mount(`<main>Hello <div style="display:${display}">world</div>!</main>`);

      const result = collectTextForTranslation(document);

      expect(result).toMatchObject([
        { text: "Hello world!", anchor: document.querySelector("main") },
      ]);
    },
  );

  // R2·R3: contents 안에서도 자식 문단은 따로 모음
  it("display: contents 안의 문단은 주변 글과 나눈다", () => {
    mount(`
        <main><div style="display:contents">
          Before<span> text</span>
          <p>Inner <em>paragraph</em></p>
          After<span> text</span>
        </div></main>
      `);

    const result = collectTextForTranslation(document);

    expect(result).toMatchObject([
      { text: "Before text", anchor: document.querySelector("main") },
      { text: "Inner paragraph", anchor: document.querySelector("p") },
      { text: "After text", anchor: document.querySelector("main") },
    ]);
  });

  // R2·R3·R9: 빈 문단·블록도 앞뒤 글을 나누며 빈 결과는 반환하지 않음
  it.each([`<p></p>`, `<span style="display:block"></span>`])(
    "빈 요소 %s의 앞뒤 글을 나눈다",
    (separator) => {
      mount(`<main>First<span> part</span>${separator}Last<span> part</span></main>`);

      const result = collectTextForTranslation(document);

      expect(result.map(({ text }) => text)).toEqual(["First part", "Last part"]);
    },
  );
});

describe("원문 보존", () => {
  // R10·C6: 수집 중 원문 글·요소·링크를 변경하지 않음
  it("원문 DOM을 변경하지 않는다", () => {
    mount(`<main><p>Hello <a href="/world">world</a>!</p><input value="initial"></main>`);
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
