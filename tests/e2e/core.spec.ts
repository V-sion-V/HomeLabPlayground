import { expect, test, type Locator, type Page } from "@playwright/test";
import { productConfig } from "@party/contracts";

test.describe.configure({ mode: "serial" });

test("uses anonymous admin routes, two-step registration, and account preference persistence", async ({
  page
}, testInfo) => {
  test.setTimeout(90_000);
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
  const adminSave = page.getByRole("button", { name: "保存", exact: true });
  const contentTopBeforeToast = await page
    .locator(".fixed-panel-scroll")
    .evaluate((content) => content.getBoundingClientRect().top);
  await adminSave.click();
  const toasts = page.locator(".toast");
  await expect(toasts).toHaveCount(1);
  await expect(toasts.first()).toContainText("设置已保存");
  await expect(adminSave).toBeEnabled();
  expect(
    await page
      .locator(".fixed-panel-scroll")
      .evaluate((content) => content.getBoundingClientRect().top)
  ).toBe(contentTopBeforeToast);
  await adminSave.click();
  await expect(toasts).toHaveCount(2);
  const toastOrder = await toasts.evaluateAll((items) =>
    items.map((item) => ({
      id: Number(item.getAttribute("data-toast-id")),
      top: item.getBoundingClientRect().top,
      position: getComputedStyle(item.parentElement!).position
    }))
  );
  expect(toastOrder[0]!.id).toBeGreaterThan(toastOrder[1]!.id);
  expect(toastOrder[0]!.top).toBeLessThan(toastOrder[1]!.top);
  expect(toastOrder.every((toast) => toast.position === "fixed")).toBe(true);
  await toasts.first().getByRole("button", { name: "关闭提示" }).click();
  await expect(toasts).toHaveCount(1);
  await expect(toasts).toHaveCount(0, { timeout: 6_000 });

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
  const adminNarrow = await page.evaluate(() => {
    window.scrollTo(0, 100);
    const content = document.querySelector<HTMLElement>(".fixed-panel-scroll");
    return {
      viewport: innerWidth,
      viewportHeight: innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      outerScrollY: scrollY,
      contentOverflowY: content ? getComputedStyle(content).overflowY : ""
    };
  });
  expect(adminNarrow.viewport).toBe(300);
  expect(adminNarrow.documentWidth).toBe(300);
  expect(adminNarrow.documentHeight).toBeLessThanOrEqual(
    adminNarrow.viewportHeight + 1
  );
  expect(adminNarrow.outerScrollY).toBe(0);
  expect(adminNarrow.contentOverflowY).toBe("auto");
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
  const startSeasonDialog = page.getByRole("alertdialog", {
    name: "开始新赛季"
  });
  await startSeasonDialog.getByRole("button", { name: "最终确认" }).click();
  await expect(startSeasonDialog).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator(".toast")).toContainText("新赛季已开始");
  await expect(
    page.locator(".admin-selection-row", { hasText: seasonName })
  ).toContainText("当前赛季");
});

