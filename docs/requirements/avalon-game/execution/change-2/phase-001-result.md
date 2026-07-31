# P-001 阶段结果：移动端滚动、身份任务反馈与上下文菜单

- 运行编号：`change-2`
- 阶段编号：`P-001`
- 阶段计划：[phase-001-plan.md](phase-001-plan.md)
- 阶段计划修订：`1`
- 父变更计划修订：`1`
- 完成日期：`2026-07-31`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：`main@29b157a1133eaf62b39f319db42634827bcc9ed7`
- 结束基线：上述 HEAD 加本结果所列未提交候选差异；本运行未获授权提交或发布

## 1. 阶段目标与结果

P-001 的唯一任务 `P-001-T-001` 已完成。RC-2-001–RC-2-005 已在一个同步 Web 候选中
交付：

- 固定壳层统一使用动态视口高度，页面外层不再与固定内容区形成双层纵向滚动；300px
  管理页、Avalon 活动局和局间页均验证外层不能滚动，内部内容仍可达。
- 私密按钮更名为“查看身份”/`View identity`。按住期间所有玩家卡统一强调，只有投影允许
  知道的卡显示文字，本人卡始终显示精确角色；松开及既有安全事件继续遮盖。本人确认后
  按钮由强调样式恢复为次要样式。
- 手机端查看卡与操作卡保持左窄右宽的同一行；右侧同意/反对、成功/失败等二选一按钮
  纵向排列。
- 五任务轨迹移除标题下成功/失败总数和可见序号。未完成项只显示队伍人数与失败阈值，
  完成项只显示成功/失败票数；成功、失败分别使用高对比绿色、红色实心填充并放大数字。
- 队长提名期间，“本局参赛”整卡使用操作提示强调色边框呼吸；队长和当前任务使用操作
  提示色，本人使用独立颜色，二者重合时队长优先。
- Avalon 与 Poker 均不再常态显示转让/移除入口。房主可通过触控长按、桌面右键或键盘
  ContextMenu/Shift+F10 打开 portal 菜单；移动超过阈值会取消长按，短触和队长选人仍按
  原业务执行，转让在线限制、移除确认和服务端授权保持不变。

全部 AC-C2-001–AC-C2-008 core 与阶段硬门禁通过。服务端命令、角色投影、领域规则、
资产、SQLite、部署接口和正式服务器均未改变。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 需求与验收 | 完成证据 |
| --- | --- | --- | --- |
| P-001-T-001 | completed | RC-2-001–RC-2-005；AC-C2-001–AC-C2-008 core | lint、typecheck、realtime 5/5、生产 build/static、Chromium/WebKit 8/8、300px 动态视口与计算样式/几何/手势断言、差异卫生全部通过 |

| 验收 | 状态 | 可观察结果 |
| --- | --- | --- |
| AC-C2-001 | passed | 管理固定页、Avalon 活动局和局间页在 300px 动态视口下 document 高度不超过 viewport、外层滚动保持 0、内部内容区为唯一纵向滚动所有者；页面无横向溢出。 |
| AC-C2-002 | passed | 按住查看时所有玩家卡具有同一强调填充，本人精确角色始终出现，其他文字只来自合法知识；松开后所有覆盖消失，匿名 display 无查看入口或秘密。 |
| AC-C2-003 | passed | 确认身份前后按钮分别为强调/次要样式；300px 下查看区和操作区同排且右区更宽，二选一按钮等宽纵向排列。 |
| AC-C2-004 | passed | 五任务无可见序号和标题下总数；未完成项显示人数/阈值，完成项只显示成功/失败票数；成功/失败使用实心主题色、对比文字和不小于 18px 的关键数字。 |
| AC-C2-005 | passed | 提名阶段整张参赛卡具有强调边框与呼吸动画，提交队伍后提示停止；减动效规则保留静态边框。 |
| AC-C2-006 | passed | 两种游戏的管理按钮默认不可见；Chromium 右键、WebKit 长按及键盘上下文键可打开正确目标菜单，Escape 恢复焦点，移除仍需确认。 |
| AC-C2-007 | passed | 队长边框、当前任务背景与操作提示强调色一致；本人边框使用独立颜色，重合时队长颜色优先。 |
| AC-C2-008 | passed | 中英文文案、桌面、300px、Chromium/WebKit、键盘、鼠标、触控、Poker 兼容、秘密投影和离线生产构建均通过 changed-area 回归。 |

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `apps/web/src/ui.tsx` | modify | 增加事件委托的长按、右键和键盘上下文菜单手势，包含移动取消、点击抑制及 portal 菜单兼容。 |
| `apps/web/src/main.tsx` | modify | 把 Poker 等候区、玩家牌桌和观战牌桌的房主管理入口迁移到玩家卡上下文菜单。 |
| `apps/web/src/avalon-ui.tsx` | modify | 修正本人精确角色覆盖、统一查看强调、确认后按钮、任务轨迹、提名提示及 Avalon 管理菜单。 |
| `apps/web/src/styles.css` | modify | 统一动态视口/滚动所有者，增加上下文目标、身份、任务结果、语义边框、呼吸动画和手机双列样式。 |
| `docs/ui-design-guidelines.md` | modify | 记录触控长按、桌面右键、键盘上下文键、移动取消及短触保留的共享菜单规范。 |
| `tests/e2e/core.spec.ts` | modify | 覆盖唯一滚动、精确身份、防旁观填充、确认样式、手机几何、任务结果、提名动画、语义色和双游戏上下文菜单。 |
| `AGENTS.md` | modify | 同步 change-2 completed 状态、验证范围和正式未发布事实。 |
| `docs/requirements/avalon-game/execution/change-2/change-plan.md` | add | RC-2、core 验收、单阶段路线图、风险和验证策略。 |
| `docs/requirements/avalon-game/execution/change-2/phase-001-plan.md` | add | P-001 rev 1 compact 执行计划。 |
| `docs/requirements/avalon-game/execution/change-2/execution-state.md` | add | change-2 durable 执行状态；收口时更新为 completed。 |
| `docs/requirements/avalon-game/execution/change-2/phase-001-result.md` | add | 冻结本阶段 completed / passed 结果。 |

