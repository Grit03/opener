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

describe("번역하지 않을 영역 제외", () => {
  // R7·C3: 문서 정보·실행 코드는 CSS로 표시해도 본문에 포함하지 않음
  it.each([
    ["title", `<title style="display:block">Document title</title>`],
    ["script", `<script type="application/json" style="display:block">{"key":"value"}</script>`],
    ["style", `<style style="display:block">.fixture-unused { color: red; }</style>`],
    ["noscript", `<noscript>Fallback content</noscript>`],
    ["template", `<template><p>Template content</p></template>`],
  ])("%s의 내용을 제외한다", (_tag, markup) => {
    mount(`<main><p>Before</p>${markup}<p>After</p></main>`);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Before", "After"]);
  });

  // R5·C3: 입력값·선택지·버튼 문구는 번역할 본문에서 제외
  it.each([
    ["input", `<input value="Input value" placeholder="Input hint">`],
    ["textarea", `<textarea>Textarea value</textarea>`],
    ["select", `<select><optgroup label="Group"><option>Choice</option></optgroup></select>`],
    ["datalist", `<datalist><option>Suggestion</option></datalist>`],
    ["button", `<button><span>Submit</span></button>`],
  ])("%s 입력 요소의 내용을 제외한다", (_tag, markup) => {
    mount(`<main><p>Before</p>${markup}<p>After</p></main>`);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Before", "After"]);
  });

  // R5·C3: 편집 가능한 영역 전체를 제외하고, 내부 재지정으로도 수집하지 않음
  it.each(["true", "", "plaintext-only"])(
    'contenteditable="%s" 영역과 그 자손을 제외한다',
    (value) => {
      mount(`
        <main><p>Before</p><div contenteditable="${value}">
          Editable <span>inherited text</span>
          <p contenteditable="false" translate="yes">Editor content</p>
        </div><p>After</p></main>
      `);

      const result = collectTextForTranslation(document);

      expect(result.map(({ text }) => text)).toEqual(["Before", "After"]);
    },
  );

  // R5: 편집 영역 밖의 명시적인 false는 일반 본문으로 수집
  it("contenteditable=false인 일반 본문은 유지한다", () => {
    mount(`<main><p contenteditable="false">Read only <em>text</em></p></main>`);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Read only text"]);
  });

  // R7·C3: pre는 표시 방식과 무관하게, code는 블록 배치일 때 자손까지 제외
  it.each([
    ["pre", `<pre style="display:inline">Preformatted <code>code</code></pre>`],
    ["block code", `<code style="display:block">Block <span translate="yes">code</span></code>`],
    ["flex code", `<code style="display:flex"><span>Flex code</span></code>`],
    ["grid code", `<code style="display:grid"><span>Grid code</span></code>`],
    ["flow-root code", `<code style="display:flow-root">Flow root code</code>`],
  ])("%s의 내용을 제외한다", (_label, markup) => {
    mount(`<main><p>Before</p>${markup}<p>After</p></main>`);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Before", "After"]);
  });

  // R7·C3: 별도 문서·그래픽·미디어의 대체 텍스트와 자손도 제외
  it.each([
    ["iframe", `<iframe>Frame fallback</iframe>`],
    ["object", `<object><p translate="yes">Object fallback</p></object>`],
    ["embed", `<embed type="application/octet-stream">`],
    ["svg", `<svg><title>Graphic title</title><text>Graphic text</text></svg>`],
    ["math", `<math><mtext>Formula text</mtext></math>`],
    ["canvas", `<canvas><span>Canvas fallback</span></canvas>`],
    ["audio", `<audio><span>Audio fallback</span></audio>`],
    ["video", `<video><span>Video fallback</span></video>`],
    ["img", `<img alt="Image description">`],
  ])("%s 콘텐츠를 제외한다", (_tag, markup) => {
    mount(`<main><p>Before</p>${markup}<p>After</p></main>`);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Before", "After"]);
  });

  // R1·R5·R7: 후보 본문 자체나 그 조상이 제외 영역인 경우에도 적용
  it.each([
    `<main contenteditable="true"><p>Editable main</p></main>`,
    `<div contenteditable="true"><main><p>Editable main</p></main></div>`,
    `<pre><main><p>Code main</p></main></pre>`,
    `<main><button>Only control</button><pre>Only code</pre></main>`,
  ])("후보 본문이 제외할 내용뿐이면 article로 넘어간다: %s", (markup) => {
    mount(`${markup}<article><p>Article text</p></article>`);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Article text"]);
  });
});