test("runs a real two-player hand, isolates private cards, synchronizes display, and transfers control", async ({
  browser,
  page: hostPage
}, testInfo) => {
  test.setTimeout(240_000);
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
  for (const pokerPage of [
    hostPage,
    guestPage,
    unreadyPage,
    latePage,
    displayPage,
    takeoverPage
  ]) {
    pokerPage.setDefaultTimeout(10_000);
  }

  try {
    await Promise.all([
      emulateLanHttp(hostPage),
      emulateLanHttp(guestPage),
      emulateLanHttp(unreadyPage),
      emulateLanHttp(latePage),
      emulateLanHttp(displayPage),
      emulateLanHttp(takeoverPage)
    ]);
    await hostPage.goto("/admin");
    await hostPage.getByRole("button", { name: /德州扑克/ }).click();
    await selectStyledOption(hostPage, "花色配色", "高对比度");
    const denominationInputs = hostPage.getByLabel(/^筹码面值 \d+$/);
    const addDenomination = hostPage.getByRole("button", { name: /添加面值/ });
    for (let count = await denominationInputs.count(); count < 16; count += 1) {
      await addDenomination.click();
    }
    for (let index = 0; index < 16; index += 1) {
      await denominationInputs.nth(index).fill(String(index + 1));
    }
    await hostPage.getByRole("button", { name: "保存", exact: true }).click();
    await expect(hostPage.locator(".toast")).toContainText("设置已保存");
    await enter(hostPage, hostName);
    await enter(guestPage, guestName);
    await enter(unreadyPage, unreadyName);
    await expect(hostPage.locator("html")).toHaveAttribute("data-theme", "dark");

    await hostPage.getByRole("button", { name: /创建房间/ }).click();
    await hostPage
      .getByRole("dialog", { name: "创建房间" })
      .getByRole("button", { name: /德州扑克/ })
      .click();
    const create = hostPage.getByRole("dialog", { name: "创建房间 · 德州扑克" });
    await create.getByLabel("房间名称").fill(roomName);
    await selectStyledOption(create, "游戏模式", "筹码＋牌");
    await expect(create.getByLabel("房主转让时限")).toHaveValue(/^\d+$/);
    await create.getByLabel("房主转让时限").fill("45");
    await create.getByLabel("买入筹码").fill("2000");
    await create.getByRole("button", { name: "创建房间" }).click();
    await expect(hostPage.getByRole("heading", { name: roomName })).toBeVisible();
    const waitingPanelBorder = await hostPage
      .locator(".waiting-panel")
      .evaluate((panel) => {
        const style = getComputedStyle(panel);
        return [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth
        ];
      });
    expect(waitingPanelBorder).toEqual(["0px", "0px", "0px", "0px"]);
    const waitingViewport = hostPage.viewportSize()!;
    await hostPage.setViewportSize({ width: 300, height: 760 });
    const waitingHeader = await hostPage.locator(".shared-room-header").evaluate((header) => {
      const buttons = Array.from(
        header.querySelectorAll<HTMLButtonElement>(
          ".shared-room-header-actions button, .shared-room-header-danger button"
        )
      ).map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          borderRadius: getComputedStyle(button).borderRadius
        };
      });
      return {
        buttons,
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth
      };
    });
    expect(waitingHeader.buttons).toHaveLength(3);
    expect(new Set(waitingHeader.buttons.map((button) => button.y)).size).toBe(1);
    expect(waitingHeader.buttons.every((button) => button.width <= 46)).toBe(true);
    expect(
      waitingHeader.buttons.every(
        (button) =>
          button.borderRadius === "50%" || button.borderRadius === "999px"
      )
    )
      .toBe(true);
    expect(waitingHeader.documentWidth).toBe(waitingHeader.viewport);
    await hostPage.setViewportSize(waitingViewport);
    await expect(
      hostPage.getByRole("link", { name: "打开公共大屏" })
    ).toHaveCount(0);
    await hostPage.getByRole("button", { name: "返回大厅" }).click();
    await expect(hostPage.getByRole("heading", { name: "聚会大厅" })).toBeVisible();
    const ownRoomCard = hostPage.locator(".room-card").filter({ hasText: roomName });
    const displayHref = await ownRoomCard
      .getByRole("link", { name: "打开公共大屏" })
      .getAttribute("href");
    expect(displayHref).toBeTruthy();
    await ownRoomCard.getByRole("button", { name: "返回牌桌" }).click();
    await expect(hostPage.getByRole("heading", { name: roomName })).toBeVisible();
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
    await expect(join.locator(".join-room-summary h3")).toHaveText(roomName);
    await expect(join.locator(".join-room-summary")).toContainText("德州扑克");
    await expect(join.locator(".join-room-summary")).toContainText(
      "当前人数 1/10"
    );
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
    await expect(unreadyPage.locator(".shared-room-title h1")).toHaveText(roomName);
    await expect(unreadyPage.getByLabel("我的手牌")).toHaveCount(0);
    await expect(hostPage.getByLabel("庄家按钮")).toHaveCount(1);
    await expect(hostPage.getByText("盲注与开局确认 · 第 1 手")).toBeVisible();
    await expect(hostPage.locator(".player-seat.needs-action")).toHaveCount(2);
    await expect(hostPage.locator(".player-seat.is-self")).toContainText("本人");
    const filledSeatLayout = await hostPage
      .locator(".player-seat.needs-action")
      .first()
      .evaluate((card) => {
        const avatar = card.querySelector<HTMLElement>(".member-avatar")!;
        const name = card.querySelector<HTMLElement>(".poker-seat-identity b")!;
        const connection = card.querySelector<HTMLElement>(
          ".poker-seat-identity small"
        )!;
        const text = [
          name,
          connection,
          ...card.querySelectorAll<HTMLElement>(
            ".seat-values small > span, .seat-values strong"
          )
        ];
        const avatarRect = avatar.getBoundingClientRect();
        const nameRect = name.getBoundingClientRect();
        const connectionRect = connection.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        return {
          background: getComputedStyle(card).backgroundColor,
          foreground: getComputedStyle(card).color,
          textColors: text.map((element) => getComputedStyle(element).color),
          width: cardRect.width,
          identityRightOfAvatar: nameRect.left >= avatarRect.right - 1,
          connectionBelowName: connectionRect.top >= nameRect.bottom - 1
        };
      });
    expect(filledSeatLayout.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(filledSeatLayout.textColors.every(
      (color) => color === filledSeatLayout.foreground
    )).toBe(true);
    expect(filledSeatLayout.width).toBeLessThanOrEqual(150);
    expect(filledSeatLayout.identityRightOfAvatar).toBe(true);
    expect(filledSeatLayout.connectionBelowName).toBe(true);
    await expect(hostPage.getByLabel("下注缓存")).toHaveCount(0);
    await expect(hostPage.getByRole("button", { name: "弃牌" })).toBeDisabled();
    await expect(hostPage.getByLabel("我的手牌")).toHaveCount(0);
    await expect(guestPage.getByLabel("我的手牌")).toHaveCount(0);

    const initialPokerState = await pokerPublicProgress(displayPage, roomId!);
    expect(initialPokerState.phase).toBe("blinds");
    expect(initialPokerState.potTotal).toBe(0);
    expect(initialPokerState.blindPostedAccountIds).toEqual([]);
    expect(initialPokerState.pendingHandStartAccountIds).toHaveLength(2);

    await guestPage.getByRole("button", { name: "提交盲注 100" }).click();
    await expect(guestPage.getByLabel("我的手牌").locator("span")).toHaveCount(2);
    await expect(hostPage.getByLabel("我的手牌")).toHaveCount(0);
    expect((await pokerPublicProgress(displayPage, roomId!)).phase).toBe("blinds");

    await hostPage.getByRole("button", { name: "提交盲注 50" }).click();
    await expect(hostPage.getByLabel("我的手牌").locator("span")).toHaveCount(2);
    await expect(guestPage.getByLabel("我的手牌").locator("span")).toHaveCount(2);
    await guestPage.getByRole("button", { name: "确认底牌" }).click();
    await expect(guestPage.getByText("已完成，等待其他玩家")).toBeVisible();
    expect((await pokerPublicProgress(displayPage, roomId!)).phase).toBe("blinds");
    await hostPage.getByRole("button", { name: "确认底牌" }).click();
    await expect(hostPage.getByText("翻牌前 · 第 1 手")).toBeVisible();
    await expect(guestPage.getByText("翻牌前 · 第 1 手")).toBeVisible();
    const startedPokerState = await pokerPublicProgress(displayPage, roomId!);
    expect(startedPokerState.phase).toBe("preflop");
    expect(startedPokerState.potTotal).toBe(150);
    expect(
      startedPokerState.seats.reduce(
        (sum, entry) => sum + entry.currentBet,
        0
      )
    ).toBe(150);
    expect(startedPokerState.blindPostedAccountIds).toHaveLength(2);
    expect(startedPokerState.handStartConfirmedAccountIds).toHaveLength(2);
    await expect(hostPage.getByLabel("我的手牌")).toHaveCount(0);
    await expect(guestPage.getByLabel("我的手牌")).toHaveCount(0);
    await expect(
      hostPage.getByRole("button", { name: /按住查看底牌/ })
    ).toBeVisible();
    await expect(
      guestPage.getByRole("button", { name: /按住查看底牌/ })
    ).toBeVisible();
    const memberTrigger = hostPage.getByRole("group", {
      name: `${unreadyName} 成员操作`
    });
    const memberCacheOverlap = await memberTrigger.evaluate((member) => {
      const cache = document.querySelector<HTMLElement>(".felt-bet-cache");
      if (!cache) return false;
      const memberRect = member.getBoundingClientRect();
      const cacheRect = cache.getBoundingClientRect();
      return !(
        memberRect.right <= cacheRect.left ||
        memberRect.left >= cacheRect.right ||
        memberRect.bottom <= cacheRect.top ||
        memberRect.top >= cacheRect.bottom
      );
    });
    expect(memberCacheOverlap).toBe(false);
    await expect(
      hostPage.getByRole("menuitem", { name: "移除玩家" })
    ).toHaveCount(0);
    await memberTrigger.click();
    await expect(hostPage.getByRole("menu", { name: "成员操作" })).toHaveCount(0);
    await openMemberContextMenu(
      memberTrigger,
      hostPage,
      testInfo.project.name
    );
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
    await openMemberContextMenu(
      memberTrigger,
      hostPage,
      testInfo.project.name
    );
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
    await expect(latePage.locator(".shared-room-title h1")).toHaveText(roomName);
    await expect(latePage.getByLabel("我的手牌")).toHaveCount(0);
    await expect(
      latePage.getByRole("button", {
        name: /提交盲注|确认底牌|确认已拿到实体底牌|弃牌|全押/
      })
    ).toHaveCount(0);
    await expect(hostPage.locator(".shared-room-title h1")).toHaveText(roomName);
    await expect(hostPage.locator(".shared-room-title")).toContainText("德州扑克");
    await expect(hostPage.locator(".shared-room-title")).not.toContainText(hostName);
    await expect(hostPage.getByRole("link", { name: "打开公共大屏" })).toHaveCount(0);
    await expect(hostPage.getByRole("button", { name: /暂停牌局|继续牌局/ })).toHaveCount(0);
    await expect(hostPage.getByLabel("语言选择")).toHaveCount(0);
    await expect(hostPage.getByRole("button", { name: "静音" })).toHaveCount(0);
    await hostPage.setViewportSize({ width: 300, height: 760 });
    expect(await hostPage.evaluate(() => ({
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth
    }))).toEqual({ viewport: 300, documentWidth: 300 });
    const mobileSeatGeometry = await hostPage.locator(".table-seats").evaluate((track) => {
      const trackRect = track.getBoundingClientRect();
      const cards = Array.from(
        track.querySelectorAll<HTMLElement>(".player-seat")
      );
      const cardRects = cards.map((card) => card.getBoundingClientRect());
      const dealer = track.querySelector<HTMLElement>(".dealer-marker");
      const dealerRect = dealer?.getBoundingClientRect();
      return {
        topGap: Math.min(...cardRects.map((rect) => rect.top - trackRect.top)),
        bottomGap: Math.min(...cardRects.map((rect) => trackRect.bottom - rect.bottom)),
        shadows: cards.map((card) => getComputedStyle(card).boxShadow),
        dealerWithinTrack: Boolean(dealerRect) &&
          dealerRect!.top >= trackRect.top &&
          dealerRect!.bottom <= trackRect.bottom
      };
    });
    expect(mobileSeatGeometry.topGap).toBeGreaterThanOrEqual(27);
    expect(mobileSeatGeometry.bottomGap).toBeGreaterThanOrEqual(32);
    expect(mobileSeatGeometry.shadows.every((shadow) => shadow !== "none")).toBe(true);
    expect(mobileSeatGeometry.dealerWithinTrack).toBe(true);
    const focusableSeat = hostPage.locator('.player-seat[tabindex="0"]').first();
    await hostPage.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await hostPage.keyboard.press("Tab");
      if (await focusableSeat.evaluate((card) => card === document.activeElement)) {
        break;
      }
    }
    await expect(focusableSeat).toBeFocused();
    expect(
      await focusableSeat.evaluate((card) => getComputedStyle(card).outlineStyle)
    ).not.toBe("none");
    await expect(hostPage.locator(".player-seat .seat-values").first()).toContainText(
      "剩余筹码"
    );
    await expect(hostPage.locator(".player-seat .seat-values").first()).toContainText(
      "本轮下注"
    );
    const peekControl = hostPage.getByRole("button", {
      name: /按住查看底牌/
    });
    await peekControl.click();
    await expect(hostPage.locator(".hole-card-reveal-layer")).toHaveCount(0);
    await peekControl.dispatchEvent("pointerdown", {
      pointerType: "mouse",
      button: 0,
      buttons: 1
    });
    const revealedCards = hostPage
      .locator(".hole-card-reveal-layer")
      .locator("[data-suit]");
    await expect(revealedCards).toHaveCount(2);
    const ownCard = revealedCards.first();
    const suit = await ownCard.getAttribute("data-suit");
    const cardColor = await ownCard.evaluate((element) => getComputedStyle(element).color);
    expect(cardColor).toBe(highContrastSuitColor(suit));
    await hostPage.evaluate(() => {
      window.dispatchEvent(new PointerEvent("pointerup"));
    });
    await expect(hostPage.locator(".hole-card-reveal-layer")).toHaveCount(0);
    await peekControl.focus();
    await hostPage.keyboard.down("Enter");
    await expect(hostPage.locator(".hole-card-reveal-layer [data-suit]")).toHaveCount(2);
    await hostPage.keyboard.up("Enter");
    await expect(hostPage.locator(".hole-card-reveal-layer")).toHaveCount(0);

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
    await actorPage.setViewportSize({ width: 300, height: 760 });
    const chipRack = actorPage.locator(".chip-rack");
    const chipOne = chipRack
      .getByRole("button", { name: "1", exact: true });
    const betCache = actorPage.getByLabel("下注缓存");
    await expect(observerPage.getByLabel("下注缓存")).toHaveCount(0);
    await expect(chipOne).not.toHaveAttribute("draggable", "true");
    expect(
      await chipRack.evaluate((rack) => getComputedStyle(rack).touchAction)
    ).toBe("pan-x");
    await chipOne.focus();
    await chipOne.press("Enter");
    const cachedOne = betCache.getByRole("button", { name: /移除 1 筹码/ });
    await expect(cachedOne).toHaveCount(1);
    await cachedOne.press("Enter");
    await expect(cachedOne).toHaveCount(0);

    for (let value = 1; value <= 16; value += 1) {
      await chipRack
        .getByRole("button", { name: String(value), exact: true })
        .click();
    }
    await chipOne.click();
    await expect(betCache.locator(".cache-chip-slot")).toHaveCount(16);
    const cacheGeometry = await betCache.evaluate((cache) => {
      const felt = cache.closest<HTMLElement>(".poker-felt")!;
      const track = cache.querySelector<HTMLElement>(".cache-chips")!;
      const chips = Array.from(
        track.querySelectorAll<HTMLElement>(".poker-chip")
      );
      const cacheRect = cache.getBoundingClientRect();
      const feltRect = felt.getBoundingClientRect();
      const trackRect = track.getBoundingClientRect();
      const chipRects = chips.map((chip) => chip.getBoundingClientRect());
      const centers = chipRects.map((rect) => rect.left + rect.width / 2);
      const steps = centers.slice(1).map((center, index) => center - centers[index]!);
      const total = cache.querySelector<HTMLElement>(":scope > strong")!;
      const clear = cache.querySelector<HTMLElement>(":scope > .text-button")!;
      const countedChip = chips.find((chip) => chip.querySelector(".cache-chip-count"))!;
      const valueRect = countedChip
        .querySelector<HTMLElement>(".cache-chip-value")!
        .getBoundingClientRect();
      const countRect = countedChip
        .querySelector<HTMLElement>(".cache-chip-count")!
        .getBoundingClientRect();
      const totalRect = total.getBoundingClientRect();
      const clearRect = clear.getBoundingClientRect();
      return {
        cacheWithinFelt:
          cacheRect.left >= feltRect.left &&
          cacheRect.right <= feltRect.right &&
          cacheRect.top >= feltRect.top &&
          cacheRect.bottom <= feltRect.bottom,
        spansFelt: feltRect.width - cacheRect.width <= 20,
        chipCount: getComputedStyle(track)
          .getPropertyValue("--cache-chip-count")
          .trim(),
        everyChipWithinTrack: chipRects.every(
          (rect) => rect.left >= trackRect.left - 1 && rect.right <= trackRect.right + 1
        ),
        stepSpread: Math.max(...steps) - Math.min(...steps),
        valueCountGap: countRect.top - valueRect.bottom,
        controlsWithinCache:
          totalRect.left >= cacheRect.left &&
          clearRect.right <= cacheRect.right &&
          totalRect.right <= clearRect.left
      };
    });
    expect(cacheGeometry.cacheWithinFelt).toBe(true);
    expect(cacheGeometry.spansFelt).toBe(true);
    expect(cacheGeometry.chipCount).toBe("16");
    expect(cacheGeometry.everyChipWithinTrack).toBe(true);
    expect(cacheGeometry.stepSpread).toBeLessThanOrEqual(1.5);
    expect(cacheGeometry.valueCountGap).toBeLessThanOrEqual(1);
    expect(cacheGeometry.controlsWithinCache).toBe(true);
    await betCache.getByRole("button", { name: "清空", exact: true }).click();
    await expect(betCache.locator(".cache-chip-slot")).toHaveCount(0);
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
    await expect(latePage.getByText("盲注与开局确认 · 第 2 手")).toBeVisible();
    await completePokerHandStart([hostPage, latePage]);
    await expect(latePage.getByText("翻牌前 · 第 2 手")).toBeVisible();
    await expect(latePage.getByLabel("我的手牌")).toHaveCount(0);
    await expect(
      latePage.getByRole("button", { name: /按住查看底牌/ })
    ).toBeVisible();
    await expect(guestPage.locator(".shared-room-title h1")).toHaveText(roomName);
    await expect(guestPage.getByLabel("我的手牌")).toHaveCount(0);
    await expect(
      guestPage.getByRole("button", {
        name: /提交盲注|确认底牌|按住查看底牌/
      })
    ).toHaveCount(0);
    await expect(displayPage.getByText("本手结算", { exact: true })).toHaveCount(0);

    await hostPage.reload();
    await expect(hostPage.getByText(roomName)).toBeVisible();
    await expect(hostPage.getByRole("button", { name: /静音|开启音效/ })).toHaveCount(0);
    await expect(hostPage.getByLabel("我的手牌")).toHaveCount(0);
    await expect(
      hostPage.getByRole("button", { name: /按住查看底牌/ })
    ).toBeVisible();
    await expect(hostPage.getByText("第 2 手")).toBeVisible();

    const hostPeekControl = hostPage.getByRole("button", {
      name: /按住查看底牌/
    });
    await hostPeekControl.dispatchEvent("pointerdown", {
      pointerType: "mouse",
      button: 0,
      buttons: 1
    });
    await expect(hostPage.locator(".hole-card-reveal-layer [data-suit]")).toHaveCount(2);
    await enter(takeoverPage, hostName, false, false);
    await expect(takeoverPage.getByText(roomName)).toBeVisible();
    await expect(hostPage.getByRole("alert")).toContainText("新设备");
    await expect(hostPage.locator(".hole-card-reveal-layer")).toHaveCount(0);

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

