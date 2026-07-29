# 平台易用性与数据管理增强：change-1 执行状态

- 运行编号：`change-1`
- 运行类型：`需求变更`
- 目标记录：`change-1.md`
- 运行状态：`completed`
- 交付与验证策略：`strict`
- 验证结论：`passed`
- 当前变更计划修订：`1`
- 变更前有效需求指纹：`sha256:de95d91d6ecc362dc054d1b860909f5e7e4ffe4a7d468945c9201dd27848874c`
- 完成后有效需求指纹：`sha256:3c59115c4a3f8f0276cbd0a7eb01324510de6c0b5c7a720c4abfe349730fb272`
- 变更计划指纹：`sha256:352ad857a7e6c1f2e52e0cf64258183e774f8d508ede10cdb0d514371841d8c0`
- 当前阶段：`P-001（completed）`
- 当前阶段计划：[phase-001-plan.md](phase-001-plan.md)，修订 `1`，指纹 `sha256:00ae416f5ba316f0a621cb3d7bd857afaa2d89cb0f364a4735e149be08df66d4`
- 当前阶段结果：[phase-001-result.md](phase-001-result.md)，`completed/passed`，指纹 `sha256:1e755dfddbda510779ad5bb60d22f6d455202e7896da853a7fa70b6df943f5b6`
- 完成记录：[../../change-1.md](../../change-1.md)，指纹 `sha256:4b8799696dad040d85729cd1d14b051dbf7cb18be6ce948a3d92d758b56bac09`
- 当前任务：`无`
- 项目基线：`main@6361b5844e46acf562d58859b13ae5d11952db9f`
- 最后更新时间：`2026-07-29`

## 1. 运行目标或待生效变更

- RC-1-001：修复 complete 结算中退出者仍存在于其他玩家和公共大屏当前结算列表的
  投影缺陷；持久化手牌历史继续完整保留。
- RC-1-002：修复牌桌/结算页刷新或会话恢复后未初始化扑克主题色板、导致内容不可读的
  缺陷；游戏内仍不显示主题切换入口。
- AC-C1-001、AC-C1-002 均为 core；strict 下全部阻塞。

## 2. 阶段状态

| 阶段/任务 | 状态 | 验证结论 | 说明 |
| --- | --- | --- | --- |
| P-001 | completed | passed | 唯一阶段结果已冻结，全部 strict 门禁通过 |
| P-001-T-001 | completed | passed | 领域和生产 E2E 红灯均与用户报告根因一致 |
| P-001-T-002 | completed | passed | 最小生产修复和全部计划门禁通过 |

不存在其他 active change 或可执行阶段；本状态现已冻结。

## 3. 当前检查点

- schema `3.2`；`change-1.md` 已连续冻结；下一可用编号为 `change-2`。
- initial 为 `completed/passed`，无开放 `FND-I-*`。
- 规划前工作区干净；基线 `HEAD` 与 `origin/main` 均为
  `6361b5844e46acf562d58859b13ae5d11952db9f`。
- 已确认根因：
  1. `leaveRoom()` 移除座位并记录 `departedAccountIds`，但 `projectRoom()` 仍完整复制
     `lastResult`；
  2. `applyProductTheme()` 只由游戏内不存在的 `ThemeToggle` effect 调用，刷新恢复到
     牌桌时语义 CSS 变量为空。
- T-001 实际文件：`tests/platform.test.ts`、`tests/e2e/core.spec.ts`。
- T-001 结果：领域目标测试在退出后的 `lastResult.participantAccountIds` 仍收到 Alice
  和 Bob 时失败；生产 E2E 在结算页刷新后 `html[data-theme]` 缺失时失败。两项都在
  未修改生产代码的基线上稳定复现用户报告。
- E2E 后续 WebKit 赛季断言失败是 Chromium 预期红灯中断后测试房间未关闭、
  `ROOMS_MUST_CLOSE` 使新赛季未创建的级联夹具结果；修复后完整 E2E 必须消失，否则
  strict 门禁继续阻塞。
- 当前任务文件范围：`packages/domain/src/index.ts`、`apps/web/src/ui.tsx`、
  `apps/web/src/main.tsx`，以及必要的最小测试校正。
- 当前任务完成条件：两个目标断言转绿，完整计划门禁通过，底层手牌历史、主题入口
  所有权、资产/私牌/构建均无回归。
- T-002 实际结果：`projectRoom()` 仅在当前房间投影中过滤
  `departedAccountIds` 对应的结算身份；`handResults` 原记录不变。应用使用
  `useLayoutEffect` 在 main/poker scope 变化时按已存主题调用现有
  `applyProductTheme()`；游戏内仍无主题控件。
- T-002 实际文件：`packages/domain/src/index.ts`、`apps/web/src/ui.tsx`、
  `apps/web/src/main.tsx`。
- T-002 完成证据：目标领域 1/1、platform 26/26、realtime 4/4、
  Chromium/WebKit 6/6、lint、typecheck、生产 build/静态资源和
  `git diff --check` 全部通过。

## 4. 已完成任务

### P-001-T-001

- 实际结果：新增两个 strict red-first 回归场景并观察到预期失败。
- 领域红灯：
  `.\\node_modules\\.bin\\vitest.cmd run tests\\platform.test.ts -t "filters departed players from live settlement projections without rewriting history"`
  退出码 1；期望只有保留玩家，实际仍包含已退出玩家。
- 浏览器红灯：`npm run test:e2e:core` 退出码 1；Chromium 在结算页刷新后
  `data-theme` 期望 `dark`、实际缺失。WebKit 的后续失败是预期中断留下开放房间后的
  级联夹具结果。
