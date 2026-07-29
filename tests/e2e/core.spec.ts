import { expect, test, type Locator, type Page } from "@playwright/test";
import { productConfig } from "@party/contracts";

test.describe.configure({ mode: "serial" });

test("uses anonymous admin routes, two-step registration, and account preference persistence", async ({
  page
}, testInfo) => {
  test.setTimeout(60_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  const username = `资料甲-${suffix}`;
  const updatedUsername = `资料乙-${suffix}`;
  const seasonName = `验收赛季-${suffix}`;

  await emulateLanHttp(page);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "管理员设置" })
  ).toBeVisible();
  await expect(page.getByText(username)).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin$/);

  await page
    .getByLabel("管理员本地主题")
    .getByRole("button", { name: "切换到亮色主题" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByLabel("默认房主转让秒数").fill("120");
  const general = page.getByRole("region", { name: "通用设置" });
  await general
    .getByLabel("主题选择")
    .getByRole("button", { name: "切换到暗色主题" })
    .click();
  await page.getByRole("button", { name: /德州扑克/ }).click();
  await selectStyledOption(page, "花色配色", "高对比度");
  await page.getByLabel("筹码面值 6").fill("1000");
  await page.getByRole("button", { name: "保存", exact: true }).click();

  await page.getByRole("button", { name: /账户管理/ }).click();
  await expect(page).toHaveURL(/\/admin\/accounts$/);
  await expect(
    page.getByRole("heading", { name: "账户管理" })
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/admin\/accounts$/);
  await page.getByRole("button", { name: "返回管理员设置" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const adminViewport = page.viewportSize()!;
  await page.setViewportSize({ width: 300, height: 760 });
  expect(
    await page.evaluate(() => ({
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth
    }))
  ).toEqual({ viewport: 300, documentWidth: 300 });
  await expect(page.getByRole("button", { name: "保存", exact: true })).toBeVisible();
  await page.setViewportSize(adminViewport);

  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("输入用户名").fill(username);
  await page.getByRole("button", { name: "继续" }).click();
  await expect(
    page.getByRole("heading", { name: "注册账户" })
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "用户名" })).toHaveValue(username);
  await expect(page.getByRole("option")).toHaveCount(0);
  await page.locator(".avatar-current").click();
  await expect(page.getByRole("option")).toHaveCount(32);
  await page.getByRole("option", { name: "avatar-🦊" }).click();
  await page.getByRole("button", { name: "注册并进入" }).click();
  await expect(page.getByRole("heading", { name: "聚会大厅" })).toBeVisible();
  await expect(page.getByRole("button", { name: "全局设置" })).toHaveCount(0);
  await expect(page.getByLabel("语言选择")).toHaveCount(0);
  await expect(page.getByRole("button", { name: new RegExp(username) })).toHaveCount(1);

  await page.getByRole("button", { name: new RegExp(username) }).click();
  const profile = page.getByRole("dialog", { name: "账户资料" });
  await expect(profile.getByRole("option")).toHaveCount(0);
  await profile.getByLabel("用户名").fill(updatedUsername);
  await profile.locator(".avatar-current").click();
  await profile.getByRole("option", { name: "avatar-🐼" }).click();
  await profile.getByRole("button", { name: "EN" }).click();
  await profile.getByRole("button", { name: "切换到亮色主题" }).click();
  await profile.getByRole("slider", { name: /音量/ }).fill("0");
  await profile.getByRole("button", { name: "保存资料" }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(updatedUsername) })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Party lobby" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Party lobby" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: new RegExp(updatedUsername) }).click();
  await expect(
    page.getByRole("dialog", { name: "Account profile" })
      .getByRole("slider", { name: /Volume/ })
  ).toHaveValue("0");
  await page.getByRole("dialog", { name: "Account profile" })
    .getByLabel("Close")
    .click();

  await page.goto("/admin/seasons");
  await expect(
    page.getByRole("heading", { name: "赛季管理" })
  ).toBeVisible();
  await page.getByLabel("新赛季名称").fill(seasonName);
  await page.getByLabel("基础分").fill("12000");
  await page.getByRole("button", { name: "开始新赛季", exact: true }).click();
  await page
    .getByRole("alertdialog", { name: "开始新赛季" })
    .getByRole("button", { name: "最终确认" })
    .click();
  await expect(page.locator(".admin-selection-row").first()).toContainText(
    seasonName
  );
});

