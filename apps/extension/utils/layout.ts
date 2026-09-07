const INLINE_LEVEL = new Set([
  "inline",
  "inline-block",
  "inline-flex",
  "inline-grid",
  "inline-table",
  "contents",
  "ruby",
  "ruby-base",
  "ruby-text",
]);

export function isBlock(el: Element): boolean {
  const display = getComputedStyle(el).display;
  if (display === "") return false;
  return !INLINE_LEVEL.has(display);
}