没有修改服务端、契约、领域、SQLite、Avalon/Poker 规则包、部署脚本、Docker 接口、正式
配置、其他 feature 的冻结历史或生成的 `dist/`。

## 4. 测试与验证

| 类型 | 命令或检查 | 观察结果 |
| --- | --- | --- |
| 静态质量 | `npm run lint` | passed。 |
| 类型 | `npm run typecheck` | passed。 |
| 实时投影回归 | `npm run test:realtime` | passed，1 file / 5 tests。 |
| 核心浏览器回归 | `npm run test:e2e:core` | passed；生产 build/static、Chromium desktop 与 WebKit mobile 共 8/8。 |
| 构建/静态资源 | 上述 E2E 内置 `npm run build` 与静态检查 | passed；Web 47 modules、server ESM bundle，2 个 HTML/CSS 文件无公网资源。 |
| 实际视口与交互检查 | 上述生产 E2E 的桌面及 300px 页面 | passed；验证 document/viewport 高度、唯一滚动区、卡片计算色、任务字号、双列几何、右键、长按、键盘菜单及焦点恢复。 |
| 差异卫生 | `git diff --check`、`git status --short` 与文件归属检查 | passed；无空白错误、生成物、真实配置或无关文件。 |

最终一次产品代码修改后重新运行了 lint、typecheck、realtime 和完整核心 E2E，因此最终
证据对应当前候选。`test:platform`、`test:avalon`、`test:poker`、capacity、Docker 和
deploy 未运行：实际差异未触及服务、规则、资产、容量、容器或发布边界，这与 compact
阶段计划一致。npm 无法清理用户级 cache 日志的非失败警告不改变退出码或交付结论。

## 5. 发现项与处置

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

阶段内自动化先后发现了加入弹窗标题定位器歧义、本人卡在待行动状态下边框优先级错误，
以及新增首局任务后旧测试仍假设投票历史为空。三项均在任务内修复：定位器改用房间页唯一
标题，CSS 明确本人/队长优先级，秘密投票断言改为“公开历史保持不变”；随后完整 8/8
浏览器门禁通过，未保留 finding。

## 6. 决策、计划偏差与恢复记录

- 用户为本 change run 明确选择 `relaxed`；全部 core 和硬门禁实际通过，没有使用
  report-only 例外。
- 变更保持 `single + compact`，没有阶段、任务、变更计划或阶段计划修订，也没有纠正阶段。
- 实现文件与计划范围一致；`docs/ui-design-guidelines.md` 是共享上下文菜单行为的既有
  规范同步，`AGENTS.md` 是仓库阶段快照同步，二者不扩大产品范围。
- 自动化中的三次诊断修复属于同一任务内的正常验证闭环；最终产品代码之后重跑了全部
  计划门禁。
- 本运行没有暂停、恢复、用户 overlap、部分迁移、未知文件或外部状态变化。

## 7. 遗留风险与下一阶段进入条件

没有开放 finding、未决问题、阻塞风险或下一执行阶段。P-001 是 change-2 的最终阶段；
在本结果冻结后，只需生成 `change-2.md`、更新 `effective-requirements.md`，并把
`execution-state.md` 标记为 `completed`。正式发布不在本运行范围内，且没有被执行。
