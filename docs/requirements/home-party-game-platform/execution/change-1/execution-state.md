# change-1 执行状态

- 运行编号：`change-1`
- 运行类型：`需求变更`
- 目标记录：`../../change-1.md`
- 运行状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 当前路线图修订：`2`
- 需求指纹：`sha256:13102c269ca01101b3e21671663cb1619ecd33d5d3c746a8451120721dda2f16`
- 完成有效需求指纹：`sha256:94c1264bf5a29775c952edd7fcbf3f5e4ed3a8b137f173ca3adb9a4d4ef0fc20`
- 变更计划指纹：`sha256:4171f79514a18806cbcc35caf36805fec201be493da9d117ce8a692d273707ed`
- 当前阶段：`none`
- 当前任务：`none`
- 项目基线：Git `6bc0daaa726ebb5ee6a142e36202d2ae583f1383`
- 最后更新时间：`2026-07-27`

## 1. 运行目标或待生效变更

RC-1-001–RC-1-005 已实施并应用至 [change-1.md](../../change-1.md) 与 [effective-requirements.md](../../effective-requirements.md)：移动端牌桌、顶栏信息层级、全局花色预设、连续倒计时，以及持久结算面板与全员准备门槛均已生效。

## 2. 阶段状态

| 阶段 | 状态 | 计划 | 结果 |
| --- | --- | --- | --- |
| P-001 | completed | [phase-001-plan.md](phase-001-plan.md) | [phase-001-result.md](phase-001-result.md) |

## 3. 当前检查点

- change-1 是 change-0 后唯一连续且已完成的变更运行。
- P-001-T-001 与 P-001-T-002 均已完成。
- AC-C1-001–AC-C1-005 与 G-C1-001 全部通过。
- 阶段结果、change-1 修改记录和当前有效需求已生成并相互链接。
- 没有未决问题、开放 finding、计划偏差、阻塞或只能依赖部署环境确认的本变更 core 项。

## 4. 已完成任务

| 任务 | 状态 | 实际结果 |
| --- | --- | --- |
| P-001-T-001 | completed | 扩展设置/牌局/结果投影契约，兼容旧快照；结算保存签名净变化和受控摊牌摘要；complete 不再自动推进；新增全员准备命令并由断线/零筹码阻塞 |
| P-001-T-002 | completed | 完成 300px 响应式牌桌、顶栏重排、双预设彩色牌面、连续倒计时、玩家/大屏结算面板与准备/补码入口，并通过全部本地集成门禁 |

## 5. 运行累计文件变化

| 文件 | 模式 | 状态 |
| --- | --- | --- |
| `execution/change-1/change-plan.md` | add | 已创建 |
| `execution/change-1/phase-001-plan.md` | add | 已创建 |
| `execution/change-1/execution-state.md` | add | 当前文件 |
| `execution/change-1/phase-001-result.md` | add | P-001 不可变结果与验证证据 |
| `change-1.md` | add | 已完成需求变更记录 |
| `effective-requirements.md` | modify | 已应用 change-1 的当前权威需求 |
| `packages/contracts/src/index.ts` | modify | 花色预设、准备集合、结算摘要及投影契约 |
| `packages/domain/src/index.ts` | modify | 旧快照归一化、准备恢复、设置校验和结果投影 |
| `packages/poker/src/index.ts` | modify | 初始化准备集合并提供牌型分类 |
| `apps/server/src/app.ts` | modify | 结算细节、准备状态机及移除自动下一手 |
| `apps/web/src/main.tsx` | modify | 响应式顶栏、彩色牌面、连续倒计时和共用结算面板 |
| `apps/web/src/styles.css` | modify | 窄屏布局、花色主题、合成动画和悬浮结算样式 |
| `apps/web/src/locales.ts` | modify | 双语花色、当前玩家、结算、准备和牌型文本 |
| `tests/platform.test.ts` | modify | 旧设置/complete 截止/准备恢复兼容验证 |
| `tests/server.test.ts` | modify | 全员准备、净变化与摊牌公开验证 |
| `tests/poker.test.ts` | modify | 牌型分类验证 |
| `tests/e2e/core.spec.ts` | modify | 300px、花色、倒计时、持久结算和双人准备真实流程 |

## 6. 测试与验证证据

- `npm run verify:core`：通过；lint、typecheck、platform/server 15/15、poker 14/14、realtime 3/3、生产构建、静态资源检查和 Chromium/WebKit 4/4 全部成功。
- `npm test`：通过，5 个文件 35/35，包含容量 3/3。
- 300×760 实际浏览器验收：通过；页面 `scrollWidth=285`、`innerWidth=300`，顶栏、下注区和结算面板完整可操作。
- `git diff --check`：通过。
- Docker/部署验证：按用户明确要求未运行；本次未修改部署配置，且没有剩余部署专属 core 验收项。
- 第一次平台定向运行曾有 1 个旧 `poker.next-hand` 测试按预期失败；更新为准备协议后重跑通过，无产品缺陷 finding。

## 7. 决策、待确认问题与回答

| ID | 阶段/任务 | 问题 | 已确认事实 | 可选方案与影响 | 需要确认 | 状态 | 用户回答及来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q-001 | 规划 | 本运行交付策略 | schema 3.2 每次变更必须独立选择 | strict 或 relaxed | 选择策略 | resolved | 用户回复 `relaxed` |
| Q-002 | 规划 | 摊牌手牌公开范围 | 当前公共大屏不接收任何手牌 | 仅实际摊牌者 / 含弃牌者 / 不在大屏公开 | 公开范围 | resolved | 用户回复 `1.A`：仅未弃牌实际摊牌者，玩家端和大屏显示 |
| Q-003 | 规划 | 全员准备的参与者与断线规则 | complete 阶段允许补码、退出、移除 | 所有占座 / 仅在线有筹码 | 阻塞规则 | resolved | 用户回复 `2.A`：所有占座者；断线和零筹码阻塞 |
| Q-004 | P-001 | 验证与部署边界 | 本地可运行静态、单元、服务、实时、浏览器与构建验证 | 本地优先 / 提前依赖部署 | 验证顺序与 Docker 权限 | resolved | 用户明确要求本地优先，不运行 Docker；必要部署验证时暂停并交接 |

无未决问题。

## 8. 发现项、偏差、风险与阻塞

无开放 `FND-C1-*`、计划偏差或阻塞。下一个发现编号为 `FND-C1-001`。

## 9. 精确恢复步骤

本运行已冻结完成，不应继续修改其计划或阶段结果。后续需求必须从 [effective-requirements.md](../../effective-requirements.md) 建立新的 `change-N` 运行；部署时沿用既有 `/data` 命名卷、健康检查和回退流程。

## 10. 最终完成门禁

- P-001 两个任务及阶段集成门禁已完成。
- AC-C1-001–AC-C1-005 已全部通过。
- 无未决问题、阻塞、开放 finding 或未解释文件。
- `phase-001-result.md`、`change-1.md` 与更新后的 `effective-requirements.md` 已生成；本状态现冻结为 `completed`。