- 生产文件在红灯采集前保持无差异。

### P-001-T-002

- 实际结果：完成当前结算投影过滤和应用级主题初始化；未修改持久化历史、扑克规则、
  命令、资产或主题令牌。
- 实际文件：`packages/domain/src/index.ts`、`apps/web/src/ui.tsx`、
  `apps/web/src/main.tsx`。
- 目标领域断言从预期失败转为 1/1 通过；完整 E2E 在 Chromium/WebKit 6/6 通过，
  包含结算刷新主题变量与计算样式、玩家/display 退出列表和重进场景。
- 计划硬门禁全部通过，当前进入 P-001 结果与 change-1 收口。

## 5. 运行累计文件变化

| 文件 | 模式 | 目的 |
| --- | --- | --- |
| `execution/change-1/change-plan.md` | add | 保存待生效 RC-1-001–RC-1-002、strict 策略和单阶段路线图 |
| `execution/change-1/phase-001-plan.md` | add | 保存 P-001 两个有序任务和阻塞门禁 |
| `execution/change-1/execution-state.md` | add | 保存本可恢复执行状态 |
| `tests/platform.test.ts` | modify | red-first 覆盖退出后实时结算投影、历史保留和同账户重进 |
| `tests/e2e/core.spec.ts` | modify | red-first 覆盖结算刷新主题以及玩家/display 的退出列表同步 |
| `packages/domain/src/index.ts` | modify | 仅在当前房间投影中过滤已离开的旧结算身份 |
| `apps/web/src/ui.tsx` | modify | 导出同一已存主题读取函数供应用生命周期复用 |
| `apps/web/src/main.tsx` | modify | 在布局阶段为当前 main/poker scope 初始化语义色板 |
| `execution/change-1/phase-001-result.md` | add | 冻结 P-001 实现、验证和无 finding 结论 |
| `AGENTS.md` | modify | 同步 change-1 完成、门禁和未部署状态 |
| `change-1.md` | add | 保存 RC-1-001–RC-1-002 的连续修改记录 |
| `effective-requirements.md` | modify | 应用 change-1 并推进当前产品权威快照 |

没有冻结历史、生成物或部署文件变化。

## 6. 测试与验证证据

| 日期 | 验证 | 观察结果 | 状态 |
| --- | --- | --- | --- |
| 2026-07-29 | 规划前 `git status --short` | 工作区干净 | passed |
| 2026-07-29 | 历史连续性与指纹 | 仅 `change-0.md`；无 change 预留；effective 与 change-0 指纹已记录 | passed |
| 2026-07-29 | 领域目标 red-first | 1 failed / 14 skipped；退出者仍在实时 `lastResult` | expected_failed |
| 2026-07-29 | `npm run test:e2e:core` red-first | build/静态资源通过；Chromium 在结算刷新后缺失 `data-theme`，随后产生可解释的清理级联 | expected_failed |
| 2026-07-29 | 领域目标修复后 | 1 passed / 14 skipped；实时投影过滤、历史保留和重进成立 | passed |
| 2026-07-29 | `npm run test:e2e:core` 修复后 | build/静态资源通过；Chromium/WebKit 6/6 | passed |
| 2026-07-29 | `npm run lint` | ESLint 无错误 | passed |
| 2026-07-29 | `npm run typecheck` | TypeScript 无错误 | passed |
| 2026-07-29 | `npm run test:platform` | 2 files，26/26 | passed |
| 2026-07-29 | `npm run test:realtime` | 1 file，4/4 | passed |
| 2026-07-29 | `git diff --check` | 无空白错误 | passed |

## 7. 决策、待确认问题与回答

| ID | 阶段/任务 | 问题 | 已确认事实 | 可选方案与影响 | 需要确认 | 状态 | 用户回答及来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q-C1-001 | 规划 | change-1 交付策略 | schema 3.2 要求每次 change 显式选择 | strict：红灯优先且所有异常阻塞；relaxed：可实现优先 | 选择策略 | resolved | 用户于 2026-07-29 明确回复 `strict` |

当前无 unresolved 问题。

## 8. 发现项、偏差、风险与阻塞

- 当前无 `FND-C1-*`；下一编号为 `FND-C1-001`。
- 当前无计划偏差、阻塞、用户改动重叠或远端状态变化。
- 两个用户报告均为 core 交付缺陷，不允许降级为 report-only finding。

## 9. 精确恢复步骤

本运行已完成且不可恢复为可执行状态：

1. 不得修改 `change-plan.md`、`phase-001-plan.md`、`phase-001-result.md`、本状态或
   `change-1.md` 承载新产品变化。
2. 当前权威产品行为以 [../../effective-requirements.md](../../effective-requirements.md)
   为准，已应用至 `change-1.md`。
3. 后续变化必须创建连续 `execution/change-2/` 和 `change-2.md`；不得复用本运行。
4. 本运行没有部署正式服务。若需上线，必须另行明确授权并从干净已提交 HEAD 使用受
   支持部署入口。

## 10. 最终完成门禁

| 门禁 | 当前状态 |
| --- | --- |
| T-001 两个缺陷的 red-first 证据 | passed |
| T-002 最小生产修复 | passed |
| AC-C1-001–AC-C1-002 core | passed |
| lint/typecheck/platform/realtime/E2E/build/diff | passed |
| 无开放 finding、未决问题或无关差异 | passed |
| P-001 阶段结果 | passed |
| change-1 记录和 effective 快照一致 | passed |

全部门禁已通过；验证结论为 `passed`，运行状态为 `completed`。