test("runs a real two-player hand, isolates private cards, synchronizes display, and transfers control", async ({
  browser,
  page: hostPage
}, testInfo) => {
  test.setTimeout(90_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  const hostName = `房主-${suffix}`;
  const guestName = `玩家-${suffix}`;
  const unreadyName = `未准备-${suffix}`;
  const lateName = `中途加入-${suffix}`;
  const roomName = `真实牌局-${suffix}`;
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  const unreadyContext = await browser.newContext();
  const unreadyPage = await unreadyContext.newPage();
  const lateContext = await browser.newContext();
  const latePage = await lateContext.newPage();
  const displayContext = await browser.newContext();
  const displayPage = await displayContext.newPage();
  const takeoverContext = await browser.newContext();
  const takeoverPage = await takeoverContext.newPage();

  try {
    await Promise.all([
      emulateLanHttp(hostPage),
      emulateLanHttp(guestPage),
      emulateLanHttp(unreadyPage),
      emulateLanHttp(latePage),
      emulateLanHttp(displayPage),
      emulateLanHttp(takeoverPage)
    ]);
    await enter(hostPage, hostName);
    await enter(guestPage, guestName);
    await enter(unreadyPage, unreadyName);
    await expect(hostPage.locator("html")).toHaveAttribute("data-theme", "dark");

    await hostPage.getByRole("button", { name: /创建房间/ }).click();
    const create = hostPage.getByRole("dialog", { name: "创建德州扑克房间" });
    await create.getByLabel("房间名称").fill(roomName);
    await selectStyledOption(create, "游戏模式", "筹码＋牌");
    await expect(create.getByLabel("房主转让时限")).toHaveValue("120");
    await create.getByLabel("房主转让时限").fill("45");
    await create.getByLabel("买入筹码").fill("2000");
    await create.getByRole("button", { name: "创建房间" }).click();
    await expect(hostPage.getByRole("heading", { name: roomName })).toBeVisible();
    const waitingViewport = hostPage.viewportSize()!;
    await hostPage.setViewportSize({ width: 300, height: 760 });
    const waitingHeader = await hostPage.locator(".room-topbar").evaluate((header) => {
      const buttons = Array.from(
        header.querySelectorAll<HTMLButtonElement>(".room-top-actions button")
      ).map((button) => {
        const rect = button.getBoundingClientRect();
        return { x: Math.round(rect.x), y: Math.round(rect.y) };
      });
      return {
        buttons,
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth
      };
    });
    expect(waitingHeader.buttons).toHaveLength(3);
    expect(new Set(waitingHeader.buttons.map((button) => button.y)).size).toBe(1);
    expect(waitingHeader.documentWidth).toBe(waitingHeader.viewport);
    await hostPage.setViewportSize(waitingViewport);
    const displayHref = await hostPage
      .getByRole("link", { name: "打开公共大屏" })
      .getAttribute("href");
    expect(displayHref).toBeTruthy();
    const roomId = new URL(displayHref!, "http://127.0.0.1:4173").searchParams.get(
      "roomId"
    );
    expect(roomId).toBeTruthy();
    const roomResponse = await hostPage.request.get(`/api/room/${roomId}?display=1`);
    const roomState = await roomResponse.json();
    expect(roomState.config.hostTransferTimeoutSeconds).toBe(45);
    expect(roomState.suitColorPreset).toBe("high-contrast");

    await expect(guestPage.getByText(roomName)).toBeVisible();
    await guestPage.getByRole("button", { name: "加入牌局" }).click();
    const join = guestPage.getByRole("dialog", { name: "选择买入金额" });
    await join.getByLabel("买入筹码").fill("2000");
    await join.getByRole("button", { name: "加入牌局" }).click();

    await expect(hostPage.getByText(guestName)).toBeVisible();
    await guestPage.getByRole("button", { name: "离开房间" }).click();
    await guestPage
      .getByRole("alertdialog", { name: "确认退出房间" })
      .getByRole("button", { name: "离开房间" })
      .click();
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
    await unreadyPage
      .locator(".room-card")
      .filter({ hasText: roomName })
      .getByRole("button", { name: "加入牌局" })
      .click();
    const unreadyJoin = unreadyPage.getByRole("dialog", {
      name: "选择买入金额"
    });
    await unreadyJoin.getByLabel("买入筹码").fill("2000");
    await unreadyJoin.getByRole("button", { name: "加入牌局" }).click();
    await guestPage.getByRole("button", { name: "准备", exact: true }).click();
    await hostPage.getByRole("button", { name: "开始牌局" }).click();
    const startConfirmation = hostPage.getByRole("alertdialog", {
      name: "让未准备玩家进入观众席？"
    });
    await expect(startConfirmation).toBeVisible();
    await startConfirmation
      .getByRole("button", { name: "开始牌局" })
      .click();
    await expect(hostPage.getByLabel("德州扑克")).toBeVisible();
    await expect(guestPage.getByLabel("德州扑克")).toBeVisible();
    await expect(unreadyPage.getByText("正在观战")).toBeVisible();
    await expect(unreadyPage.getByLabel("我的手牌")).toHaveCount(0);
    await expect(hostPage.getByLabel("庄家按钮")).toHaveCount(1);
    await expect(hostPage.getByLabel("我的手牌").locator("span")).toHaveCount(2);
    await expect(guestPage.getByLabel("我的手牌").locator("span")).toHaveCount(2);
    const memberTrigger = hostPage.getByRole("button", {
      name: `${unreadyName} 成员操作`
    });
    await memberTrigger.click();
    const memberMenu = hostPage.getByRole("menu", { name: "成员操作" });
    await expect(memberMenu).toBeVisible();
    expect(
      await memberMenu.evaluate((menu) => {
        const rect = menu.getBoundingClientRect();
        return (
          rect.left >= 0 &&
          rect.top >= 0 &&
          rect.right <= innerWidth &&
          rect.bottom <= innerHeight
        );
      })
    ).toBe(true);
    await hostPage.keyboard.press("Escape");
    await expect(memberMenu).toHaveCount(0);
    await expect(memberTrigger).toBeFocused();
    await memberTrigger.click();
    await hostPage.getByRole("menuitem", { name: "移除玩家" }).click();
    const kickConfirmation = hostPage.getByRole("alertdialog", {
      name: "确认踢出玩家"
    });
    await expect(kickConfirmation).toContainText(unreadyName);
    await kickConfirmation
      .getByRole("button", { name: "移除玩家" })
      .click();
    await expect(
      unreadyPage.getByRole("heading", { name: "聚会大厅" })
    ).toBeVisible();

    await enter(latePage, lateName);
    await latePage
      .locator(".room-card")
      .filter({ hasText: roomName })
      .getByRole("button", { name: "加入牌局" })
      .click();
    const lateJoin = latePage.getByRole("dialog", {
      name: "选择买入金额"
    });
    await lateJoin.getByLabel("买入筹码").fill("2000");
    await lateJoin.getByRole("button", { name: "加入牌局" }).click();
    await expect(latePage.getByText("正在观战")).toBeVisible();
    await expect(latePage.getByLabel("我的手牌")).toHaveCount(0);
    await expect(latePage.getByRole("button", { name: /确认|弃牌|全押/ })).toHaveCount(0);
    await expect(hostPage.locator(".table-title strong")).toHaveText(roomName);
    await expect(hostPage.locator(".table-title")).toContainText(`当前玩家 · ${hostName}`);
    await expect(hostPage.getByLabel("语言选择")).toHaveCount(0);
    await expect(hostPage.getByRole("button", { name: "静音" })).toHaveCount(0);
    await hostPage.setViewportSize({ width: 300, height: 760 });
    expect(await hostPage.evaluate(() => ({
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth
    }))).toEqual({ viewport: 300, documentWidth: 300 });
    await expect(hostPage.locator(".player-seat .seat-values").first()).toContainText(
      "剩余筹码"
    );
    await expect(hostPage.locator(".player-seat .seat-values").first()).toContainText(
      "本轮下注"
    );
    const ownCard = hostPage.getByLabel("我的手牌").locator("[data-suit]").first();
    const suit = await ownCard.getAttribute("data-suit");
    const cardColor = await ownCard.evaluate((element) => getComputedStyle(element).color);
    expect(cardColor).toBe(highContrastSuitColor(suit));

    await displayPage.goto(displayHref!);
    await expect(displayPage.locator("main")).toHaveClass(/suit-theme-high-contrast/);
    await expect(displayPage.getByText("只读同步 · 不占玩家名额")).toBeVisible();
    await expect(displayPage.getByTestId("community-cards").locator("span")).toHaveCount(5);
    await expect(displayPage.getByLabel("庄家按钮")).toHaveCount(1);
    await expect(displayPage.getByText("我的手牌")).toHaveCount(0);
    await expect(displayPage.getByRole("button", { name: /确认|弃牌|全押/ })).toHaveCount(0);
    await expect(displayPage.getByLabel("语言选择")).toHaveCount(0);
    await expect(displayPage.getByLabel("主题选择")).toHaveCount(0);
    await expect(displayPage.locator(".display-seats .seat-values").first()).toContainText(
      "本轮下注"
    );

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
    const timerFill = hostPage.locator(".timer-fill");
    await expect(timerFill).toBeVisible();
    await expect(timerFill).toHaveCSS("animation-name", "timer-drain");
    const firstTransform = await timerFill.evaluate((element) => getComputedStyle(element).transform);
    await hostPage.waitForTimeout(200);
    const secondTransform = await timerFill.evaluate((element) => getComputedStyle(element).transform);
    expect(secondTransform).not.toBe(firstTransform);
    const hostSettlement = hostPage.getByRole("dialog", { name: "本手结算" });
    await expect(hostSettlement).toBeVisible({
      timeout: 8_000
    });
    await hostPage.reload();
    await expect(hostSettlement).toBeVisible({ timeout: 8_000 });
    await expect(hostPage.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(hostPage.locator("html")).toHaveAttribute(
      "data-theme-scope",
      "poker"
    );
    const settlementTheme = await hostSettlement.evaluate((panel) => {
      const rootStyle = getComputedStyle(document.documentElement);
      const panelStyle = getComputedStyle(panel);
      return {
        variables: [
          "--color-canvas",
          "--color-surface",
          "--color-text",
          "--color-text-muted",
          "--color-border",
          "--color-accent"
        ].map((name) => rootStyle.getPropertyValue(name).trim()),
        color: panelStyle.color,
        backgroundColor: panelStyle.backgroundColor
      };
    });
    expect(settlementTheme.variables.every(Boolean)).toBe(true);
    expect(settlementTheme.color).not.toBe(settlementTheme.backgroundColor);
    await expect(hostPage.getByLabel("主题选择")).toHaveCount(0);
    await expect(guestPage.getByRole("dialog", { name: "本手结算" })).toBeVisible();
    await expect(displayPage.getByText("本手结算", { exact: true })).toBeVisible();
    await expect(hostPage.locator(".settlement-player-list article")).toHaveCount(3);
    await expect(hostSettlement.getByText(/总筹码/)).toHaveCount(2);
    await expect(displayPage.locator(".settlement-player-list article")).toHaveCount(3);
    await expect(displayPage.getByText(/总筹码/)).toHaveCount(2);

    const hostResultRow = hostSettlement
      .locator(".settlement-player-list article")
      .filter({ hasText: hostName });
    const totalBeforeText = await hostResultRow.getByText(/总筹码/).textContent();
    const totalBefore = Number(totalBeforeText?.replace(/[^\d]/g, ""));
    expect(totalBefore).toBeGreaterThan(0);
    await hostSettlement.getByRole("button", { name: "补充筹码" }).click();
    const topUpDialog = hostPage.getByRole("dialog", { name: "补充筹码" });
    await expect(topUpDialog).toBeVisible();
    await topUpDialog.getByRole("spinbutton").fill("100");
    await topUpDialog.getByRole("button", { name: "最终确认" }).click();
    await expect(topUpDialog).toHaveCount(0);
    await expect(
      hostResultRow.getByText(`总筹码 ${(totalBefore + 100).toLocaleString()}`)
    ).toBeVisible();

    await hostPage.waitForTimeout(600);
    await expect(hostSettlement).toBeVisible();

    await expect(hostPage.getByText("房主自动参赛")).toBeVisible();
    await expect(hostPage.getByRole("button", { name: "准备", exact: true })).toHaveCount(0);
    await expect(guestPage.getByRole("dialog", { name: "本手结算" })).toBeVisible();
    await guestPage.getByRole("button", { name: "离开房间" }).click();
    await guestPage
      .getByRole("alertdialog", { name: "确认退出房间" })
      .getByRole("button", { name: "离开房间" })
      .click();
    await expect(guestPage.getByRole("heading", { name: "聚会大厅" })).toBeVisible();
    await expect(
      hostSettlement.locator(".settlement-player-list article").filter({
        hasText: guestName
      })
    ).toHaveCount(0);
    await expect(
      displayPage.locator(".settlement-player-list article").filter({
        hasText: guestName
      })
    ).toHaveCount(0);
    await guestPage
      .locator(".room-card")
      .filter({ hasText: roomName })
      .getByRole("button", { name: "加入牌局" })
      .click();
    const settlementRejoin = guestPage.getByRole("dialog", {
      name: "选择买入金额"
    });
    await settlementRejoin.getByLabel("买入筹码").fill("2000");
    await settlementRejoin.getByRole("button", { name: "加入牌局" }).click();
    await expect(guestPage.getByRole("dialog", { name: "本手结算" })).toBeVisible();
    await latePage.getByRole("button", { name: "准备", exact: true }).click();
    await hostPage.getByRole("button", { name: "开始下一手" }).click();
    const nextHandConfirmation = hostPage.getByRole("alertdialog", {
      name: "让未准备玩家进入观众席？"
    });
    await expect(nextHandConfirmation).toBeVisible();
    await nextHandConfirmation
      .getByRole("button", { name: "开始下一手" })
      .click();
    await expect(hostPage.getByRole("dialog", { name: "本手结算" })).toHaveCount(0);
    await expect(latePage.getByText("第 2 手")).toBeVisible();
    await expect(latePage.getByLabel("我的手牌").locator("span")).toHaveCount(2);
    await expect(guestPage.getByText("正在观战")).toBeVisible();
    await expect(guestPage.getByLabel("我的手牌")).toHaveCount(0);
    await expect(displayPage.getByText("本手结算", { exact: true })).toHaveCount(0);

    await hostPage.reload();
    await expect(hostPage.getByText(roomName)).toBeVisible();
    await expect(hostPage.getByRole("button", { name: /静音|开启音效/ })).toHaveCount(0);
    await expect(hostPage.getByLabel("我的手牌").locator("span")).toHaveCount(2);
    await expect(hostPage.getByText("第 2 手")).toBeVisible();

    await enter(takeoverPage, hostName, false, false);
    await expect(takeoverPage.getByText(roomName)).toBeVisible();
    await expect(hostPage.getByRole("alert")).toContainText("新设备");

    await takeoverPage.getByRole("button", { name: "离开房间" }).click();
    const leaveConfirmation = takeoverPage.getByRole("alertdialog", {
      name: "确认退出房间"
    });
    await expect(leaveConfirmation).toContainText("房主将随机转让");
    await leaveConfirmation
      .getByRole("button", { name: "离开房间" })
      .click();
    await expect(takeoverPage.getByRole("heading", { name: "聚会大厅" })).toBeVisible();
    const successorPage =
      (await guestPage.getByRole("button", { name: "结束并兑换" }).count()) > 0
        ? guestPage
        : latePage;
    await expect(
      successorPage.getByRole("button", { name: "结束并兑换" })
    ).toBeVisible();
    await successorPage.getByRole("button", { name: "结束并兑换" }).click();
    const closeConfirmation = successorPage.getByRole("alertdialog", {
      name: "确认关闭房间"
    });
    await closeConfirmation
      .getByRole("button", { name: "结束并兑换" })
      .click();
    await expect(guestPage.getByRole("heading", { name: "聚会大厅" })).toBeVisible();
    await expect(latePage.getByRole("heading", { name: "聚会大厅" })).toBeVisible();
  } finally {
    await Promise.all([
      guestContext.close(),
      unreadyContext.close(),
      lateContext.close(),
      displayContext.close(),
      takeoverContext.close()
    ]);
  }
});

test("batch-manages accounts and historical seasons from direct admin routes", async ({
  browser,
  page
}, testInfo) => {
  test.setTimeout(60_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  const managerName = `管理者-${suffix}`;
  const targetName = `待删除-${suffix}`;
  const targetContext = await browser.newContext();
  const targetPage = await targetContext.newPage();
  try {
    await Promise.all([emulateLanHttp(page), emulateLanHttp(targetPage)]);
    await enter(page, managerName);
    await enter(targetPage, targetName);

    await page.goto("/admin/accounts");
    await expect(page).toHaveURL(/\/admin\/accounts$/);
    const targetRow = page.locator(".admin-selection-row").filter({
      hasText: targetName
    });
    await expect(targetRow).toBeVisible();
    await targetRow.getByRole("checkbox").check();
    const selectAll = page.getByLabel("全选");
    expect(
      await selectAll.evaluate(
        (checkbox: HTMLInputElement) => checkbox.indeterminate
      )
    ).toBe(true);
    await selectAll.check();
    expect(
      await page
        .locator(".admin-selection-row input[type=checkbox]:not(:disabled)")
        .evaluateAll((checkboxes: HTMLInputElement[]) =>
          checkboxes.every((checkbox) => checkbox.checked)
        )
    ).toBe(true);
    await page.getByLabel("取消全选").uncheck();
    await targetRow.getByRole("checkbox").check();
    await expect(page.getByText("已选择 1 项")).toBeVisible();
    await page.getByRole("button", { name: "删除选中的用户" }).click();
    const accountConfirmation = page.getByRole("alertdialog", {
      name: "永久删除所选账户？"
    });
    await expect(accountConfirmation).toContainText("开放房间");
    await accountConfirmation
      .getByRole("button", { name: "永久删除" })
      .click();
    await expect(targetRow).toHaveCount(0);
    await expect(targetPage.getByRole("heading", { name: "家庭牌桌" })).toBeVisible();

    await page.goto("/admin/seasons");
    await page.reload();
    const protectedRow = page.locator(".admin-selection-row").first();
    await expect(protectedRow).toContainText("当前赛季");
    await expect(protectedRow.getByRole("checkbox")).toBeDisabled();
    const historicalRows = page.locator(".admin-selection-row").filter({
      hasText: "历史赛季"
    });
    if ((await historicalRows.count()) > 0) {
      await page.getByLabel("全选").check();
      await expect(page.getByText(/已选择 [1-9]\d* 项/)).toBeVisible();
      await page.getByRole("button", { name: "删除选中的赛季" }).click();
      const seasonConfirmation = page.getByRole("alertdialog", {
        name: "永久删除所选历史赛季？"
      });
      await seasonConfirmation
        .getByRole("button", { name: "永久删除" })
        .click();
      await expect(historicalRows).toHaveCount(0);
    }
  } finally {
    await targetContext.close();
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

async function enter(
  page: Page,
  username: string,
  expectLobby = true,
  create = true
): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "家庭牌桌" })).toBeVisible();
  await page.getByLabel("输入用户名").fill(username);
  await page.getByRole("button", { name: "继续" }).click();
  if (create) {
    await expect(
      page.getByRole("heading", { name: "注册账户" })
    ).toBeVisible();
    await page.getByRole("button", { name: "注册并进入" }).click();
  }
  if (expectLobby) {
    await expect(page.getByRole("heading", { name: "聚会大厅" })).toBeVisible();
  }
}

async function selectStyledOption(
  scope: Page | Locator,
  label: string,
  option: string
): Promise<void> {
  await scope.getByLabel(label).click();
  await scope.getByRole("option", { name: option, exact: true }).click();
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

function highContrastSuitColor(suit: string | null): string {
  const configured = (
    productConfig.suits["high-contrast"] as Record<string, string>
  )[suit ?? ""];
  if (!configured) return "";
  const channels = configured
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16));
  return channels ? `rgb(${channels.join(", ")})` : "";
}
