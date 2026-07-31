# 阿瓦隆游戏：change-1 UI 层级、玩家交互与独立主题记录

- 修改编号：`1`
- 修改类型：`requirement change`
- 原始需求：[requirements.md](requirements.md)
- 初始路线图：[implementation-plan.md](implementation-plan.md)
- 变更计划：[execution/change-1/change-plan.md](execution/change-1/change-plan.md)
- 执行运行：[execution/change-1/execution-state.md](execution/change-1/execution-state.md)
- 项目基线：`main@ec437a4e6d1ebb4e548f4b7a9271fc1e9a412270`
- 完成日期：`2026-07-31`
- 运行状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 原始需求变更项目

| 变更项 | 变更类型 | 关联原始需求或历史变更 | 变更前 | 变更后 | 验收影响 |
| --- | --- | --- | --- | --- | --- |
| RC-1-001 | modify | FR-002、FR-054、AC-001、AC-021 | 中文部分使用 `Avalon`；选择卡带默认规则小字；加入层游戏名细小、左对齐且不显示人数。 | 中文系统产品名统一为“阿瓦隆”；选择卡只保留图标和大号游戏名；Poker/Avalon 加入层居中显示醒目房间名、本地化游戏名和当前人数，Poker 保留买入。 | AC-C1-001、AC-C1-008 core passed |
| RC-1-002 | modify | FR-015、FR-053、AC-004、AC-021 | 局间人数为 `2/5–10` 文本，开始按钮悬在卡片上方，设置输入会被网格拉高。 | 同一行十圆点从左填充；空的前五位为实线、后五位为虚线；开始/保存贴底对齐且控件高度稳定。 | AC-C1-002、AC-C1-008 core passed |
| RC-1-003 | modify | FR-024、FR-029、FR-051、FR-053、AC-007、AC-009、AC-021、AC-031 | 私密知识显示在左下；右下重复候选网格；准备/投票/行动/本人/队长状态层级较弱，底部左右等宽。 | 私密信息覆盖对应玩家卡；提名直接使用上方原生玩家卡按钮；准备/待行动用操作提示色，提交后恢复并显示状态；本人/队长持续边框且队长优先；宽屏右下行动区更大并整体填色。 | AC-C1-003–AC-C1-005、AC-C1-008 core passed |
| RC-1-004 | modify | FR-030、FR-052、AC-011、AC-021 | 只有当前任务显示人数/失败阈值，其他任务为破折号；当前任务只描边。 | 五项任务常态显示人数和失败阈值；当前任务使用队长色填充，完成结果与规则共存。 | AC-C1-006、AC-C1-008 core passed |
| RC-1-005 | modify | FR-057、NFR-005、AC-021、AC-025、AC-031 | Avalon 复用 Poker 绿金主题，没有独立 light/dark 调色板。 | 新增 Avalon 冷色 light/dark scope；大厅、Poker、Avalon 玩家端和 Avalon display 选择正确产品主题，操作提示色与队长色明确区分。 | AC-C1-007–AC-C1-008 core passed |

## 2. 实现概述

本记录把 change-1 的五项需求增量正式应用到当前阿瓦隆体验：

- 统一大厅游戏卡和 Poker/Avalon 加入摘要的信息层级，并把所有系统拥有的中文产品标签
  改为“阿瓦隆”。
- 重排局间准备卡和设置卡，使用十点人数计、稳定控件高度及贴底操作区。
- 把临时私人知识、队长提名、准备、投票、任务提交、本人和队长状态集中到上方玩家卡；
  底部只保留查看入口、当前动作摘要和权威命令提交。
- 常态显示五项任务的队伍人数/失败阈值，以独立队长色强调当前任务。
- 增加独立 Avalon light/dark 调色板和 `avalon` theme scope，同时保持 Poker 主题及业务
  行为不变。

