import { expect, test } from "../fixtures";

test("화면에 들어온 글에 번역 영역을 표시하고 ON/OFF로 정리한다", async ({ page }) => {
  const response = await page.goto("/injection/basic.html");

  expect(response?.ok()).toBe(true);
  await expect(page.locator("#first + opener-translation")).toContainText(
    "The first paragraph is visible.",
  );
  const hasHorizontalOverflow = await page
    .locator("#narrow")
    .evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
  await expect(page.locator("#second + opener-translation")).toHaveCount(0);

  await page.locator("#scroller").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(page.locator("#second + opener-translation")).toHaveText(
    "The second paragraph appears after scrolling.",
  );
  await expect(page.locator("opener-translation")).toHaveCount(3);

  await page.getByRole("button", { name: "번역 표시 끄기" }).click();
  await expect(page.locator("opener-translation")).toHaveCount(0);

  await page.getByRole("button", { name: "번역 표시 켜기" }).click();
  await expect(page.locator("#second + opener-translation")).toHaveCount(1);
  await expect(page.locator("opener-translation")).toHaveCount(1);
});
