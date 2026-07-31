# P-001 阶段结果：阿瓦隆 UI 层级、玩家卡交互与独立主题

- 运行编号：`change-1`
- 阶段编号：`P-001`
- 阶段计划：[phase-001-plan.md](phase-001-plan.md)
- 阶段计划修订：`1`
- 父变更计划修订：`1`
- 完成日期：`2026-07-31`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：`main@ec437a4e6d1ebb4e548f4b7a9271fc1e9a412270`
- 结束基线：上述 HEAD 加本结果所列未提交候选差异；本运行未获授权提交或发布

## 1. 阶段目标与结果

P-001 的唯一任务 `P-001-T-001` 已完成。共享大厅、加入确认、阿瓦隆局间准备和活动牌桌
按照 RC-1-001–RC-1-005 调整，并为阿瓦隆增加与德州扑克明确分离的冷色主题：

- 中文系统产品名统一为“阿瓦隆”，英文仍为 `Avalon`；创建选择卡移除默认规则小字，
  Poker/Avalon 加入层统一以居中大字显示房间名、游戏名和当前人数。
- 局间准备区以一行十个圆点表达人数：已占用从左填充，空的前五个为实线、后五个为
  虚线；开始按钮与设置保存区贴底对齐，表单控件高度稳定。
- 按住查看信息时，本人角色和规则允许的知识直接覆盖到对应的上方玩家卡；左下只保留
  较窄的按住按钮。队长提名时，上方玩家卡成为原生选择按钮并以颜色和
  `aria-pressed` 表达选中状态。
- 准备、待确认、待投票和待任务提交使用操作提示色；已投票恢复普通背景并显示
  “已投票”。本人和队长使用持续边框，二者重合时队长色优先；当前可行动的右下卡整体
  填充操作提示色，内部按钮使用对比色。
- 五次任务常态显示队伍人数和失败阈值，当前任务使用队长色填充；已完成结果与规则信息
  同时保留。
- 大厅、Poker、Avalon 玩家端和 Avalon display 分别使用 `main`、`poker`、`avalon`
  theme scope；Avalon light/dark 均采用独立冷色调色板。

全部 AC-C1-001–AC-C1-008 core 和阶段硬门禁通过。服务端权威、租约秘密投影、领域规则、
资产、SQLite、部署接口和正式服务器均未改变。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 需求与验收 | 完成证据 |
| --- | --- | --- | --- |
| P-001-T-001 | completed | RC-1-001–RC-1-005；AC-C1-001–AC-C1-008 core | lint、typecheck、realtime 5/5、生产 build/static、Chromium/WebKit 8/8、桌面与 300px 浏览器检查、差异卫生检查全部通过 |

