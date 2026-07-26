import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/enter", async (route) => {
    const input = route.request().postDataJSON() as { username: string; avatar: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "accepted",
        data: {
          account: { username: input.username.trim(), avatar: input.avatar },
          connectionId: "test-connection"
        }
      })
    });
  });
});

test("enters without a password, localizes the modal, and operates chips without numeric betting", async ({
  page
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "家庭牌桌" })).toBeVisible();
  await page.getByLabel("输入用户名").fill("小明");
  await page.getByRole("button", { name: "进入大厅" }).click();
  await expect(page.getByRole("heading", { name: "聚会大厅" })).toBeVisible();
  await page.getByRole("button", { name: "全局设置" }).click();
  const settings = page.getByRole("dialog", { name: "全局设置" });
  await expect(settings.getByText("德州扑克")).toBeVisible();
  await settings.getByRole("button", { name: "关闭" }).click();
  await page.getByRole("button", { name: "加入牌局" }).click();
  await expect(page.getByText("轮到你行动")).toBeVisible();
  await expect(page.locator('input[type="number"]')).toHaveCount(0);
  await page.getByRole("button", { name: "100" }).click();
  await expect(page.getByRole("button", { name: "确认跟注" })).toBeEnabled();
  await page.getByRole("button", { name: "500" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "确认加注" })).toBeEnabled();
  await page.getByRole("button", { name: "撤销上一步" }).click();
  await expect(page.getByRole("status")).toContainText("下注缓存已清空");
});

test("switches to English and preserves the device preference", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("heading", { name: "Home Table" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Home Table" })).toBeVisible();
});

test("public display is read-only and mode-specific", async ({ page }) => {
  await page.goto("/?display=1&mode=chips-and-cards");
  await expect(page.getByText(/只读同步|Read-only sync/)).toBeVisible();
  await expect(page.getByTestId("community-cards").locator("span")).toHaveCount(5);
  await expect(page.getByRole("button", { name: /确认下注|Confirm bet/ })).toHaveCount(0);

  await page.goto("/?display=1&mode=chips-only");
  await expect(page.getByTestId("community-cards")).toHaveCount(0);
});