test("plays Avalon in automatic and manual modes with private roles, display isolation, signed scores, and 300px layout", async ({
  browser,
  page: hostPage
}, testInfo) => {
  test.setTimeout(240_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  const roomName = `阿瓦隆-${suffix}`;
  const seasonName = `负分赛季-${suffix}`;
  const playerNames = Array.from(
    { length: 5 },
    (_, index) => `圆桌-${index + 1}-${suffix}`
  );
  const guestContexts = await Promise.all(
    Array.from({ length: 4 }, () => browser.newContext())
  );
  const guestPages = await Promise.all(
    guestContexts.map((context) => context.newPage())
  );
  const displayContext = await browser.newContext();
  const displayPage = await displayContext.newPage();
  const playerPages = [hostPage, ...guestPages];

  try {
    await Promise.all([
      ...playerPages.map((page) => emulateLanHttp(page)),
      emulateLanHttp(displayPage)
    ]);

    await hostPage.goto("/admin");
    await hostPage.getByRole("button", { name: /阿瓦隆/ }).click();
    await expect(hostPage.locator(".avalon-admin-preset")).toHaveCount(6);
    await selectStyledOption(hostPage, "认角色模式", "自动认角色");
    await selectStyledOption(hostPage, "奥伯伦规则", "原版奥伯伦");
    await hostPage.getByLabel("每人押分").fill("100");
    await hostPage.getByRole("button", { name: "保存", exact: true }).click();
    await expect(hostPage.locator(".toast")).toContainText("设置已保存");

    await hostPage.goto("/admin/seasons");
    await hostPage.getByLabel("新赛季名称").fill(seasonName);
    await hostPage.getByLabel("基础分").fill("-50");
    await hostPage.getByRole("button", { name: "开始新赛季", exact: true }).click();
    await hostPage
      .getByRole("alertdialog", { name: "开始新赛季" })
      .getByRole("button", { name: "最终确认" })
      .click();
    await expect(hostPage.locator(".toast")).toContainText("新赛季已开始");

    await Promise.all(
      playerPages.map((page, index) => enter(page, playerNames[index]!))
    );

    await hostPage.getByRole("button", { name: /创建房间/ }).click();
    const chooser = hostPage.getByRole("dialog", { name: "创建房间" });
    await expect(chooser.locator(".game-choice-card small")).toHaveCount(0);
    await chooser.getByRole("button", { name: /阿瓦隆/ }).click();
    const create = hostPage.getByRole("dialog", {
      name: "创建房间 · 阿瓦隆"
    });
    await create.getByLabel("房间名称").fill(roomName);
    await selectStyledOption(create, "认角色模式", "自动认角色");
    await selectStyledOption(create, "奥伯伦规则", "原版奥伯伦");
    await create.getByLabel("每人押分").fill("100");
    await create.getByRole("button", { name: "创建房间" }).click();
    await expect(
      hostPage.getByRole("heading", { name: roomName })
    ).toBeVisible();
    await expect(hostPage.locator("html")).toHaveAttribute(
      "data-theme-scope",
      "avalon"
    );
    expect(
      await hostPage.locator("html").evaluate((root) =>
        root.style.getPropertyValue("--color-accent").trim()
      )
    ).toBe(productConfig.themes.avalon.dark.accent);
    expect(productConfig.themes.avalon.dark.accent).not.toBe(
      productConfig.themes.poker.dark.accent
    );

    await expect(
      hostPage.getByRole("link", { name: "打开公共大屏" })
    ).toHaveCount(0);
    await expect(
      hostPage.getByRole("button", { name: /暂停|继续|作废/ })
    ).toHaveCount(0);
    const compositionTrigger = hostPage.getByRole("button", {
      name: "查看本局角色构成"
    });
    await compositionTrigger.click();
    const compositionPopover = hostPage.getByRole("dialog", {
      name: "角色构成"
    });
    await expect(compositionPopover).toContainText(
      "至少选择 5 名在线玩家后显示角色构成"
    );
    await hostPage.keyboard.press("Escape");
    await expect(compositionPopover).toHaveCount(0);
    await expect(compositionTrigger).toBeFocused();

    await hostPage.getByRole("button", { name: "返回大厅" }).click();
    await expect(hostPage.getByRole("heading", { name: "聚会大厅" })).toBeVisible();
    const avalonRoomCard = hostPage
      .locator(".room-card")
      .filter({ hasText: roomName });
    const displayHref = await avalonRoomCard
      .getByRole("link", { name: "打开公共大屏" })
      .getAttribute("href");
    expect(displayHref).toBeTruthy();
    await avalonRoomCard.getByRole("button", { name: "返回牌桌" }).click();
    await expect(hostPage.getByRole("heading", { name: roomName })).toBeVisible();
    const roomId = new URL(
      displayHref!,
      "http://127.0.0.1:4173"
    ).searchParams.get("roomId");
    expect(roomId).toBeTruthy();

    for (const [guestIndex, guestPage] of guestPages.entries()) {
      const card = guestPage.locator(".room-card").filter({ hasText: roomName });
      await expect(card).toContainText("自动认角色");
      await expect(card).toContainText("原版奥伯伦");
      await expect(card).toContainText(`${guestIndex + 1}/10`);
      await card.getByRole("button", { name: "加入牌局" }).click();
      const joinDialog = guestPage.getByRole("dialog", {
        name: "加入牌局"
      });
      await expect(joinDialog.locator(".join-room-summary h3")).toHaveText(
        roomName
      );
      await expect(joinDialog.locator(".join-room-summary")).toContainText(
        "阿瓦隆"
      );
      await expect(joinDialog.locator(".join-room-summary")).toContainText(
        `当前人数 ${guestIndex + 1}/10`
      );
      await joinDialog.getByRole("button", { name: "加入牌局" }).click();
      await expect(guestPage.locator(".shared-room-title h1")).toHaveText(
        roomName
      );
      await expect(joinDialog).toHaveCount(0);
    }
    await expect(hostPage.locator(".avalon-member")).toHaveCount(5);
    const avalonMemberTrigger = hostPage.getByRole("group", {
      name: `${playerNames[1]} 玩家操作`
    });
    await expect(
      hostPage.getByRole("menuitem", { name: "移除" })
    ).toHaveCount(0);
    await avalonMemberTrigger.click();
    await expect(
      hostPage.getByRole("menu", { name: "玩家操作" })
    ).toHaveCount(0);
    await openMemberContextMenu(
      avalonMemberTrigger,
      hostPage,
      testInfo.project.name
    );
    await expect(
      hostPage.getByRole("menu", { name: "玩家操作" })
    ).toBeVisible();
    await hostPage.keyboard.press("Escape");
    await expect(avalonMemberTrigger).toBeFocused();
    await hostPage.keyboard.press("Shift+F10");
    await expect(
      hostPage.getByRole("menu", { name: "玩家操作" })
    ).toBeVisible();
    await hostPage.keyboard.press("Escape");
    await selectStyledOption(hostPage, "角色来源", "自定义角色");
    await hostPage.getByLabel("派西维尔", { exact: true }).fill("0");
    await hostPage.getByLabel("莫甘娜", { exact: true }).fill("0");
    await hostPage.getByRole("button", { name: "保存下一局设置" }).click();
    await expect(hostPage.getByLabel("角色来源")).toContainText("自定义角色");
    const waitingLayout = await hostPage
      .locator(".avalon-action-panel")
      .evaluate((panel) => {
        const start = panel.querySelector<HTMLButtonElement>(
          ".avalon-ready-card .primary"
        );
        const save = panel.querySelector<HTMLButtonElement>(
          ".avalon-settings-card > .primary"
        );
        const settings = panel.querySelector<HTMLElement>(
          ".avalon-settings-card"
        );
        const stake = panel.querySelector<HTMLInputElement>(
          ".avalon-settings-card input[type='number']"
        );
        const select = panel.querySelector<HTMLButtonElement>(
          ".avalon-settings-card .select-trigger"
        );
        return {
          viewportWidth: innerWidth,
          startBottom: start?.getBoundingClientRect().bottom ?? 0,
          saveBottom: save?.getBoundingClientRect().bottom ?? 0,
          settingsTop: settings?.getBoundingClientRect().top ?? 0,
          stakeHeight: stake?.getBoundingClientRect().height ?? 0,
          selectHeight: select?.getBoundingClientRect().height ?? 0
        };
      });
    expect(waitingLayout.settingsTop).toBeGreaterThan(waitingLayout.startBottom);
    expect(waitingLayout.saveBottom).toBeGreaterThan(waitingLayout.settingsTop);
    expect(Math.abs(waitingLayout.stakeHeight - waitingLayout.selectHeight))
      .toBeLessThanOrEqual(2);

    await displayPage.goto(displayHref!);
    await expect(displayPage.getByText("匿名只读 · 不占成员名额")).toBeVisible();
    await expect(displayPage.locator("html")).toHaveAttribute(
      "data-theme-scope",
      "avalon"
    );
    await expect(
      displayPage.locator(".avalon-role-composition")
    ).toContainText("至少选择 5 名在线玩家后显示角色构成");
    expect(
      await displayPage
        .locator(".avalon-display-layout")
        .evaluate((layout) => {
          const composition = layout.querySelector(".avalon-role-composition");
          const members = layout.querySelector(".avalon-member-rail");
          return Boolean(
            composition &&
            members &&
            (composition.compareDocumentPosition(members) &
              Node.DOCUMENT_POSITION_FOLLOWING)
          );
        })
    ).toBe(true);
    await expect(displayPage.locator(".avalon-member")).toHaveCount(5);
    await expect(
      displayPage.getByRole("button", { name: /准备|开始|提交|同意|反对/ })
    ).toHaveCount(0);

    await expect(hostPage.getByText("房主自动准备并参赛")).toHaveCount(0);
    await expect(hostPage.getByText("1/5", { exact: true })).toHaveCount(0);
    await expect(
      hostPage.locator(".avalon-ready-meter")
    ).toHaveAttribute(
      "aria-label",
      "当前选中 1 人，最少 5 人，最多 10 人"
    );
    await expect(hostPage.locator(".avalon-ready-dots i")).toHaveCount(10);
    await expect(
      hostPage.locator(".avalon-ready-dots i.is-filled")
    ).toHaveCount(1);
    await expect(
      hostPage.locator(".avalon-ready-dots i.is-required")
    ).toHaveCount(4);
    await expect(
      hostPage.locator(".avalon-ready-dots i.is-optional")
    ).toHaveCount(5);
    for (const guestPage of guestPages) {
      await guestPage.getByRole("button", { name: "准备", exact: true }).click();
    }
    await expect(hostPage.locator(".avalon-member.is-ready")).toHaveCount(5);
    await expect(
      hostPage.locator(".avalon-ready-dots i.is-filled")
    ).toHaveCount(5);
    await expect(
      hostPage.locator(".avalon-ready-card .avalon-role-composition")
    ).toContainText("5 人");
    await expect(
      hostPage.locator(".avalon-ready-card .avalon-role-composition li")
    ).toHaveCount(4);
    await expect(
      hostPage.locator(".avalon-ready-card .avalon-role-composition")
    ).toContainText(/忠臣\s*×2/);
    await expect(
      displayPage.locator(".avalon-role-composition")
    ).toContainText("5 人");
    await expect(
      displayPage.locator(".avalon-role-composition")
    ).toContainText(/忠臣\s*×2/);
    await compositionTrigger.click();
    await expect(compositionPopover.locator("li")).toHaveCount(4);
    await expect(compositionPopover).toContainText("梅林");
    await expect(compositionPopover).toContainText(/忠臣\s*×2/);
    await compositionTrigger.click();
    await expect(compositionPopover).toHaveCount(0);
    await hostPage.getByRole("button", { name: "开始游戏" }).click();
    await expect(hostPage.locator(".avalon-member.is-ready")).toHaveCount(0);
    await expect(hostPage.locator(".avalon-member.needs-action")).toHaveCount(5);
    await compositionTrigger.click();
    await expect(compositionPopover).toContainText("5 人");
    await expect(compositionPopover).toContainText(/忠臣\s*×2/);
    await hostPage.keyboard.press("Escape");
    await expect(compositionPopover).toHaveCount(0);
    await expect(hostPage.locator(".avalon-secret")).toHaveCount(0);
    await expect(hostPage.locator(".avalon-mission-rule")).toHaveCount(5);
    await expect(
      hostPage.locator(".avalon-mission-board .avalon-section-heading h2")
    ).toHaveCount(0);
    await expect(
      hostPage.locator(".avalon-mission-track article > strong")
    ).toHaveCount(0);
    await expect(
      hostPage.locator(".avalon-mission-rule").filter({ hasText: "–" })
    ).toHaveCount(0);
    await expect(
      hostPage.locator(".avalon-control-card.is-actionable")
    ).toBeVisible();
    const activeLayout = await hostPage
      .locator(".avalon-action-panel.is-game-active")
      .evaluate((panel) => {
        const secret = panel.querySelector<HTMLElement>(
          ".avalon-secret-control"
        );
        const action = panel.querySelector<HTMLElement>(
          ".avalon-control-card.is-actionable"
        );
        const button = action?.querySelector<HTMLElement>(".primary");
        const leader = document.querySelector<HTMLElement>(
          ".avalon-member.is-leader"
        );
        const self = document.querySelector<HTMLElement>(
          ".avalon-member.is-self"
        );
        const currentMission = document.querySelector<HTMLElement>(
          ".avalon-mission-track .mission-current"
        );
        return {
          viewportWidth: innerWidth,
          secretX: secret?.getBoundingClientRect().x ?? 0,
          secretWidth: secret?.getBoundingClientRect().width ?? 0,
          actionX: action?.getBoundingClientRect().x ?? 0,
          actionWidth: action?.getBoundingClientRect().width ?? 0,
          actionColor: action ? getComputedStyle(action).backgroundColor : "",
          buttonColor: button ? getComputedStyle(button).backgroundColor : "",
          samePlayer: leader === self,
          leaderBorder: leader ? getComputedStyle(leader).borderTopColor : "",
          selfBorder: self ? getComputedStyle(self).borderTopColor : "",
          missionColor: currentMission
            ? getComputedStyle(currentMission).backgroundColor
            : ""
        };
      });
    expect(activeLayout.actionX).toBeGreaterThan(activeLayout.secretX);
    expect(activeLayout.actionWidth).toBeGreaterThan(
      activeLayout.secretWidth * 1.45
    );
    expect(activeLayout.actionColor).not.toBe(activeLayout.buttonColor);
    expect(activeLayout.leaderBorder).toBeTruthy();
    expect(activeLayout.selfBorder).toBeTruthy();
    if (activeLayout.samePlayer) {
      expect(activeLayout.selfBorder).toBe(activeLayout.leaderBorder);
    } else {
      expect(activeLayout.selfBorder).not.toBe(activeLayout.leaderBorder);
    }
    expect(activeLayout.missionColor).toBe(activeLayout.leaderBorder);
    const activeViewport = hostPage.viewportSize()!;
    await hostPage.setViewportSize({ width: 300, height: 600 });
    const activeMobile = await hostPage.evaluate(() => {
      window.scrollTo(0, 100);
      const shell = document.querySelector<HTMLElement>(".avalon-shell");
      const layout = document.querySelector<HTMLElement>(".avalon-layout");
      const secret = document.querySelector<HTMLElement>(
        ".avalon-secret-control"
      );
      const action = document.querySelector<HTMLElement>(
        ".avalon-control-card.is-actionable"
      );
      const memberGrid = document.querySelector<HTMLElement>(
        ".avalon-member-grid"
      );
      const headerButtons = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".shared-room-header-actions button, .shared-room-header-danger button"
        )
      ).map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          borderRadius: getComputedStyle(button).borderRadius
        };
      });
      return {
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        outerScrollY: scrollY,
        shellHeight: shell?.getBoundingClientRect().height ?? 0,
        layoutOverflowY: layout ? getComputedStyle(layout).overflowY : "",
        secretX: secret?.getBoundingClientRect().x ?? 0,
        secretWidth: secret?.getBoundingClientRect().width ?? 0,
        actionX: action?.getBoundingClientRect().x ?? 0,
        actionWidth: action?.getBoundingClientRect().width ?? 0,
        memberColumns:
          memberGrid
            ? getComputedStyle(memberGrid).gridTemplateColumns
                .split(" ")
                .filter(Boolean).length
            : 0,
        memberCount:
          memberGrid?.querySelectorAll(".avalon-member").length ?? 0,
        headerButtons
      };
    });
    expect(activeMobile.viewportWidth).toBe(300);
    expect(activeMobile.documentWidth).toBe(300);
    expect(activeMobile.documentHeight).toBeLessThanOrEqual(
      activeMobile.viewportHeight + 1
    );
    expect(activeMobile.outerScrollY).toBe(0);
    expect(activeMobile.shellHeight).toBeCloseTo(activeMobile.viewportHeight, 0);
    expect(activeMobile.layoutOverflowY).toBe("auto");
    expect(activeMobile.actionX).toBeGreaterThan(activeMobile.secretX);
    expect(activeMobile.actionWidth).toBeGreaterThan(
      activeMobile.secretWidth * 1.45
    );
    expect(activeMobile.memberColumns).toBe(2);
    expect(activeMobile.memberCount).toBe(5);
    expect(activeMobile.headerButtons).toHaveLength(3);
    expect(new Set(activeMobile.headerButtons.map((button) => button.y)).size)
      .toBe(1);
    expect(
      activeMobile.headerButtons.every(
        (button) =>
          button.width <= 46 &&
          (button.borderRadius === "50%" || button.borderRadius === "999px")
      )
    ).toBe(true);
    await hostPage.setViewportSize(activeViewport);
    const automaticRoles = await Promise.all(
      playerPages.map((playerPage) => revealAndCoverAvalonRole(playerPage))
    );
    const evilRoleIndex = automaticRoles.findIndex((role) =>
      ["刺客", "莫甘娜", "莫德雷德", "奥伯伦", "爪牙"].includes(role)
    );
    expect(evilRoleIndex).toBeGreaterThanOrEqual(0);
    await expect(displayPage.getByText("你的角色", { exact: true })).toHaveCount(0);
    await expect(displayPage.getByText("查看身份")).toHaveCount(0);

    const hostIdentityButton = hostPage.getByRole("button", {
      name: "查看身份"
    });
    await expect(hostIdentityButton).toHaveClass(/primary/);
    await hostPage
      .getByRole("button", { name: "确认已看清角色" })
      .click();
    await expect(hostIdentityButton).toHaveClass(/secondary/);
    for (const playerPage of guestPages) {
      await expect(
        playerPage.getByRole("button", { name: "确认已看清角色" })
      ).toBeVisible();
      await playerPage
        .getByRole("button", { name: "确认已看清角色" })
        .click();
    }

    const evilPlayerName = playerNames[evilRoleIndex]!;
    await completeFailedAvalonMission(
      playerPages,
      displayPage,
      roomId!,
      evilPlayerName
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await rejectCurrentAvalonProposal(
        playerPages,
        displayPage,
        roomId!,
        attempt === 0
      );
    }

    await expect(
      hostPage.getByRole("heading", { name: /胜方[:：]\s*邪恶方/ })
    ).toBeVisible();
    await expect(hostPage.locator(".avalon-result-list article")).toHaveCount(5);
    await expect(displayPage.locator(".avalon-result-list article")).toHaveCount(5);
    await expect(displayPage.getByText("五次否决", { exact: false })).toBeVisible();
    const scoreDeltas = await hostPage
      .locator(".avalon-result-list article > b")
      .allTextContents();
    expect(
      scoreDeltas.reduce(
        (sum, value) => sum + Number(value.replace(/[+,]/g, "")),
        0
      )
    ).toBe(0);
    await expect(hostPage.getByText(/结算后总分 -150/).first()).toBeVisible();
    await hostPage.reload();
    await expect(hostPage.locator(".avalon-result-list article")).toHaveCount(5);
    await expect(
      hostPage.locator(".avalon-ready-card .avalon-role-composition")
    ).toContainText("5 人");
    await expect(
      hostPage.locator(".avalon-ready-card .avalon-role-composition li")
    ).toHaveCount(4);
    await expect(
      hostPage.locator(".avalon-ready-card .avalon-role-composition")
    ).toContainText(/忠臣\s*×2/);
    await expect(displayPage.locator(".avalon-role-composition")).toContainText(
      "5 人"
    );

    const desktopViewport = hostPage.viewportSize()!;
    await hostPage.setViewportSize({ width: 300, height: 760 });
    const intermissionNarrow = await hostPage.evaluate(() => {
      window.scrollTo(0, 100);
      const layout = document.querySelector<HTMLElement>(".avalon-layout");
      return {
        viewport: innerWidth,
        viewportHeight: innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        outerScrollY: scrollY,
        layoutOverflowY: layout ? getComputedStyle(layout).overflowY : ""
      };
    });
    expect(intermissionNarrow.viewport).toBe(300);
    expect(intermissionNarrow.documentWidth).toBe(300);
    expect(intermissionNarrow.documentHeight).toBeLessThanOrEqual(
      intermissionNarrow.viewportHeight + 1
    );
    expect(intermissionNarrow.outerScrollY).toBe(0);
    expect(intermissionNarrow.layoutOverflowY).toBe("auto");
    await expect(hostPage.getByText("局间准备", { exact: true }).first()).toBeVisible();
    await hostPage.setViewportSize(desktopViewport);

    await selectStyledOption(hostPage, "认角色模式", "手动认角色");
    await hostPage.getByRole("button", { name: "保存下一局设置" }).click();
    await expect(hostPage.getByLabel("认角色模式")).toContainText("手动认角色");
    for (const guestPage of guestPages) {
      await guestPage.getByRole("button", { name: "准备", exact: true }).click();
    }
    await hostPage.getByRole("button", { name: "开始下一局" }).click();
    await expect(
      hostPage.getByRole("button", { name: "查看身份" })
    ).toBeVisible();

    const reveal = hostPage.getByRole("button", {
      name: "查看身份"
    });
    await reveal.dispatchEvent("pointerdown", { pointerType: "mouse" });
    await expect(hostPage.locator(".avalon-member-secret")).toHaveCount(1);
    await expect(
      hostPage.locator(".avalon-member.is-identity-revealed")
    ).toHaveCount(5);
    await expect(
      hostPage.locator(".avalon-member-secret").getByText(
        /梅林可见的邪恶|派西维尔候选|邪恶同伴/
      )
    ).toHaveCount(0);
    await hostPage.evaluate(() => {
      window.dispatchEvent(new PointerEvent("pointerup"));
    });
    await expect(hostPage.locator(".avalon-member-secret")).toHaveCount(0);
    await expect(
      hostPage.locator(".avalon-member.is-identity-revealed")
    ).toHaveCount(0);

    for (const playerPage of playerPages) {
      await playerPage
        .getByRole("button", { name: "确认已看清角色" })
        .click();
    }
    await expect(
      hostPage.getByRole("heading", { name: "夜间认人" })
    ).toBeVisible();
    await expect(
      displayPage.getByRole("heading", { name: "夜间认人" })
    ).toBeVisible();
    const currentNightStep = hostPage.locator(".avalon-night-card li.current");
    await expect(currentNightStep).toContainText("所有人闭眼");
    await hostPage.getByRole("button", { name: "下一步" }).click();
    await expect(currentNightStep).not.toContainText("所有人闭眼");
    await hostPage
      .getByRole("button", { name: "重新开始夜间流程" })
      .click();
    await expect(currentNightStep).toContainText("所有人闭眼");
    for (let step = 0; step < 20; step += 1) {
      const before = await avalonPublicProgress(displayPage, roomId!);
      if (before.phase !== "manual-night") break;
      await expect(
        hostPage
          .locator(".avalon-night-card li")
          .nth(before.nightStepIndex ?? 0)
      ).toHaveClass(/current/);
      const next = hostPage.getByRole("button", { name: "下一步" });
      if (!(await next.isVisible())) break;
      await next.dispatchEvent("click");
      await expect
        .poll(
          async () =>
            (await avalonPublicProgress(displayPage, roomId!)).avalonVersion
        )
        .toBeGreaterThan(before.avalonVersion);
    }
    await expect
      .poll(async () => await avalonLeaderPageIndex(playerPages))
      .toBeGreaterThanOrEqual(0);
    await expect(displayPage.getByText("你的角色", { exact: true })).toHaveCount(0);

    for (let mission = 0; mission < 3; mission += 1) {
      await completeSuccessfulAvalonMission(
        playerPages,
        displayPage,
        roomId!,
        mission
      );
    }
    await expect
      .poll(async () => await avalonAssassinPageIndex(playerPages))
      .toBeGreaterThanOrEqual(0);
    const assassinPage = playerPages[
      await avalonAssassinPageIndex(playerPages)
    ]!;
    const assassination = assassinPage
      .locator(".avalon-control-card")
      .filter({
        has: assassinPage.getByRole("heading", { name: "刺杀梅林" })
      });
    await expect(assassination.locator(".avalon-target-grid button")).toHaveCount(4);
    await expect(assassination).not.toContainText(/善方|邪恶方/);
    await assassination.locator(".avalon-target-grid button").first().click();
    await assassination
      .getByRole("button", { name: "确认刺杀" })
      .click();
    await expect(hostPage.locator(".avalon-result-list article")).toHaveCount(5);
    await expect(displayPage.locator(".avalon-result-list article")).toHaveCount(5);
    await expect(displayPage.getByText("你的角色", { exact: true })).toHaveCount(0);

    await hostPage.getByRole("button", { name: "关闭房间" }).click();
    await hostPage
      .getByRole("alertdialog", { name: "关闭房间" })
      .getByRole("button", { name: "关闭房间" })
      .click();
    await expect(
      hostPage.getByRole("heading", { name: "聚会大厅" })
    ).toBeVisible();
    for (const guestPage of guestPages) {
      await expect(
        guestPage.getByRole("heading", { name: "聚会大厅" })
      ).toBeVisible();
    }
  } finally {
    await Promise.all([
      ...guestContexts.map((context) => context.close()),
      displayContext.close()
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

async function completePokerHandStart(pages: Page[]): Promise<void> {
  await Promise.all(
    pages.map((page) =>
      expect(page.getByText(/盲注与开局确认 · 第 \d+ 手/)).toBeVisible()
    )
  );
  for (const page of pages) {
    const postBlind = page.getByRole("button", { name: /提交盲注 \d+/ });
    if ((await postBlind.count()) > 0 && await postBlind.isVisible()) {
      await postBlind.click();
    }
  }
  for (const page of pages) {
    const confirmCards = page.getByRole("button", {
      name: /确认底牌|确认已拿到实体底牌/
    });
    await expect(confirmCards).toBeVisible();
    await confirmCards.click();
  }
  await Promise.all(
    pages.map((page) =>
      expect(page.locator(".poker-hand-start-card")).toHaveCount(0)
    )
  );
}

async function pokerPublicProgress(
  displayPage: Page,
  roomId: string
): Promise<{
  phase: string;
  potTotal: number;
  blindPostedAccountIds: string[];
  handStartConfirmedAccountIds: string[];
  pendingHandStartAccountIds: string[];
  seats: Array<{ currentBet: number }>;
}> {
  const response = await displayPage.request.get(
    `/api/room/${encodeURIComponent(roomId)}?display=1`
  );
  expect(response.ok()).toBe(true);
  return (await response.json()) as {
    phase: string;
    potTotal: number;
    blindPostedAccountIds: string[];
    handStartConfirmedAccountIds: string[];
    pendingHandStartAccountIds: string[];
    seats: Array<{ currentBet: number }>;
  };
}

async function openMemberContextMenu(
  trigger: Locator,
  page: Page,
  projectName: string
): Promise<void> {
  if (projectName.startsWith("webkit")) {
    const box = await trigger.boundingBox();
    expect(box).toBeTruthy();
    const pointer = {
      pointerType: "touch",
      pointerId: 41,
      isPrimary: true,
      button: 0,
      clientX: (box?.x ?? 0) + (box?.width ?? 0) / 2,
      clientY: (box?.y ?? 0) + (box?.height ?? 0) / 2
    };
    await trigger.dispatchEvent("pointerdown", {
      ...pointer,
      buttons: 1
    });
    await page.waitForTimeout(580);
    await trigger.dispatchEvent("pointerup", {
      ...pointer,
      buttons: 0
    });
    return;
  }
  await trigger.click({ button: "right" });
}

async function revealAndCoverAvalonRole(page: Page): Promise<string> {
  const reveal = page.getByRole("button", {
    name: "查看身份"
  });
  await reveal.dispatchEvent("pointerdown", { pointerType: "mouse" });
  await expect(page.locator(".avalon-member-secret").first()).toBeVisible();
  const selfSecret = page.locator(
    ".avalon-member.is-self .avalon-member-secret"
  );
  await expect(selfSecret).toBeVisible();
  const exactRole = (await selfSecret.locator("strong").textContent()) ?? "";
  expect(exactRole).toMatch(
    /^(梅林|派西维尔|忠臣|刺客|莫甘娜|莫德雷德|奥伯伦|爪牙)$/
  );
  const memberCount = await page.locator(".avalon-member").count();
  await expect(
    page.locator(".avalon-member.is-identity-revealed")
  ).toHaveCount(memberCount);
  const revealedBackgrounds = await page
    .locator(".avalon-member.is-identity-revealed")
    .evaluateAll((members) =>
      members.map((member) => getComputedStyle(member).backgroundColor)
    );
  expect(new Set(revealedBackgrounds).size).toBe(1);
  await page.evaluate(() => {
    window.dispatchEvent(new PointerEvent("pointerup"));
  });
  await expect(page.locator(".avalon-member-secret")).toHaveCount(0);
  await expect(
    page.locator(".avalon-member.is-identity-revealed")
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "查看身份" })
  ).toBeVisible();
  return exactRole;
}

async function avalonLeaderPageIndex(pages: Page[]): Promise<number> {
  for (const [index, page] of pages.entries()) {
    if (
      await page
        .getByRole("heading", { name: /选择任务队伍/ })
        .isVisible()
    ) {
      return index;
    }
  }
  return -1;
}

async function avalonPublicProgress(
  displayPage: Page,
  roomId: string
): Promise<{
  avalonVersion: number;
  phase: string;
  nightStepIndex?: number;
  voteSubmittedAccountIds: string[];
  missionSubmittedAccountIds: string[];
  missionHistory: unknown[];
  voteHistory: unknown[];
}> {
  const response = await displayPage.request.get(
    `/api/room/${encodeURIComponent(roomId)}?display=1`
  );
  expect(response.ok()).toBe(true);
  return (await response.json()) as {
    avalonVersion: number;
    phase: string;
    nightStepIndex?: number;
    voteSubmittedAccountIds: string[];
    missionSubmittedAccountIds: string[];
    missionHistory: unknown[];
    voteHistory: unknown[];
  };
}

async function rejectCurrentAvalonProposal(
  playerPages: Page[],
  displayPage: Page,
  roomId: string,
  inspectPartialSecrecy: boolean
): Promise<void> {
  await expect
    .poll(async () => await avalonLeaderPageIndex(playerPages))
    .toBeGreaterThanOrEqual(0);
  const leaderIndex = await avalonLeaderPageIndex(playerPages);
  const leaderPage = playerPages[leaderIndex]!;
  leaderPage.setDefaultTimeout(10_000);
  const existingVoteHistory = inspectPartialSecrecy
    ? (await avalonPublicProgress(displayPage, roomId)).voteHistory
    : [];
  const originalViewport = leaderPage.viewportSize()!;
  if (inspectPartialSecrecy) {
    await leaderPage.setViewportSize({ width: 300, height: 760 });
  }
  const heading = leaderPage.getByRole("heading", {
    name: /选择任务队伍/
  });
  const headingText = await heading.textContent();
  const teamSize = Number(headingText?.match(/\/(\d+)/)?.[1]);
  expect(teamSize).toBeGreaterThan(0);
  const control = leaderPage.locator(".avalon-control-card").filter({
    has: heading
  });
  const candidates = leaderPage.locator(".avalon-member-select");
  await expect(candidates).toHaveCount(playerPages.length);
  const memberRail = leaderPage.locator(".avalon-member-rail");
  await expect(memberRail).toHaveClass(/is-selecting-team/);
  const selectionCue = await memberRail.evaluate((rail) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--color-accent)";
    document.body.append(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    const style = getComputedStyle(rail);
    return {
      accent,
      border: style.borderTopColor,
      animationName: style.animationName
    };
  });
  expect(selectionCue.border).toBe(selectionCue.accent);
  expect(selectionCue.animationName).toContain("avalon-selection-pulse");
  for (let index = 0; index < teamSize; index += 1) {
    await candidates.nth(index).click();
    await expect(candidates.nth(index)).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  }
  await control.getByRole("button", { name: "提交队伍" }).click();
  await expect
    .poll(
      async () => (await avalonPublicProgress(displayPage, roomId)).phase
    )
    .toBe("team-vote");
  for (const page of playerPages) {
    await expect(page.getByRole("button", { name: "反对" })).toBeVisible();
  }
  await expect(
    leaderPage.locator(".avalon-member.needs-action")
  ).toHaveCount(playerPages.length);
  await expect(memberRail).not.toHaveClass(/is-selecting-team/);
  if (inspectPartialSecrecy) {
    const mobileChoices = await leaderPage
      .locator(".avalon-control-card.is-actionable .avalon-choice-row")
      .evaluate((row) =>
        Array.from(row.querySelectorAll("button")).map((button) => {
          const rect = button.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width };
        })
      );
    expect(mobileChoices).toHaveLength(2);
    expect(Math.abs(mobileChoices[0]!.x - mobileChoices[1]!.x))
      .toBeLessThanOrEqual(1);
    expect(Math.abs(mobileChoices[0]!.width - mobileChoices[1]!.width))
      .toBeLessThanOrEqual(1);
    expect(mobileChoices[1]!.y).toBeGreaterThan(mobileChoices[0]!.y);
    await leaderPage.setViewportSize(originalViewport);
  }

  const partialCount = inspectPartialSecrecy ? playerPages.length - 1 : 0;
  for (let index = 0; index < partialCount; index += 1) {
    await playerPages[index]!
      .getByRole("button", { name: "反对" })
      .click();
    await expect
      .poll(
        async () =>
          (
            await avalonPublicProgress(displayPage, roomId)
          ).voteSubmittedAccountIds.length
      )
      .toBe(index + 1);
    const submittedName =
      (await playerPages[index]!
        .locator(".avalon-member.is-self .avalon-member-identity strong")
        .textContent()) ?? "";
    const submittedMember = playerPages[index + 1]!
      .locator(".avalon-member")
      .filter({ hasText: submittedName });
    await expect(submittedMember).toHaveClass(/is-submitted/);
    await expect(submittedMember).not.toHaveClass(/needs-action/);
    await expect(submittedMember).toContainText("已投票");
    await expect(playerPages[index + 1]!.locator(".avalon-public-state"))
      .toContainText(`${index + 1}/`);
  }
  if (inspectPartialSecrecy) {
    const partial = await avalonPublicProgress(displayPage, roomId);
    expect(partial.voteSubmittedAccountIds).toHaveLength(
      playerPages.length - 1
    );
    expect(partial.voteHistory).toEqual(existingVoteHistory);
    expect(JSON.stringify(partial)).not.toContain("roleAssignments");
    expect(JSON.stringify(partial)).not.toContain("missionChoices");
  }
  for (let index = partialCount; index < playerPages.length; index += 1) {
    await playerPages[index]!
      .getByRole("button", { name: "反对" })
      .click();
    if (index < playerPages.length - 1) {
      await expect
        .poll(
          async () =>
            (
              await avalonPublicProgress(displayPage, roomId)
            ).voteSubmittedAccountIds.length
        )
        .toBe(index + 1);
      await expect(playerPages[index + 1]!.locator(".avalon-public-state"))
        .toContainText(`${index + 1}/`);
    } else {
      await expect
        .poll(
          async () =>
            (await avalonPublicProgress(displayPage, roomId)).phase
        )
        .not.toBe("team-vote");
    }
  }
}