describe("translate 상속과 재지정", () => {
  // R6·C3: 가장 가까운 유효한 translate 값을 상속하고 대소문자는 구분하지 않음
  it.each(["no", "NO"])("translate=%s와 값을 상속한 자손을 제외한다", (value) => {
    mount(`
      <main><p>Before</p><div translate="${value}">
        Excluded <span>inherited text</span><span translate="invalid">Still excluded</span>
      </div><p>After</p></main>
    `);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Before", "After"]);
  });

  // R3·R6: 제외한 인라인 글의 노드가 결과에 섞이지 않고 나머지는 문장으로 유지
  // Google 번역과 Chrome 번역이 따르는 관례. 검색 결과의 URL(cite)이 이렇게 표시된다.
  it("class=notranslate 영역과 그 자손을 제외한다", () => {
    mount(`
      <main><p>Title</p><div class="result notranslate">
        <cite style="display:block">https://nodejs.org › <span translate="yes">docs</span></cite>
      </div><p>After</p></main>
    `);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Title", "After"]);
  });

  it("translate=no인 인라인 글을 제외하고 원본 노드 참조를 유지한다", () => {
    mount(`<main><p>Hello <span translate="no">private </span>world!</p></main>`);
    const paragraph = document.querySelector("p")!;

    const result = collectTextForTranslation(document);

    expect(result).toEqual([
      {
        text: "Hello world!",
        anchor: paragraph,
        sourceNodes: [paragraph.firstChild, paragraph.lastChild],
      },
    ]);
  });

  // R6: no인 부모에서도 자식의 yes·빈 값으로 번역을 다시 허용할 수 있음
  it.each(["yes", "YES", ""])(
    'translate=no 안에서 translate="%s"인 자식과 그 자손만 다시 수집한다',
    (value) => {
      mount(`
        <main translate="no">Excluded before
          <p translate="${value}">Allowed <em>text</em><span translate="no"> excluded</span></p>
          Excluded after
        </main>
      `);

      const result = collectTextForTranslation(document);

      expect(result.map(({ text }) => text)).toEqual(["Allowed text"]);
    },
  );

  // R1·R6: 본문 바깥 조상에서 상속한 번역 금지도 후보 선택에 반영
  it("조상의 translate=no로 main에 수집할 글이 없으면 article로 넘어간다", () => {
    mount(`
      <div translate="no"><main><p>Excluded main</p></main></div>
      <article><p>Article text</p></article>
    `);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Article text"]);
  });
});

