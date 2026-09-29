import { expect, test } from "../fixtures";

test("SPA 이동·뒤로 가기·동적 로딩 후에도 번역 표시와 OFF 상태를 유지한다", async ({ page }) => {
  await page.goto("/injection/spa.html");
  const translations = page.locator("opener-translation");
  await expect(translations).toHaveText(["First page content"]);

  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/\?page=second$/u);
  await expect(translations).toHaveText(["Second page content"]);

  await page.getByRole("button", { name: "Load content" }).click();
  await expect(translations).toHaveText(["Second page content", "Loaded later"]);
  await page.getByRole("button", { name: "Update content" }).click();
  await expect(translations).toHaveText(["Updated page content", "Loaded later"]);

  await page.goBack();
  await expect(translations).toHaveText(["First page content"]);

  await page.getByRole("button", { name: "번역 표시 끄기" }).click();
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page.locator("main")).toHaveText("Second page content");
  await expect(translations).toHaveCount(0);
  await expect(page.getByRole("button", { name: "번역 표시 켜기" })).toHaveCount(1);
  await page.getByRole("button", { name: "번역 표시 켜기" }).click();
  await expect(translations).toHaveText(["Second page content"]);
});
