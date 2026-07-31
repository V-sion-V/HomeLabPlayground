# 阿瓦隆游戏：change-2 移动端滚动、身份任务反馈与上下文菜单记录

- 修改编号：`2`
- 修改类型：`requirement change`
- 原始需求：[requirements.md](requirements.md)
- 初始路线图：[implementation-plan.md](implementation-plan.md)
- 变更计划：[execution/change-2/change-plan.md](execution/change-2/change-plan.md)
- 执行运行：[execution/change-2/execution-state.md](execution/change-2/execution-state.md)
- 项目基线：`main@29b157a1133eaf62b39f319db42634827bcc9ed7`
- 完成日期：`2026-07-31`
- 运行状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 原始需求变更项目

| 变更项 | 变更类型 | 关联原始需求或历史变更 | 变更前 | 变更后 | 验收影响 |
| --- | --- | --- | --- | --- | --- |
| RC-2-001 | modify | FR-050、FR-057、NFR-006、AC-021 | 手机固定壳层与页面外层可同时纵向滚动，滚动外层后下半屏可能不可达。 | 根容器和固定壳层使用动态视口与唯一纵向滚动所有者；外层不能把内部下半屏移出可达范围。 | AC-C2-001、AC-C2-008 core passed |
| RC-2-002 | modify | FR-024、FR-051、FR-053、AC-007、AC-021、AC-031 | “查看私密信息”只点亮具有覆盖的卡片；本人角色可被关系覆盖；按钮确认后仍强调，手机底部为单列。 | 按住“查看身份”时所有玩家卡统一强调，只有合法知识显示文字且本人始终显示精确角色；确认后按钮为次要样式；手机查看/操作左窄右宽同排，二选一动作纵排。 | AC-C2-002–AC-C2-003、AC-C2-008 core passed |
| RC-2-003 | modify | FR-030、FR-052、AC-011、AC-021、AC-031 | 任务结果背景浅、字号小，并重复序号、规则、结果文字和标题下总数。 | 五任务无可见序号或标题下总数；未完成项只显示人数/失败阈值，完成项只显示放大的成功/失败票数，并使用高对比绿色/红色实心结果背景。 | AC-C2-004、AC-C2-008 core passed |
| RC-2-004 | modify | FR-031、FR-051、FR-053、AC-009、AC-021、AC-031 | 提名只由候选卡和操作卡提示；本人使用操作提示色，队长及当前任务使用另一颜色。 | 提名期间“本局参赛”整卡以操作提示强调边框呼吸；队长与当前任务使用操作提示强调色，本人使用独立色，重合时队长优先。 | AC-C2-005、AC-C2-007–AC-C2-008 core passed |
| RC-2-005 | modify | FR-017、FR-018、FR-053、AC-017、AC-023、AC-025 | Avalon 常态显示转让/移除；Poker 普通左键头像打开菜单。 | 两种游戏均默认隐藏管理入口；房主从触控长按、桌面右键或键盘上下文菜单打开非本人目标的 portal 菜单，确认、在线约束和服务端授权不变。 | AC-C2-006、AC-C2-008 core passed |

## 2. 实现概述

本记录把 change-2 的五项需求增量正式应用到当前 UI：

- 用 `100dvh` 和固定壳层内部滚动区统一移动端视口所有权，避免页面外层滚动后下半屏
  不可达。
- 重做 Avalon 身份查看的文案、本人精确角色覆盖、全卡统一强调、防旁观表达和确认后
  按钮状态，同时保持 display/观战秘密隔离。
- 在手机保留左窄右宽的查看/操作双列，并把操作卡内的二选一按钮改为纵向排列。
- 简化五任务轨迹，放大关键票数并使用可读的绿色/红色实心结果；用操作提示强调色统一
  队长、当前任务和提名事件，本人使用独立辅助色。
- 增加共享上下文菜单手势，把 Avalon/Poker 房主管理迁移到长按、右键和键盘入口；portal
  定位、Escape、外部点击、焦点恢复、转让限制与移除确认保持。

实现只消费现有投影和命令，没有增加客户端权限、角色数据或业务规则。服务端、领域、资产、
持久化和部署接口未改变。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `apps/web/src/ui.tsx` | modify | 共享长按、右键和键盘上下文菜单手势。 |
| `apps/web/src/main.tsx` | modify | Poker 等候区、玩家牌桌和观战牌桌的玩家卡管理菜单触发。 |
| `apps/web/src/avalon-ui.tsx` | modify | 身份覆盖、查看按钮、任务轨迹、提名提示、语义色与 Avalon 管理菜单。 |
| `apps/web/src/styles.css` | modify | 动态视口、唯一滚动区、手机双列、高对比任务、提名动画及本人/队长颜色优先级。 |
| `docs/ui-design-guidelines.md` | modify | 固化跨触控、鼠标和键盘的上下文菜单规范。 |
| `tests/e2e/core.spec.ts` | modify | 新 UI 行为、隐私、手势、计算样式、几何、300px 与双浏览器回归。 |
| `AGENTS.md` | modify | 同步 change-2 completed 状态、验证范围和正式未发布事实。 |
| `docs/requirements/avalon-game/execution/change-2/change-plan.md` | add | RC-2-001–RC-2-005、core 验收、单阶段路线图和门禁。 |
| `docs/requirements/avalon-game/execution/change-2/phase-001-plan.md` | add | P-001 rev 1 compact 执行计划。 |
| `docs/requirements/avalon-game/execution/change-2/phase-001-result.md` | add | P-001 completed / passed 冻结结果。 |
| `docs/requirements/avalon-game/execution/change-2/execution-state.md` | add | change-2 completed durable 状态和累计证据。 |
| `docs/requirements/avalon-game/effective-requirements.md` | modify | 把五项 RC 应用到当前有效产品权威和来源链。 |
| `docs/requirements/avalon-game/change-2.md` | add | 冻结本次连续编号需求变更。 |