describe("목표 언어로 쓰인 글 제외", () => {
  // 목표 언어(한국어)로 표시된 글은 지역·대소문자와 관계없이 제외
  it.each(["ko", "ko-KR", "KO-kr", "ko-Kore"])('lang="%s"인 글을 제외한다', (lang) => {
    mount(`<main><p>Before</p><p lang="${lang}">안녕하세요</p><p>After</p></main>`);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Before", "After"]);
  });

  // 목표 언어가 아니거나 언어를 알 수 없으면 번역할 글로 본다
  it.each([
    ["영어", ` lang="en"`],
    ["영어 지역 태그", ` lang="en-US"`],
    ["다른 언어", ` lang="ja"`],
    ["빈 값", ` lang=""`],
    ["누락", ""],
    ["잘못된 값", ` lang="!!!"`],
  ])("lang이 %s인 글은 수집한다", (_label, attribute) => {
    mount(`<main><p${attribute}>Hello</p></main>`);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Hello"]);
  });

  // 가장 가까운 lang을 따르므로 자식이 부모의 언어를 재지정할 수 있다. 빈 값은 "알 수 없음"으로 재지정한다.
  it("부모의 lang을 상속하고 자식의 lang으로 재지정한다", () => {
    mount(`
      <main lang="ko">
        <p>상속한 한국어</p>
        <p lang="en">English <span>inherited</span></p>
        <p lang="">Unknown</p>
        <div lang="en"><p lang="ko">다시 한국어</p></div>
      </main>
    `);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["English inherited", "Unknown"]);
  });

  // lang이 없거나 틀려도 한글이 하나라도 있는 글은 이미 목표 언어로 쓰인 글로 본다
  it.each([
    ["lang이 없는", `<p>안녕하세요</p>`],
    ["lang이 영어로 잘못 표시된", `<p lang="en">안녕하세요</p>`],
    ["영어가 더 많이 섞인", `<p>Claude Code 설치</p>`],
  ])("%s 한국어 글을 제외한다", (_label, markup) => {
    mount(`<main><p>Before</p>${markup}<p>After</p></main>`);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Before", "After"]);
  });

  // 한글 여부는 이어 붙인 글 전체로 판단하므로 인라인 요소 안의 영어만 따로 남지 않는다
  it("한국어 문장 안의 영어 링크 글을 따로 수집하지 않는다", () => {
    mount(`<main><p>Before</p><p>이 문서는 <a href="/react">React</a> 기준입니다</p></main>`);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Before"]);
  });

  // 본문 영역 바깥 조상의 lang도 따르므로 후보 본문에 글이 없으면 다음 후보로 넘어간다
  it("조상의 lang이 목표 언어라 main에 수집할 글이 없으면 article로 넘어간다", () => {
    mount(`
      <div lang="ko"><main><p>한국어 본문</p></main></div>
      <article><p>Article text</p></article>
    `);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Article text"]);
  });
});

describe("화면에 보이지 않는 글 제외", () => {
  // R8: 계산된 스타일로 보이지 않는 글은 자신과 조상 어느 쪽에서 숨겨도 제외
  it.each([
    ["hidden", `<p hidden>Hidden attribute</p>`],
    ["조상의 display: none", `<div style="display:none"><p>Display none</p></div>`],
    ["조상의 visibility: hidden", `<div style="visibility:hidden"><p>Invisible</p></div>`],
    ["조상의 opacity: 0", `<div style="opacity:0"><p><span>Transparent</span></p></div>`],
    ["content-visibility: hidden", `<div style="content-visibility:hidden"><p>Skipped</p></div>`],
    [
      "display: none 안의 contents",
      `<div style="display:none"><span style="display:contents">Contents</span></div>`,
    ],
    [
      "visibility: hidden인 contents",
      `<span style="display:contents;visibility:hidden">Contents</span>`,
    ],
  ])("%s인 글을 제외한다", (_label, markup) => {
    mount(`<main><p>Before</p>${markup}<p>After</p></main>`);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Before", "After"]);
  });

  // R8: hidden 속성이 아니라 CSS가 계산한 표시 여부를 따른다
  it("CSS로 다시 표시한 hidden 요소의 글은 수집한다", () => {
    mount(`<main><p hidden style="display:block">Shown again</p></main>`);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Shown again"]);
  });

  // R8: 닫힌 details는 summary만 보이고, 열린 details는 내용도 보인다
  it.each([
    ["닫힌", "", ["Summary"]],
    ["열린", " open", ["Summary", "Details body"]],
  ])("%s details에서 보이는 글만 수집한다", (_label, open, expected) => {
    mount(`<main><details${open}><summary>Summary</summary><p>Details body</p></details></main>`);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(expected);
  });

  // R8: visibility는 상속되므로 자식이 visible로 다시 표시할 수 있다
  it("visibility: hidden인 부모 안에서 visible인 자식의 글은 수집한다", () => {
    mount(`
      <main><div style="visibility:hidden">
        Hidden parent
        <p style="visibility:visible">Visible child</p>
      </div></main>
    `);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Visible child"]);
  });

  // R8: 화면 밖에서 렌더링을 건너뛴 content-visibility: auto의 글도 보이는 글로 본다
  it("화면 밖 content-visibility: auto의 글은 수집한다", () => {
    mount(`
      <main>
        <div style="height:10000px"></div>
        <div style="content-visibility:auto"><p>Far below</p></div>
      </main>
    `);

    const result = collectTextForTranslation(document);

    expect(result.map(({ text }) => text)).toEqual(["Far below"]);
  });
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
