# 家庭聚会游戏平台：修改记录 2

- 修改编号：`2`
- 修改类型：`需求变更`
- 原始需求：[requirements.md](requirements.md)
- 初始路线图：[implementation-plan.md](implementation-plan.md)
- 前一有效状态：[change-1.md](change-1.md)
- 变更计划：[execution/change-2/change-plan.md](execution/change-2/change-plan.md)
- 阶段计划：[execution/change-2/phase-001-plan.md](execution/change-2/phase-001-plan.md)
- 阶段结果：[execution/change-2/phase-001-result.md](execution/change-2/phase-001-result.md)
- 完成执行状态：[execution/change-2/execution-state.md](execution/change-2/execution-state.md)
- 开始基线：Git `f671f71c24a9f12473e58da13c01cc9e2002d8b7`
- 完成日期：`2026-07-27`

## 1. 原始需求变更项目

| 变更项 | 变更类型 | 关联原始需求或历史变更 | 变更前 | 变更后 | 验收影响 |
| --- | --- | --- | --- | --- | --- |
| RC-2-001 | modify | FR-025–FR-029、FR-055–FR-057、RC-1-005、AC-C1-005 | 结算玩家行只显示本手筹码增减，结果没有结算后总筹码 | 玩家端和大屏同时显示签名增减与总筹码；新结果保存结算后总量，当前座位补码后即时更新 | AC-C2-001 core |
| RC-2-002 | modify | FR-030–FR-034、RC-1-005、AC-020、AC-C1-005 | 补码 modal 受操作区堆叠上下文限制，被结算面板覆盖 | complete 阶段的补码 modal 位于结算面板之上，可输入、确认或取消 | AC-C2-002 core |

## 2. 实现概述

change-2 完善了结算筹码信息，并修复了结算阶段无法操作补码弹窗的问题。

新结算摘要会保存每名玩家结算后的 `endingChips`。玩家端和公共大屏的结算行在筹码增减之外显示“总筹码”；仍占座玩家使用实时 `tableChips`，所以补码后立即更新，离座玩家则回退到结算快照。可选字段保持旧 change-1 结果兼容。

补码 modal 从 `.action-dock` 的较低堆叠上下文移到牌桌根级，保留原有权威 `room.top-up` 命令、限额、余额和 complete 阶段校验。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/contracts/src/index.ts`、`packages/domain/src/index.ts` | modify | 扩展兼容性结算总筹码契约并保存新结果快照 |
| `apps/server/src/app.ts` | modify | 将每名玩家的结算后 stack 写入结果 |
| `apps/web/src/main.tsx`、`apps/web/src/styles.css`、`apps/web/src/locales.ts` | modify | 显示总筹码、增加双语文本并修复补码 modal 层级 |
| `tests/server.test.ts` | modify | 验证总筹码持久化、投影和守恒 |
| `tests/e2e/core.spec.ts` | modify | 验证玩家端/大屏总量和结算面板上的真实补码交互 |
| `execution/change-2/change-plan.md`、`execution/change-2/phase-001-plan.md`、`execution/change-2/phase-001-result.md`、`execution/change-2/execution-state.md` | add | 保存 change-2 计划、执行状态和不可变阶段结果 |
| `change-2.md` | add | 保存当前需求变更记录 |
| `effective-requirements.md` | modify | 应用 RC-2-001–RC-2-002 至当前权威需求 |

## 4. 需求、阶段与任务完成情况

- RC-2-001–RC-2-002 全部生效；AC-C2-001–AC-C2-002 全部通过且均为 `core`。
- change-2 采用 `single` + `compact`，唯一阶段 P-001 已完成。
- P-001-T-001 已完成结算总量契约、持久化、玩家端/大屏显示、补码 modal 层级及回归。
- 完整证据以 [phase-001-result.md](execution/change-2/phase-001-result.md) 为准；当前权威行为以 [effective-requirements.md](effective-requirements.md) 为准。

## 5. 测试与验证

- 交付与验证策略：`relaxed`。
- 验证结论：`passed`。
- `npm run typecheck` 通过。
- `npm run test:platform` 通过：platform/server 15/15。
- `npm run test:e2e:core` 通过：生产构建、静态资源检查、Chromium 桌面与 WebKit 手机 4/4。
- 两种浏览器均在结算面板存在时完成打开补码 modal、输入 `100`、确认提交并观察总筹码增加。
- `git diff --check` 通过。
- 按用户既有要求未运行 Docker 或部署测试；本变更不修改部署配置。

## 6. 与路线图及阶段计划的偏差

没有范围、阶段、实现或验证偏差。旧结果兼容、实时总量优先级和 modal 根级挂载均按计划实现。

## 7. 遗留事项

无开放 `FND-C2-*`、未决产品问题或阻塞项；下一个可用发现编号为 `FND-C2-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | 后续需求通过新的 `change-N` 运行处理 |