| 验收 | 状态 | 可观察结果 |
| --- | --- | --- |
| AC-C1-001 | passed | 中英文产品名、无规则副标题、Poker/Avalon 居中加入摘要和当前人数均由 E2E 覆盖。 |
| AC-C1-002 | passed | 十圆点填充/实线/虚线语义、开始/保存底部对齐和表单高度由 DOM 几何断言与浏览器检查覆盖。 |
| AC-C1-003 | passed | 私密信息只在按住期间覆盖对应玩家卡；松开后消失，匿名 display 不接收按钮或秘密。 |
| AC-C1-004 | passed | 队长可通过上方原生玩家卡按钮选择准确人数，选中状态同时使用颜色和 `aria-pressed`。 |
| AC-C1-005 | passed | 准备、待行动、已投票、本人、队长和右下可行动卡的颜色/文字/边框优先级均通过 E2E。 |
| AC-C1-006 | passed | 五项任务规则常显，当前任务使用队长色填充，结果不会覆盖人数和失败阈值。 |
| AC-C1-007 | passed | `main`/`poker`/`avalon` scope 正确，Avalon 与 Poker 调色板可观测地不同。 |
| AC-C1-008 | passed | 中英文、桌面、300px、键盘/鼠标/触控主流程、Poker 兼容、实时隔离和离线构建通过。 |

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/contracts/src/product-config.ts` | modify | 增加独立 Avalon light/dark 调色板及配置断言。 |
| `apps/web/src/ui.tsx` | modify | 把 `avalon` 加入主题 scope 联合类型。 |
| `apps/web/src/locales.ts` | modify | 增加本地化阿瓦隆名称和当前人数文案。 |
| `apps/web/src/admin-ui.tsx` | modify | 管理员中文产品标签使用“阿瓦隆”。 |
| `apps/web/src/main.tsx` | modify | 按游戏选择主题 scope，统一游戏选择卡和 Poker/Avalon 加入摘要，并向 display 应用 Avalon scope。 |
| `apps/web/src/avalon-ui.tsx` | modify | 十点准备计、玩家卡私密覆盖/选人/状态、五任务规则和底部操作层级。 |
| `apps/web/src/styles.css` | modify | 加入摘要、局间布局、玩家状态、行动卡、任务轨迹、独立主题和响应式样式。 |
| `tests/e2e/core.spec.ts` | modify | 覆盖新文案、加入摘要、准备计、主题、玩家卡交互、投票状态、任务规则和桌面/300px 几何。 |
| `AGENTS.md` | modify | 同步 change-1 completed 状态、验证范围和正式未发布事实。 |
| `docs/requirements/avalon-game/execution/change-1/change-plan.md` | add | RC、core 验收、单阶段路线图、风险和验证策略。 |
| `docs/requirements/avalon-game/execution/change-1/phase-001-plan.md` | add | P-001 rev 1 的 compact just-in-time 计划。 |
| `docs/requirements/avalon-game/execution/change-1/execution-state.md` | add | change-1 的 durable 执行状态；收口时更新为 completed。 |
| `docs/requirements/avalon-game/execution/change-1/phase-001-result.md` | add | 冻结本阶段 completed / passed 结果。 |

没有修改服务端、领域、SQLite、Avalon/Poker 规则包、部署脚本、Docker 接口、正式配置、
其他 feature 的冻结历史或生成的 `dist/`。

## 4. 测试与验证

| 类型 | 命令或检查 | 观察结果 |
| --- | --- | --- |
| 静态质量 | `npm run lint` | passed。 |
| 类型 | `npm run typecheck` | passed。 |
| 实时投影回归 | `npm run test:realtime` | passed，1 file / 5 tests。 |
| 核心浏览器回归 | `npm run test:e2e:core` | passed；生产 build/static、Chromium desktop 与 WebKit mobile 共 8/8。 |
| 构建/静态资源 | 上述 E2E 内置 `npm run build` 与静态检查 | passed；Web 47 modules、server ESM bundle，2 个 HTML/CSS 文件无公网资源。 |
| 独立浏览器审阅 | 本地临时生产实例的桌面及 300px 视口 | passed；检查选择/加入/准备/确认/提名/投票/任务视觉层级，300px document width 为 300，控制台错误为空。 |
| 差异卫生 | `git diff --check`、`git status --short` 和临时实例清理检查 | passed；无空白错误、生成物、真实配置或遗留测试服务/目录。 |

最终一次产品代码修改后重新运行了 lint、typecheck、realtime 和完整核心 E2E，因此最终证据
对应当前候选。`test:platform`、`test:avalon`、`test:poker`、capacity、Docker 和 deploy
未运行：实际差异未触及服务、规则、资产、容量、容器或发布边界，这与 compact 阶段计划
一致。npm 无法清理用户级 cache 日志的非失败警告不改变退出码或交付结论。

## 5. 发现项与处置

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

浏览器审阅中曾发现房主操作按钮在操作提示色玩家卡上的对比度不足；它在阶段内修复，并由
后续完整自动化和独立浏览器检查重新验证，未保留为 finding。

## 6. 决策、计划偏差与恢复记录

- 用户为本 change run 明确选择 `relaxed`；全部 core 和硬门禁实际通过，没有使用
  report-only 例外。
- 变更保持 `single + compact`，没有阶段、任务、变更计划或阶段计划修订，也没有纠正阶段。
- 实现文件与计划范围一致；`admin-ui.tsx` 的系统产品名替换属于 RC-1-001 已计划的全局
  中文标签范围。
- 独立浏览器审阅发现并修复一次卡片内按钮对比度问题；这是同一任务内的正常验证闭环，
  没有改变需求、设计或阶段边界。
- `AGENTS.md` 在收口时按仓库级阶段同步约定更新；它不改变产品范围或计划门禁。
- 本运行没有暂停、恢复、用户 overlap、部分迁移、未知文件或外部状态变化。

## 7. 遗留风险与下一阶段进入条件

没有开放 finding、未决问题、阻塞风险或下一执行阶段。P-001 是 change-1 的最终阶段；
在本结果冻结后，只需生成 `change-1.md`、更新 `effective-requirements.md`，并把
`execution-state.md` 标记为 `completed`。正式发布不在本运行范围内，且没有被执行。
