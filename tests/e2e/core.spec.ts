import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("uses real account, settings, profile, season, and language persistence flows", async ({
  page
}, testInfo) => {
  test.setTimeout(60_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  const username = `资料甲-${suffix}`;
  const updatedUsername = `资料乙-${suffix}`;
  const seasonName = `验收赛季-${suffix}`;

  await emulateLanHttp(page);
  await enter(page, username);
  await expect(page.getByRole("heading", { name: "聚会大厅" })).toBeVisible();

  await page.getByRole("button", { name: new RegExp(username) }).click();
  const profile = page.getByRole("dialog", { name: "账户资料" });
  await profile.getByLabel("用户名").fill(updatedUsername);
  await profile.getByRole("button", { name: "保存资料" }).click();
  await expect(page.getByRole("button", { name: new RegExp(updatedUsername) })).toBeVisible();

  await page.getByRole("button", { name: "全局设置" }).click();
  let settings = page.getByRole("dialog", { name: "全局设置" });
  await settings.getByLabel("房主转让时限").selectOption("120");
  await settings.getByRole("button", { name: "保存" }).click();
  await page.getByRole("button", { name: "全局设置" }).click();
  settings = page.getByRole("dialog", { name: "全局设置" });
  await expect(settings.getByLabel("房主转让时限")).toHaveValue("120");
  await settings.getByRole("button", { name: "开始新赛季" }).click();

  const season = page.getByRole("dialog", { name: "开始新赛季" });
  await season.getByLabel("新赛季名称").fill(seasonName);
  await season.getByLabel("基础分").fill("12000");
  await season.getByLabel("最终确认").check();
  await season.getByRole("button", { name: "最终确认" }).click();
  await expect(page.getByRole("button", { name: seasonName })).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: updatedUsername }).getByText("12,000")
  ).toBeVisible();

  await page.getByRole("button", { name: "全局设置" }).click();
  const languageSettings = page.getByRole("dialog", { name: "全局设置" });
  await languageSettings.getByRole("button", { name: "EN" }).click();
  await page
    .getByRole("dialog", { name: "Global settings" })
    .getByRole("button", { name: "Close" })
    .click();
  await expect(page.getByRole("heading", { name: "Party lobby" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Party lobby" })).toBeVisible();
});

test("runs a real two-player hand, isolates private cards, synchronizes display, and transfers control", async ({
  browser,
  page: hostPage
}, testInfo) => {
  test.setTimeout(60_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  const hostName = `房主-${suffix}`;
  const guestName = `玩家-${suffix}`;
  const roomName = `真实牌局-${suffix}`;
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  const displayContext = await browser.newContext();
  const displayPage = await displayContext.newPage();
  const takeoverContext = await browser.newContext();
  const takeoverPage = await takeoverContext.newPage();

  try {
    await Promise.all([
      emulateLanHttp(hostPage),
      emulateLanHttp(guestPage),
      emulateLanHttp(displayPage),
      emulateLanHttp(takeoverPage)
    ]);
    await enter(hostPage, hostName);
    await enter(guestPage, guestName);

    await hostPage.getByRole("button", { name: /创建房间/ }).click();
    const create = hostPage.getByRole("dialog", { name: "创建德州扑克房间" });
    await create.getByLabel("房间名称").fill(roomName);
    await create.getByLabel("游戏模式").selectOption("chips-and-cards");
    await expect(create.getByLabel("房主转让时限")).toHaveValue("120");
    await create.getByLabel("房主转让时限").fill("45");
    await create.getByLabel("买入筹码").fill("2000");
    await create.getByRole("button", { name: "创建房间" }).click();
    await expect(hostPage.getByRole("heading", { name: roomName })).toBeVisible();
    const displayHref = await hostPage
      .getByRole("link", { name: "打开公共大屏" })
      .getAttribute("href");
    expect(displayHref).toBeTruthy();
    const roomId = new URL(displayHref!, "http://127.0.0.1:4173").searchParams.get(
      "roomId"
    );
    expect(roomId).toBeTruthy();
    const roomResponse = await hostPage.request.get(`/api/room/${roomId}?display=1`);
    expect((await roomResponse.json()).config.hostTransferTimeoutSeconds).toBe(45);

    await expect(guestPage.getByText(roomName)).toBeVisible();
    await guestPage.getByRole("button", { name: "加入牌局" }).click();
    const join = guestPage.getByRole("dialog", { name: "选择买入金额" });
    await join.getByLabel("买入筹码").fill("2000");
    await join.getByRole("button", { name: "加入牌局" }).click();

    await expect(hostPage.getByText(guestName)).toBeVisible();
    await guestPage.getByRole("button", { name: "离开房间" }).click();
    await expect(guestPage.getByRole("heading", { name: "聚会大厅" })).toBeVisible();
    await expect(hostPage.getByText(guestName)).toHaveCount(0);
    await guestPage
      .locator(".room-card")
      .filter({ hasText: roomName })
      .getByRole("button", { name: "加入牌局" })
      .click();
    const rejoin = guestPage.getByRole("dialog", { name: "选择买入金额" });
    await rejoin.getByLabel("买入筹码").fill("2000");
    await rejoin.getByRole("button", { name: "加入牌局" }).click();
    await expect(hostPage.getByText(guestName)).toBeVisible();
    await hostPage.getByRole("button", { name: "开始牌局" }).click();
    await expect(hostPage.getByLabel("德州扑克")).toBeVisible();
    await expect(guestPage.getByLabel("德州扑克")).toBeVisible();
    await expect(hostPage.getByLabel("庄家按钮")).toHaveCount(1);
    await expect(hostPage.getByLabel("我的手牌").locator("span")).toHaveCount(2);
    await expect(guestPage.getByLabel("我的手牌").locator("span")).toHaveCount(2);
    await hostPage.getByRole("button", { name: "静音" }).click();
    await expect(hostPage.getByRole("button", { name: "开启音效" })).toBeVisible();

    await displayPage.goto(displayHref!);
    await expect(displayPage.getByText("只读同步 · 不占玩家名额")).toBeVisible();
    await expect(displayPage.getByTestId("community-cards").locator("span")).toHaveCount(5);
    await expect(displayPage.getByLabel("庄家按钮")).toHaveCount(1);
    await expect(displayPage.getByText("我的手牌")).toHaveCount(0);
    await expect(displayPage.getByRole("button", { name: /确认|弃牌|全押/ })).toHaveCount(0);
    await displayPage.getByRole("button", { name: "EN" }).click();
    await expect(displayPage.getByText("Public display", { exact: true })).toBeVisible();
    await displayPage.reload();
    await expect(displayPage.getByText("Public display", { exact: true })).toBeVisible();
    await displayPage.getByRole("button", { name: "中" }).click();
    await expect(displayPage.getByText("公共大屏", { exact: true })).toBeVisible();

    const actorPage = await actingPage(hostPage, guestPage);
    const observerPage = actorPage === hostPage ? guestPage : hostPage;
    const chip25 = actorPage
      .locator(".chip-rack")
      .getByRole("button", { name: "25", exact: true });
    const betCache = actorPage.getByLabel("下注缓存");
    if (testInfo.project.name.startsWith("chromium")) {
      await chip25.focus();
      await chip25.press("Enter");
      await expect(betCache.getByRole("button", { name: "移除 25 筹码" })).toHaveCount(1);
      await betCache.getByRole("button", { name: "移除 25 筹码" }).press("Enter");
      await chip25.dragTo(betCache);
    } else {
      const chipBox = await chip25.boundingBox();
      const cacheBox = await betCache.boundingBox();
      expect(chipBox).toBeTruthy();
      expect(cacheBox).toBeTruthy();
      await chip25.dispatchEvent("pointerdown", {
        pointerType: "touch",
        clientX: chipBox!.x + chipBox!.width / 2,
        clientY: chipBox!.y + chipBox!.height / 2
      });
      await chip25.dispatchEvent("pointerup", {
        pointerType: "touch",
        clientX: cacheBox!.x + cacheBox!.width / 2,
        clientY: cacheBox!.y + cacheBox!.height / 2
      });
    }
    await expect(betCache.getByRole("button", { name: "移除 25 筹码" })).toHaveCount(1);
    await betCache.getByRole("button", { name: "移除 25 筹码" }).click();
    await expect(betCache.getByRole("button", { name: "移除 25 筹码" })).toHaveCount(0);
    await actorPage.getByRole("button", { name: "一键跟注" }).click();
    await expect(actorPage.getByRole("button", { name: "确认跟注" })).toBeEnabled();
    await actorPage.getByRole("button", { name: "确认跟注" }).click();
    await expect(observerPage.locator(".pot strong")).toHaveText("200");
    await expect(displayPage.locator(".pot strong")).toHaveText("200");
    await observerPage.getByRole("button", { name: "弃牌" }).click();
    await expect(hostPage.getByText("本手分配结果")).toBeVisible({ timeout: 7_000 });
    await expect(guestPage.getByText("本手分配结果")).toBeVisible();
    await expect(displayPage.getByText("本手分配结果")).toBeVisible();

    await hostPage.reload();
    await expect(hostPage.getByText(roomName)).toBeVisible();
    await expect(hostPage.getByRole("button", { name: "开启音效" })).toBeVisible();
    await expect(hostPage.getByLabel("我的手牌").locator("span")).toHaveCount(2);
    await expect(hostPage.getByText("本手分配结果")).toBeVisible();

    await enter(takeoverPage, hostName, false);
    await expect(takeoverPage.getByText(roomName)).toBeVisible();
    await expect(hostPage.getByRole("alert")).toContainText("新设备");

    await takeoverPage.getByRole("button", { name: "结束并兑换" }).click();
    await expect(takeoverPage.getByRole("heading", { name: "聚会大厅" })).toBeVisible();
    await expect(guestPage.getByRole("heading", { name: "聚会大厅" })).toBeVisible();
  } finally {
    await Promise.all([
      guestContext.close(),
      displayContext.close(),
      takeoverContext.close()
    ]);
  }
});

async function emulateLanHttp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: undefined
    });
  });
}

async function enter(page: Page, username: string, expectLobby = true): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "家庭牌桌" })).toBeVisible();
  await page.getByLabel("输入用户名").fill(username);
  await page.getByRole("button", { name: "进入大厅" }).click();
  if (expectLobby) {
    await expect(page.getByRole("heading", { name: "聚会大厅" })).toBeVisible();
  }
}

async function actingPage(first: Page, second: Page): Promise<Page> {
  if (await first.getByText("轮到你行动").isVisible()) return first;
  await expect(second.getByText("轮到你行动")).toBeVisible();
  return second;
}

function uniqueSuffix(projectName: string): string {
  const project = projectName.startsWith("chromium") ? "ch" : "wk";
  return `${project}-${Date.now().toString(36).slice(-6)}`;
}