async function completeFailedAvalonMission(
  playerPages: Page[],
  displayPage: Page,
  roomId: string,
  evilPlayerName: string
): Promise<void> {
  await expect
    .poll(async () => await avalonLeaderPageIndex(playerPages))
    .toBeGreaterThanOrEqual(0);
  const leaderPage = playerPages[
    await avalonLeaderPageIndex(playerPages)
  ]!;
  const heading = leaderPage.getByRole("heading", {
    name: /选择任务队伍/
  });
  const headingText = await heading.textContent();
  const teamSize = Number(headingText?.match(/\/(\d+)/)?.[1]);
  expect(teamSize).toBeGreaterThan(0);
  const candidates = leaderPage.locator(".avalon-member-select");
  const evilCandidate = candidates.filter({ hasText: evilPlayerName });
  await expect(evilCandidate).toHaveCount(1);
  await evilCandidate.click();
  let selectedCount = 1;
  for (let index = 0; index < (await candidates.count()); index += 1) {
    const candidate = candidates.nth(index);
    if (
      selectedCount < teamSize &&
      (await candidate.getAttribute("aria-pressed")) !== "true"
    ) {
      await candidate.click();
      selectedCount += 1;
    }
  }
  expect(selectedCount).toBe(teamSize);
  await leaderPage.getByRole("button", { name: "提交队伍" }).click();
  await expect
    .poll(async () => (await avalonPublicProgress(displayPage, roomId)).phase)
    .toBe("team-vote");

  for (const [index, playerPage] of playerPages.entries()) {
    await playerPage.getByRole("button", { name: "同意" }).click();
    if (index < playerPages.length - 1) {
      await expect
        .poll(
          async () =>
            (
              await avalonPublicProgress(displayPage, roomId)
            ).voteSubmittedAccountIds.length
        )
        .toBe(index + 1);
    }
  }
  await expect
    .poll(async () => (await avalonPublicProgress(displayPage, roomId)).phase)
    .toBe("mission");

  await expect
    .poll(async () => {
      let count = 0;
      for (const playerPage of playerPages) {
        if (
          await playerPage
            .getByRole("button", { name: "任务成功" })
            .isVisible()
        ) {
          count += 1;
        }
      }
      return count;
    })
    .toBe(teamSize);
  const missionPages: Page[] = [];
  let evilMissionPage: Page | undefined;
  for (const playerPage of playerPages) {
    if (
      await playerPage
        .getByRole("button", { name: "任务成功" })
        .isVisible()
    ) {
      missionPages.push(playerPage);
      if (
        await playerPage
          .locator(".avalon-member.is-self")
          .filter({ hasText: evilPlayerName })
          .isVisible()
      ) {
        evilMissionPage = playerPage;
      }
    }
  }
  expect(evilMissionPage).toBeTruthy();
  await expect(
    evilMissionPage!.getByRole("button", { name: "任务失败" })
  ).toBeEnabled();
  for (const [index, missionPage] of missionPages.entries()) {
    await missionPage
      .getByRole("button", {
        name: missionPage === evilMissionPage ? "任务失败" : "任务成功"
      })
      .click();
    if (index < missionPages.length - 1) {
      await expect
        .poll(
          async () =>
            (
              await avalonPublicProgress(displayPage, roomId)
            ).missionSubmittedAccountIds.length
        )
        .toBe(index + 1);
    }
  }
  await expect
    .poll(
      async () =>
        (await avalonPublicProgress(displayPage, roomId)).missionHistory.length
    )
    .toBe(1);
  const failedMission = displayPage.locator(
    ".avalon-mission-track .mission-fail"
  );
  await expect(failedMission).toHaveCount(1);
  await expect(failedMission.locator(".avalon-mission-rule")).toHaveCount(0);
  await expect(failedMission).not.toContainText("任务失败");
  await expect(
    failedMission.getByLabel(`成功 ${teamSize - 1}`)
  ).toBeVisible();
  await expect(failedMission.getByLabel("失败 1")).toBeVisible();
  const failedColors = await missionCardColors(failedMission, "--color-danger", "--color-danger-text");
  expect(failedColors.background).toBe(failedColors.expectedBackground);
  expect(failedColors.text).toBe(failedColors.expectedText);
  expect(failedColors.numberFontSize).toBeGreaterThanOrEqual(18);
  await expect(displayPage.locator(".avalon-mission-rule")).toHaveCount(4);
}