实现只消费现有 `ownKnowledge`、队长、提交者和 `AVALON_RULES`，没有增加秘密数据、
客户端权限或规则副本。服务端、领域、资产、持久化和部署接口未改变。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/contracts/src/product-config.ts` | modify | 增加 Avalon light/dark 调色板和配置断言。 |
| `apps/web/src/ui.tsx` | modify | 扩展主题 scope 类型。 |
| `apps/web/src/locales.ts` | modify | 增加“阿瓦隆”及当前人数的中英文文案。 |
| `apps/web/src/admin-ui.tsx` | modify | 管理员中文系统产品名本地化。 |
| `apps/web/src/main.tsx` | modify | 主题 scope、游戏选择卡、创建标题和 Poker/Avalon 加入摘要。 |
| `apps/web/src/avalon-ui.tsx` | modify | 十点准备计、玩家卡私密覆盖/提名/状态、五任务轨迹和底部操作结构。 |
| `apps/web/src/styles.css` | modify | 信息层级、玩家/行动/任务颜色语义、独立主题和响应式几何。 |
| `tests/e2e/core.spec.ts` | modify | 新 UI 行为、可访问性、主题、几何及 Poker/Avalon 完整流程回归。 |
| `AGENTS.md` | modify | 同步 change-1 completed 状态、验证范围和正式未发布事实。 |
| `docs/requirements/avalon-game/execution/change-1/change-plan.md` | add | RC-1-001–RC-1-005、core 验收、单阶段路线图和门禁。 |
| `docs/requirements/avalon-game/execution/change-1/phase-001-plan.md` | add | P-001 rev 1 compact 执行计划。 |
| `docs/requirements/avalon-game/execution/change-1/phase-001-result.md` | add | P-001 completed / passed 冻结结果。 |
| `docs/requirements/avalon-game/execution/change-1/execution-state.md` | add | change-1 completed durable 状态和累计证据。 |
| `docs/requirements/avalon-game/effective-requirements.md` | modify | 把五项 RC 应用到当前有效产品权威和来源链。 |
| `docs/requirements/avalon-game/change-1.md` | add | 冻结本次连续编号需求变更。 |

没有修改 initial、`change-0.md`、其他 feature 冻结历史、服务端、领域、SQLite 表结构、
Poker/Avalon 规则、部署、Docker、正式配置或生成物。

## 4. 需求、阶段与任务完成情况

| 范围 | 状态 | 结果 |
| --- | --- | --- |
| RC-1-001–RC-1-005 | completed | 全部五项 modify 增量已进入 [effective-requirements.md](effective-requirements.md)。 |
| AC-C1-001–AC-C1-008 core | passed | 大厅/加入、准备、私密覆盖、玩家卡提名、状态层级、任务轨迹、主题和兼容性全部通过。 |
| P-001-T-001 | completed | 共享 UI、Avalon 玩家交互、独立主题、E2E 和浏览器证据完成。 |
| P-001 | completed | [phase-001-plan.md](execution/change-1/phase-001-plan.md) rev 1 与 [phase-001-result.md](execution/change-1/phase-001-result.md) 已冻结。 |
| change-1 | completed | 单阶段 compact 运行完成，编号记录与有效需求快照一致。 |

来源指纹为：

- change-1 前有效需求：`sha256:eeed9136cb86ce4eaf646513a46286c51748e47ca4bd80cc482d25e310bd312e`
- change plan rev 1：`sha256:62140e9748bd134301888e671f2514d07239716505d639343d84abde672de6e0`
- phase plan rev 1：`sha256:11590bbc26d2ff702d33561843727ee0b44c24a5a94fbac6fcbb1e94f6e9d762`
- phase result：`sha256:fbd2dcd953285b82183b034b6b38873d08e1c6d8bf6cf0fde9139dc6a0690bc8`
- change-1 后有效需求：`sha256:a0c971fd48ca8f8a49cfc56cc3af45f85e3eda413a6091d26ca36cc927a473d7`

change 编号从 0 到 1 连续，P-001 是本运行唯一阶段；没有 corrective phase、未决问题、
部分迁移、未知 overlap 或 blocking finding。

## 5. 测试与验证

- 交付与验证策略：`relaxed`。
- 验证结论：`passed`。
- 全部 change-1 core 和计划硬门禁通过，没有使用 report-only 例外。

| 验证 | 结果 |
| --- | --- |
| `npm run lint` | passed。 |
| `npm run typecheck` | passed。 |
| `npm run test:realtime` | passed，1 file / 5 tests。 |
| `npm run test:e2e:core` | passed；生产 build/static、Chromium desktop 与 WebKit mobile 共 8/8。 |
| E2E 内置生产构建/静态资源检查 | passed；Web 47 modules、server ESM bundle，2 个 HTML/CSS 文件无公网引用。 |
| 独立浏览器审阅 | passed；桌面完成准备、确认、提名和投票状态检查；300px viewport/document width 均为 300；控制台错误为空。 |
| `git diff --check` 与文件归属检查 | passed；无空白错误、生成物、秘密、真实配置或临时服务/目录。 |

最终一次产品代码修改后重跑了全部上述自动化。`test:platform`、`test:avalon`、
`test:poker`、capacity、Docker 和 deploy 未运行，因为差异没有触及服务、规则、资产、
容量、容器或发布接口；未把既有历史或未运行门禁作为本次新证据。没有连接或改变正式
iStoreOS 服务。

## 6. 与路线图及阶段计划的偏差

- change plan 保持 `single + compact` rev 1，P-001 及 P-001-T-001 边界未变。
- 没有需求、变更计划、阶段计划、阶段数或验证策略修订。
- `admin-ui.tsx` 的中文系统产品名替换属于 RC-1-001 已声明的全局标签范围。
- `AGENTS.md` 按仓库级阶段同步约定在收口时更新，不改变产品范围或计划门禁。
- 浏览器审阅发现操作提示色玩家卡内房主管理按钮对比度不足；在同一任务内修复后重新
  运行完整自动化和视觉检查，没有产生未闭合偏差或 finding。
- 本运行未暂停、恢复、修改外部状态、正式发布、提交或推送。

## 7. 遗留事项

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

正式 `home-table` 未发布本候选，这是明确排除范围而非 finding。后续产品变化应从
`effective-requirements.md` 建立连续的 `change-2`，不得改写本记录、阶段结果或 completed
execution state；若需要正式发布，必须另行取得明确授权并使用受支持部署入口。
