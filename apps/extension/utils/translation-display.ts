import { isBlock, type UppercaseHtmlTagName } from "./layout";
import {
  collectTextForTranslation,
  isSourceTextTranslatable,
  type SourceText,
} from "./text-collection";

export interface TranslationDisplayController {
  enable(): void;
  disable(): void;
  destroy(): void;
}

const TRANSLATION_TAG = "opener-translation";
const INLINE_TRANSLATION_CLASS = "opener-translation--inline";
const BLOCK_TRANSLATION_CLASS = "opener-translation--block";
const TOGGLE_CLASS = "opener-translation-toggle";
/** 형제로 번역을 끼워 넣으면 HTML 구조가 깨지는 요소. 번역을 요소 안에 넣는다. */
const INNER_TRANSLATION_TAGS: ReadonlySet<string> = new Set<UppercaseHtmlTagName>([
  "HTML",
  "BODY",
  "MAIN",
  "ARTICLE",
  "UL",
  "OL",
  "MENU",
  "DL",
  "LI",
  "DT",
  "DD",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "TH",
  "TD",
  "CAPTION",
]);

/** 화면에 들어온 번역 후보 옆에 번역 표시 영역을 만든다. */
export function createTranslationDisplayController(
  doc: Document = document,
): TranslationDisplayController {
  const toggle = appendTranslationToggle(doc);
  const translationElements = new Map<SourceText, HTMLElement>();
  const visibleAnchors = new Set<Element>();
  const sourcesByAnchor = new Map<Element, SourceText[]>();
  let observer: IntersectionObserver | null = null;
  let enabled = false;
  let destroyed = false;
  let session = 0;

  const canDisplayTranslation = (source: SourceText) => {
    return (
      enabled && !doc.hidden && !translationElements.has(source) && isSourceTextTranslatable(source)
    );
  };

  const displayTranslation = (source: SourceText) => {
    if (!canDisplayTranslation(source)) return;

    const translation = createTranslationElement(doc, source);
    if (!insertTranslation(source, translation)) return;
    translationElements.set(source, translation);
  };

  const displayVisibleTranslations = () => {
    [...visibleAnchors]
      .flatMap((anchor) => sourcesByAnchor.get(anchor) ?? [])
      .forEach(displayTranslation);
  };

  const observeSourceAnchors = (currentSession: number) => {
    observer = new IntersectionObserver((entries) => {
      if (!enabled || currentSession !== session) return;

      updateVisibleAnchors(visibleAnchors, entries);
      if (doc.hidden) return;

      entries
        .filter((entry) => entry.isIntersecting)
        .flatMap((entry) => sourcesByAnchor.get(entry.target) ?? [])
        .forEach(displayTranslation);
    });
    sourcesByAnchor.forEach((_sources, anchor) => observer?.observe(anchor));
  };

  const enable = () => {
    if (enabled || destroyed) return;

    enabled = true;
    session += 1;
    updateTranslationToggle(toggle, enabled);

    for (const source of collectTextForTranslation(doc)) {
      const sources = sourcesByAnchor.get(source.anchor) ?? [];
      sources.push(source);
      sourcesByAnchor.set(source.anchor, sources);
    }
    observeSourceAnchors(session);
  };

  const disable = () => {
    enabled = false;
    session += 1;
    observer?.disconnect();
    observer = null;
    visibleAnchors.clear();
    sourcesByAnchor.clear();
    translationElements.forEach((translation) => translation.remove());
    translationElements.clear();
    updateTranslationToggle(toggle, enabled);
  };

  const onVisibilityChange = () => {
    if (!enabled || doc.hidden) return;

    displayVisibleTranslations();
    observer?.disconnect();
    sourcesByAnchor.forEach((_sources, anchor) => observer?.observe(anchor));
  };

  const onToggle = () => {
    if (enabled) disable();
    else enable();
  };

  const destroy = () => {
    if (destroyed) return;
    disable();
    destroyed = true;
    toggle.removeEventListener("click", onToggle);
    doc.removeEventListener("visibilitychange", onVisibilityChange);
    toggle.remove();
  };

  toggle.addEventListener("click", onToggle);
  doc.addEventListener("visibilitychange", onVisibilityChange);
  enable();

  return { enable, disable, destroy };
}

function appendTranslationToggle(doc: Document): HTMLButtonElement {
  const toggle = doc.createElement("button");
  toggle.type = "button";
  toggle.className = TOGGLE_CLASS;
  (doc.body ?? doc.documentElement).append(toggle);
  return toggle;
}

function updateTranslationToggle(toggle: HTMLButtonElement, enabled: boolean): void {
  toggle.textContent = enabled ? "번역 표시 끄기" : "번역 표시 켜기";
  toggle.setAttribute("aria-pressed", String(enabled));
}

function createTranslationElement(doc: Document, source: SourceText): HTMLElement {
  const translation = doc.createElement(TRANSLATION_TAG);
  const isInline = !isBlock(source.anchor);

  translation.className = isInline ? INLINE_TRANSLATION_CLASS : BLOCK_TRANSLATION_CLASS;
  translation.setAttribute("aria-hidden", "true");
  // TODO: 번역 통신을 연결하면 source.text 대신 번역 결과를 표시한다.
  translation.textContent = source.text;
  return translation;
}

function updateVisibleAnchors(
  visibleAnchors: Set<Element>,
  entries: IntersectionObserverEntry[],
): void {
  for (const entry of entries) {
    if (entry.isIntersecting) visibleAnchors.add(entry.target);
    else visibleAnchors.delete(entry.target);
  }
}

/** 일반 글은 기준 요소의 형제로, 목록·표 같은 구조 요소의 글은 해당 요소 안에 표시한다. */
function insertTranslation(source: SourceText, translation: HTMLElement): boolean {
  if (!INNER_TRANSLATION_TAGS.has(source.anchor.tagName)) {
    source.anchor.after(translation);
    return translation.isConnected;
  }

  const lastSourceNode = source.sourceNodes.at(-1);
  if (!lastSourceNode) return false;

  let after: ChildNode = lastSourceNode;
  while (after.parentNode !== source.anchor) {
    const parent = after.parentNode;
    if (!(parent instanceof Element)) return false;
    after = parent;
  }

  after.after(translation);
  return true;
}