async function completeSuccessfulAvalonMission(
  playerPages: Page[],
  displayPage: Page,
  roomId: string,
  completedMissionCount: number
): Promise<void> {
  await expect
    .poll(async () => await avalonLeaderPageIndex(playerPages))
    .toBeGreaterThanOrEqual(0);
  const leaderPage = playerPages[
    await avalonLeaderPageIndex(playerPages)
  ]!;
  leaderPage.setDefaultTimeout(10_000);
  const heading = leaderPage.getByRole("heading", {
    name: /选择任务队伍/
  });
  const headingText = await heading.textContent();
  const teamSize = Number(headingText?.match(/\/(\d+)/)?.[1]);
  expect(teamSize).toBeGreaterThan(0);
  const proposal = leaderPage.locator(".avalon-control-card").filter({
    has: heading
  });
  const candidates = leaderPage.locator(".avalon-member-select");
  await expect(candidates).toHaveCount(playerPages.length);
  for (let index = 0; index < teamSize; index += 1) {
    await candidates.nth(index).click();
    await expect(candidates.nth(index)).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  }
  await proposal.getByRole("button", { name: "提交队伍" }).click();
  await expect
    .poll(
      async () => (await avalonPublicProgress(displayPage, roomId)).phase
    )
    .toBe("team-vote");
  for (const [index, playerPage] of playerPages.entries()) {
    await playerPage.getByRole("button", { name: "同意" }).click();
    if (index < playerPages.length - 1) {
      await expect
        .poll(
          async () =>
            (
              await avalonPublicProgress(displayPage, roomId)
            ).voteSubmittedAccountIds.length
        )
        .toBe(index + 1);
      await expect(playerPages[index + 1]!.locator(".avalon-public-state"))
        .toContainText(`${index + 1}/`);
    } else {
      await expect
        .poll(
          async () =>
            (await avalonPublicProgress(displayPage, roomId)).phase
        )
        .toBe("mission");
    }
  }

  await expect
    .poll(async () => {
      let count = 0;
      for (const playerPage of playerPages) {
        if (
          await playerPage
            .getByRole("button", { name: "任务成功" })
            .isVisible()
        ) {
          count += 1;
        }
      }
      return count;
    })
    .toBe(teamSize);
  const missionPages: Page[] = [];
  for (const playerPage of playerPages) {
    if (
      await playerPage
        .getByRole("button", { name: "任务成功" })
        .isVisible()
    ) {
      missionPages.push(playerPage);
    }
  }
  await missionPages[0]!
    .getByRole("button", { name: "任务成功" })
    .click();
  await expect
    .poll(
      async () =>
        (
          await avalonPublicProgress(displayPage, roomId)
        ).missionSubmittedAccountIds.length
    )
    .toBe(1);
  await expect(missionPages[1]!.locator(".avalon-public-state"))
    .toContainText("1/");
  const partial = await avalonPublicProgress(displayPage, roomId);
  expect(partial.missionSubmittedAccountIds).toHaveLength(1);
  expect(partial.missionHistory).toHaveLength(completedMissionCount);
  expect(JSON.stringify(partial)).not.toContain("missionChoices");
  for (const [offset, missionPage] of missionPages.slice(1).entries()) {
    await missionPage
      .getByRole("button", { name: "任务成功" })
      .click();
    const submittedCount = offset + 2;
    if (submittedCount < missionPages.length) {
      await expect
        .poll(
          async () =>
            (
              await avalonPublicProgress(displayPage, roomId)
            ).missionSubmittedAccountIds.length
        )
        .toBe(submittedCount);
      await expect(missionPages[offset + 2]!.locator(".avalon-public-state"))
        .toContainText(`${submittedCount}/`);
    } else {
      await expect
        .poll(
          async () =>
            (
              await avalonPublicProgress(displayPage, roomId)
            ).missionHistory.length
        )
        .toBe(completedMissionCount + 1);
    }
  }
  await expect(displayPage.locator(".avalon-mission-track .mission-success"))
    .toHaveCount(completedMissionCount + 1);
  const successfulMission = displayPage
    .locator(".avalon-mission-track .mission-success")
    .nth(completedMissionCount);
  await expect(successfulMission.locator(".avalon-mission-rule")).toHaveCount(0);
  await expect(successfulMission).not.toContainText("任务成功");
  await expect(
    successfulMission.getByLabel(`成功 ${teamSize}`)
  ).toBeVisible();
  await expect(successfulMission.getByLabel("失败 0")).toBeVisible();
  const successfulColors = await missionCardColors(
    successfulMission,
    "--color-success",
    "--color-accent-text"
  );
  expect(successfulColors.background).toBe(
    successfulColors.expectedBackground
  );
  expect(successfulColors.text).toBe(successfulColors.expectedText);
  expect(successfulColors.numberFontSize).toBeGreaterThanOrEqual(18);
  await expect(displayPage.locator(".avalon-mission-rule")).toHaveCount(
    4 - completedMissionCount
  );
}

async function avalonAssassinPageIndex(pages: Page[]): Promise<number> {
  for (const [index, page] of pages.entries()) {
    if (
      await page
        .getByRole("button", { name: "确认刺杀" })
        .isVisible()
    ) {
      return index;
    }
  }
  return -1;
}

function uniqueSuffix(projectName: string): string {
  const project = projectName.startsWith("chromium") ? "ch" : "wk";
  return `${project}-${Date.now().toString(36).slice(-6)}`;
}

async function missionCardColors(
  card: Locator,
  backgroundVariable: string,
  textVariable: string
): Promise<{
  background: string;
  expectedBackground: string;
  text: string;
  expectedText: string;
  numberFontSize: number;
}> {
  return card.evaluate(
    (element, variables) => {
      const resolveColor = (variable: string) => {
        const probe = document.createElement("span");
        probe.style.color = `var(${variable})`;
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        expectedBackground: resolveColor(variables.background),
        text: style.color,
        expectedText: resolveColor(variables.text),
        numberFontSize: Number.parseFloat(
          getComputedStyle(
            element.querySelector<HTMLElement>(
              ".avalon-mission-result strong"
            )!
          ).fontSize
        )
      };
    },
    { background: backgroundVariable, text: textVariable }
  );
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