没有修改 initial、`change-0.md`、`change-1.md`、其他 feature 冻结历史、服务端、领域、
SQLite 表结构、Poker/Avalon 规则、部署、Docker、正式配置或生成物。

## 4. 需求、阶段与任务完成情况

| 范围 | 状态 | 结果 |
| --- | --- | --- |
| RC-2-001–RC-2-005 | completed | 全部五项 modify 增量已进入 [effective-requirements.md](effective-requirements.md)。 |
| AC-C2-001–AC-C2-008 core | passed | 唯一滚动、身份防旁观、手机操作、任务结果、提名提示、上下文菜单和兼容性全部通过。 |
| P-001-T-001 | completed | 共享手势、Poker/Avalon UI、响应式 CSS、E2E 和工作流证据完成。 |
| P-001 | completed | [phase-001-plan.md](execution/change-2/phase-001-plan.md) rev 1 与 [phase-001-result.md](execution/change-2/phase-001-result.md) 已冻结。 |
| change-2 | completed | 单阶段 compact 运行完成，编号记录与有效需求快照一致。 |

来源指纹为：

- change-2 前有效需求：`sha256:a0c971fd48ca8f8a49cfc56cc3af45f85e3eda413a6091d26ca36cc927a473d7`
- change plan rev 1：`sha256:7918c10e2956bf0e415b0abb131107f288a7efc48c2cb31790493771f1409899`
- phase plan rev 1：`sha256:06cb086746a7b560776101a8f1f5d054908faa37702c3f24e5ef2d2cf3f96343`
- phase result：`sha256:1520929e0e1f32f43ccffc96c64517afeb7c6ad21db34b1d7043d34bc4476414`
- change-2 后有效需求：`sha256:34a55b55e8e635f6d8b450d92877009c052d476d63f2e25fa8eda1d850e10778`

change 编号从 0 到 2 连续，P-001 是本运行唯一阶段；没有 corrective phase、未决问题、
部分迁移、未知 overlap 或 blocking finding。

## 5. 测试与验证

- 交付与验证策略：`relaxed`。
- 验证结论：`passed`。
- 全部 change-2 core 和计划硬门禁通过，没有使用 report-only 例外。

| 验证 | 结果 |
| --- | --- |
| `npm run lint` | passed。 |
| `npm run typecheck` | passed。 |
| `npm run test:realtime` | passed，1 file / 5 tests。 |
| `npm run test:e2e:core` | passed；生产 build/static、Chromium desktop 与 WebKit mobile 共 8/8。 |
| E2E 内置生产构建/静态资源检查 | passed；Web 47 modules、server ESM bundle，2 个 HTML/CSS 文件无公网引用。 |
| 生产 E2E 实际视口/交互断言 | passed；桌面与 300px 的唯一滚动、身份、任务、颜色、双列、右键、长按、键盘菜单及焦点恢复通过。 |
| `git diff --check` 与文件归属检查 | passed；无空白错误、生成物、秘密、真实配置或无关文件。 |

最终一次产品代码修改后重跑了全部上述自动化。`test:platform`、`test:avalon`、
`test:poker`、capacity、Docker 和 deploy 未运行，因为差异没有触及服务、规则、资产、
容量、容器或发布接口；未把既有历史或未运行门禁作为本次新证据。没有连接或改变正式
iStoreOS 服务。

## 6. 与路线图及阶段计划的偏差

- change plan 保持 `single + compact` rev 1，P-001 及 P-001-T-001 边界未变。
- 没有需求、变更计划、阶段计划、阶段数或验证策略修订。
- `docs/ui-design-guidelines.md` 的上下文菜单规范及 `AGENTS.md` 的阶段快照属于计划内
  兼容约束与仓库同步，不改变产品范围。
- 自动化先发现并修复加入标题定位器歧义、本人/队长边框优先级和已有投票历史断言，
  随后完整重跑通过，没有产生未闭合偏差或 finding。
- 本运行未暂停、恢复、修改外部状态、正式发布、提交或推送。

## 7. 遗留事项

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

正式 `home-table` 未发布本候选，这是明确排除范围而非 finding。后续产品变化应从
`effective-requirements.md` 建立连续的 `change-3`，不得改写本记录、阶段结果或 completed
execution state；若需要正式发布，必须另行取得明确授权并使用受支持部署入口。
