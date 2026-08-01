# P-001 阶段结果：Poker 玩家卡连续几何

- 运行编号：`change-3`
- 阶段编号：`P-001`
- 阶段计划修订：`1`
- 阶段状态：`completed`
- 验证结论：`passed`
- 交付与验证策略：`relaxed`
- 当前有效需求指纹（变更前）：`sha256:e1ef0a78c7f8dcaf6ad88f39caeb9568ae25114716f8f26cf85c5cbcf0e3bce4`
- 变更计划指纹：`sha256:d3b26113eabd92a8c12b732d3e8f2a33ebe2a3586cf2c2a7f727a70d31719324`
- 阶段计划指纹：`sha256:58c2e2d1d05cab028ba08eb7af004e1cfa45819babf8c8a57d77ee9d1764d6cb`
- 项目基线：`main@ae347cc6982e3de2de872b6c0629c2b830ef7a0b`
- 完成日期：`2026-08-01`

## 1. 阶段结论

P-001-T-001、RC-3-001～RC-3-002 和 AC-C3-001～AC-C3-003 全部完成。Poker 上方玩家卡不再在桌面 grid、三列 grid 和手机 flex 之间切换；所有宽度共用一条左对齐 flex/scroll 轨道。可见顶部距、首卡左距和相邻卡 gap 由同一 `.6rem` 变量控制并在浏览器像素容差内相等，旧 760/600/520px 断点两侧没有布局或间距跳变。

卡宽使用 `clamp(6.8rem, 16vw, 9.25rem)` 连续增长；桌面上限约为手机下限的 1.36 倍，低于两倍约束，间距不随桌面放大。轨道保留独立 1rem 顶部和 2.5rem 底部裁剪安全区，负向顶部坐标抵消可见 padding；层级、阴影、庄家标识和真实 Tab 焦点在 Chromium/WebKit 中完整，页面无横向溢出。

`relaxed` 未使用 report-only 例外；无 blocking、report-only finding、未知影响或未完成验收。没有修改服务、规则、投影、资产、SQLite、依赖、Docker、部署接口或外部状态，也没有执行提交、推送或正式部署。

## 2. 实现与文件结果

| 文件 | 结果 | 说明 |
| --- | --- | --- |
| `apps/web/src/styles.css` | modified | 将 Poker 玩家轨道从共享 desktop grid 中分离，删除 760/520/600px 的 `.table-seats` 几何覆盖；新增统一 flex/scroll、固定间距、连续卡宽与独立安全 padding/层级。 |
| `tests/e2e/core.spec.ts` | modified | 将单一 300px 断言扩展到 1280、900、761/760、601/600、521/520 和 300px；验证 top/left/gap、布局模式、卡宽比例与连续性、阴影/庄家/焦点、层级和 document width。 |
| `execution/change-3/change-plan.md` | added | RC、core 验收、单阶段 compact 路线图和 relaxed 门禁。 |
| `execution/change-3/phase-001-plan.md` | added | P-001 rev 1 任务、边界、恢复与验证计划。 |
| `execution/change-3/execution-state.md` | added/in progress | 产品编辑前 durable 检查点；收口时更新为 completed。 |

## 3. 验收证据

| 验收 | 结果 | 证据 |
| --- | --- | --- |
| AC-C3-001 | passed | 两个浏览器在九个视口中均计算为 `display:flex` / `overflow-x:auto`；每个视口的 top/left/gap 互差不超过 1px，全部视口的三类间距总跨度不超过 1px；document width 不超过 viewport。 |
| AC-C3-002 | passed | 761/760、601/600、521/520 各对的卡宽和三类间距变化均不超过 1px；1280px 卡宽大于 300px 且不超过其两倍；卡片同排、同宽，track z-index 高于 board，shadow 非 none，dealer 与真实焦点边界位于 track/felt 内。 |
| AC-C3-003 | passed | lint、typecheck、realtime 5/5、生产 build/static、Chromium/WebKit 核心 E2E 8/8 和 `git diff --check` 通过；完整 Poker/Avalon/display 流程没有回归。 |

## 4. 验证记录

| 日期 | 命令或检查 | 结果 |
| --- | --- | --- |
| 2026-08-01 | `git status --short --branch`、`git rev-parse HEAD`、schema/history/fingerprint 审计 | passed；规划前 clean，HEAD `ae347cc…`，change-0～2 连续且 completed，change-3 可保留。 |
| 2026-08-01 | `npm run lint` | passed；最终产品/测试源码 ESLint 通过。 |
| 2026-08-01 | `npm run typecheck` | passed；严格 TypeScript 检查通过。 |
| 2026-08-01 | `npm run test:realtime` | passed；1 file / 5 tests，最终产品源码复跑。 |
| 2026-08-01 | `npm run test:e2e:core` | 最终候选 passed；生产 build/static、Chromium desktop 与 WebKit mobile 共 8/8。 |
| 2026-08-01 | E2E 跨视口真实几何 | passed；1280、900、761/760、601/600、521/520、300px 的固定间距、连续卡宽、安全区、层级和无横溢断言在双浏览器成立。 |
| 2026-08-01 | `git diff --check` | passed；无空白错误。 |

E2E 在清理遗留断点前先完整通过一次；移除旧 grid/flex 覆盖并整理断言后，对最终源码再次完整 8/8。npm 对用户级日志目录的 `EPERM` 清理警告不影响任何命令退出码、仓库文件或验证结果，不构成产品 finding。

## 5. 偏差、发现项与剩余边界

- 无计划偏差；文件范围、验证层级与 P-001 rev 1 一致。
- 无开放 finding；下一可用 ID 保持 `FND-C3-001`。
- `test:platform`、`test:poker`、`test:avalon`、`test:capacity`、`test:deploy` 和 Docker smoke 未重复运行：最终差异只涉及 Web CSS/E2E/工作流文档，没有触及领域、引擎、容量、部署或容器接口；生产双浏览器流程已覆盖完整核心游戏行为。
- 提交、推送和正式服务器发布没有本轮授权，必须在 change-3 冻结后由独立明确请求触发。
