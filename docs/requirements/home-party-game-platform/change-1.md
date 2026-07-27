# 家庭聚会游戏平台：修改记录 1

- 修改编号：`1`
- 修改类型：`需求变更`
- 原始需求：[requirements.md](requirements.md)
- 初始路线图：[implementation-plan.md](implementation-plan.md)
- 前一有效状态：[change-0.md](change-0.md)
- 变更计划：[execution/change-1/change-plan.md](execution/change-1/change-plan.md)
- 阶段计划：[execution/change-1/phase-001-plan.md](execution/change-1/phase-001-plan.md)
- 阶段结果：[execution/change-1/phase-001-result.md](execution/change-1/phase-001-result.md)
- 完成执行状态：[execution/change-1/execution-state.md](execution/change-1/execution-state.md)
- 开始基线：Git `6bc0daaa726ebb5ee6a142e36202d2ae583f1383`
- 完成日期：`2026-07-27`

## 1. 原始需求变更项目

| 变更项 | 变更类型 | 关联原始需求或历史变更 | 变更前 | 变更后 | 验收影响 |
| --- | --- | --- | --- | --- | --- |
| RC-1-001 | modify | NFR-001、AC-025 | 牌桌在窄屏上可能产生页面级横向溢出 | 常见手机竖屏及 300px 窄屏无页面级横向溢出，主要牌桌控件可达 | AC-C1-001 core |
| RC-1-002 | modify | FR-004、FR-050–FR-054、AC-004、AC-024 | 语言与静音分离，移动端隐藏语言，牌桌未明确当前账户 | 顶栏采用左/中/右分区，房间名与当前玩家名居中分两行，语言和静音同在最右 | AC-C1-002 core |
| RC-1-003 | add | FR-017–FR-019、NFR-008、NFR-010 | 扑克牌花色没有可配置颜色预设 | 全局扑克设置提供标准与高对比度预设，持久化后同步玩家端和大屏 | AC-C1-003 core |
| RC-1-004 | modify | FR-050–FR-054、NFR-002、NFR-012、AC-024 | 倒计时以 100ms React 状态和宽度阶梯更新 | 填充条使用连续 transform 合成动画，数字局部更新，权威截止语义不变 | AC-C1-004 core |
| RC-1-005 | modify | FR-013–FR-014、FR-029、FR-035–FR-041、FR-055–FR-057、NFR-007、NFR-009、AC-008、AC-018、AC-019、AC-026 | 完整结算后自动开始下一手，结果仅保留正派彩，大屏不显示任何手牌 | 完整结算持续显示全员净变化；真实摊牌受控公开未弃牌者手牌、赢家与牌型；所有占座玩家准备后才开始下一手 | AC-C1-005 core |

## 2. 实现概述

change-1 改进了德州扑克的手机操作、牌桌信息层级、花色辨识、倒计时流畅度和每手结算流程。

牌桌现在可在窄于 320px 的视口中使用；房间名称居中，当前玩家名位于下一行，语言和静音共同位于最右。全局设置新增标准与高对比度花色预设，并作用于玩家端和公共大屏。倒计时改为连续合成动画，避免高频重绘整桌。

完整结算后不再自动开始下一手。玩家端和大屏会持续显示悬浮结算面板，列出本手全部参与者的筹码净变化；若真实摊牌，则额外公开未弃牌摊牌玩家的手牌、赢家和赢家牌型。所有仍占座、在线且有筹码的玩家准备后，系统才原子创建下一手。

没有删除既有产品范围；完整结算后的自动下一手行为和房主手动“下一手”入口由全员准备协议替换。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/contracts/src/index.ts`、`packages/domain/src/index.ts`、`packages/poker/src/index.ts` | modify | 扩展花色、准备、结果与牌型契约并兼容旧快照 |
| `apps/server/src/app.ts` | modify | 实现权威结算摘要、摊牌隐私边界和全员准备状态机 |
| `apps/web/src/main.tsx`、`apps/web/src/styles.css`、`apps/web/src/locales.ts` | modify | 完成窄屏顶栏、彩色牌面、平滑倒计时、双语结算面板和准备入口 |
| `tests/platform.test.ts`、`tests/server.test.ts`、`tests/poker.test.ts` | modify | 覆盖持久化兼容、净变化、摊牌、牌型和准备阻塞 |
| `tests/e2e/core.spec.ts` | modify | 覆盖桌面/手机真实生产流程、300px 布局、颜色、倒计时、结算保持和双人准备 |
| `execution/change-1/**`、`change-1.md`、`effective-requirements.md` | add/modify | 保存 change-1 计划、执行、结果和当前权威需求快照 |

## 4. 需求、阶段与任务完成情况

- RC-1-001–RC-1-005 全部生效；AC-C1-001–AC-C1-005 全部通过且均为 `core`。
- 变更路线图采用 `single` + `compact`，唯一阶段 P-001 已完成。
- P-001-T-001 已完成契约、持久化、服务端投影、摊牌隐私与准备状态机。
- P-001-T-002 已完成玩家端/大屏响应式实现、倒计时、结算面板及最终本地集成。
- 完整证据以 [phase-001-result.md](execution/change-1/phase-001-result.md) 为准；当前权威行为以 [effective-requirements.md](effective-requirements.md) 为准。

## 5. 测试与验证

- 交付与验证策略：`relaxed`。
- 验证结论：`passed`。
- `npm run verify:core` 通过：lint、typecheck、platform/server 15/15、poker 14/14、realtime 3/3、生产构建与 Chromium/WebKit 4/4。
- `npm test` 通过：5 个文件、35/35，包含容量 3/3。
- 300×760 实际浏览器视觉验收通过：无页面横向溢出，顶栏、操作区和结算面板完整。
- `git diff --check` 通过。
- 按用户要求未运行 Docker 或部署测试；本变更不修改部署配置，所有本地可验证 core 项已经闭合。

## 6. 与计划及阶段计划的偏差

- 没有范围、阶段或产品行为偏差。
- 首次定向测试仍包含被替换的 `poker.next-hand` 断言；更新为全员 `poker.ready` 协议并重跑通过。
- 用户在执行中明确要求本次不运行 Docker，计划修订 2 已在实现前记录该验证边界；没有把部署验证结果误计入本记录。

## 7. 遗留事项

无开放 `FND-C1-*`、未决产品问题或阻塞项；下一个可用发现编号为 `FND-C1-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | 后续需求通过新的 `change-N` 运行处理 |
