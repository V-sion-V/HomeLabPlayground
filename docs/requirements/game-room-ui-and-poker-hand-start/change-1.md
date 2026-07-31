# 游戏房间界面统一与德州扑克开手体验：change-1 Poker 视觉修复与全局临时提示记录

- 修改编号：`1`
- 修改类型：`requirement change`
- 原始需求：[requirements.md](requirements.md)
- 初始路线图：[implementation-plan.md](implementation-plan.md)
- 变更计划：[execution/change-1/change-plan.md](execution/change-1/change-plan.md)
- 执行运行：[execution/change-1/execution-state.md](execution/change-1/execution-state.md)
- 项目基线：`main@4b305b2c3c77e0a88036692143a7a3fd48ba33ef`
- 完成日期：`2026-07-31`
- 运行状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 原始需求变更项目

| 变更项 | 变更类型 | 关联历史需求 | 变更前 | 变更后 | 验收影响 |
| --- | --- | --- | --- | --- | --- |
| RC-1-001 | modify | FR-012、FR-013、AC-010、NFR-005 | Poker 准备主面板有外框；行动填充下部分文字对比不足；在线状态位于头像下方，卡片偏大。 | 准备主面板无外圈边框；卡内可见文字跟随强调填充使用可读前景；在线状态位于头像右侧昵称下方，卡片结构更紧凑。 | AC-C1-001、AC-C1-006 core passed |
| RC-1-002 | modify | FR-024、FR-025、AC-019、AC-020、NFR-007 | 缓存宽度和负间距固定，面值节点多时被裁剪/覆盖不均；面值与数量行距偏大。 | 缓存贯穿 felt 安全宽度，按当前不同面值节点数锚定首尾并等分中间位置；16 节点仍可操作，面值/数量行紧凑，总额/清空可达。 | AC-C1-002、AC-C1-006 core passed |
| RC-1-003 | modify | FR-028、AC-022、NFR-005 | 手机横向轨道的滚动裁剪盒仍截断玩家卡阴影。 | 轨道扩大上下安全 padding 并压缩卡片，300px 下阴影、真实 Tab 焦点和庄家标识位于安全盒内。 | AC-C1-003、AC-C1-006 core passed |
| RC-1-004 | add | NFR-005–NFR-007 | 连接接管和操作结果以单一 notice 字符串停留在页面布局中，不能并存或关闭。 | 瞬时反馈进入固定左上角 toast；最新在上，每条约五秒自动消失且可手动关闭，普通/游戏/管理员页面复用；上下文字段校验、静态警告和确认不迁移。 | AC-C1-004–AC-C1-006 core passed |

## 2. 实现概述

本记录把 change-1 的四项增量应用到当前 Web：

- Poker 准备页移除主面板外圈边框；活动玩家卡改为头像、身份、资产和徽标网格，在线
  状态迁到头像右侧昵称下方，并缩小头像、padding 和有界宽度。
- 行动/待办卡的名称、在线状态、筹码标签/数值及折叠状态明确使用强调填充前景；本人
  边框、状态徽标、庄家和房主管理语义保留。
- felt 缓存改为左右安全边距内全宽。React 从实际非零面值节点计算 0–100% 位置及反向
  自身偏移，CSS 让首尾完整、中间等分；数量行使用紧凑行高。透明空白不拦截牌桌事件，
  旁观者条在缓存出现时避让。
- 手机轨道增加足以容纳阴影/焦点/庄家的上下 padding，玩家卡进一步压缩但保持横滚、
  吸附、长按/右键/键盘菜单和长名称省略。
- 共享 toast provider 维护稳定 ID、独立计时器和最新在上的数组，通过 portal 固定在视口
  左上角；主应用和管理员应用移除布局内 notice，手动关闭和 provider 卸载都会清理计时。

实现只调整客户端瞬时状态、DOM、CSS 和浏览器断言；没有改变命令、游戏状态、资产、
秘密投影、SQLite 或部署接口。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `apps/web/src/ui.tsx` | modify | 共享 toast context/provider、portal、独立自动关闭和手动关闭。 |
| `apps/web/src/main.tsx` | modify | 主应用反馈接入 toast；Poker 玩家卡身份布局及按节点数动态定位的缓存。 |
| `apps/web/src/admin-ui.tsx` | modify | 管理员成功/失败反馈迁移到 toast，删除布局内 notice 传递。 |
| `apps/web/src/avalon-ui.tsx` | modify | 移除 Avalon 房间中的 transient notice 占位。 |
| `apps/web/src/styles.css` | modify | 左上角 toast、无框准备面板、卡片前景/紧凑网格、全宽缓存、旁观者避让和手机安全区。 |
| `tests/e2e/core.spec.ts` | modify | toast 计时/顺序/不占位、卡片颜色/几何、准备边框、16 面值间距和 300px 阴影/焦点验收。 |
| `AGENTS.md` | modify | 同步 change-1 completed 状态、验证范围和正式发布事实边界。 |
| `docs/requirements/game-room-ui-and-poker-hand-start/execution/change-1/change-plan.md` | add | RC-1-001–RC-1-004、core 验收、单阶段路线图和门禁。 |
| `docs/requirements/game-room-ui-and-poker-hand-start/execution/change-1/phase-001-plan.md` | add | P-001 rev 1 compact 阶段计划。 |
| `docs/requirements/game-room-ui-and-poker-hand-start/execution/change-1/phase-001-result.md` | add | P-001 completed / passed 冻结结果。 |
| `docs/requirements/game-room-ui-and-poker-hand-start/execution/change-1/execution-state.md` | add | change-1 completed durable 状态与累计证据。 |
| `docs/requirements/game-room-ui-and-poker-hand-start/effective-requirements.md` | modify | 把四项 RC 应用到当前有效产品权威和来源链。 |
| `docs/requirements/game-room-ui-and-poker-hand-start/change-1.md` | add | 冻结本次连续编号需求变更。 |

没有修改 initial、`change-0.md`、其他 feature 冻结历史、文案字典、服务/契约/领域/规则、
SQLite、部署/Docker、真实配置或生成的 `dist/`。

## 4. 需求、阶段与任务完成情况

| 范围 | 状态 | 结果 |
| --- | --- | --- |
| RC-1-001–RC-1-004 | completed | 全部增量已进入 [effective-requirements.md](effective-requirements.md)。 |
| AC-C1-001–AC-C1-006 core | passed | 准备页、卡片对比/布局、全宽动态缓存、手机阴影和全局 toast 全部通过。 |
| P-001-T-001 | completed | Web 实现、E2E、完整发布前回归和工作流证据完成。 |
| P-001 | completed | [phase-001-plan.md](execution/change-1/phase-001-plan.md) rev 1 与 [phase-001-result.md](execution/change-1/phase-001-result.md) 已冻结。 |
| change-1 | completed | 单阶段 compact 运行完成，编号记录与有效需求快照一致。 |

来源指纹为：

- change-1 前有效需求：`sha256:7060e8aa69f42c79b5d9ffe019323235b1f9e879569c389dcc36c8248329d504`
- change plan rev 1：`sha256:1ed77a8dee217d21a46c4c466d32f8c94c865da6d42da5e2d599daabee141082`
- phase plan rev 1：`sha256:21f6f7da0b7af85912b9020280207b4988d9f086c911ad795ec711e5593245fa`
- phase result：`sha256:22107ace578aceb0a319663579081cbbb6fcfc16d7a41dc68b05e2407a3da9ca`
- change-1 后有效需求：`sha256:605714942543c3d2bb0b486b58843c75b1bf02506a0c26fa69409b6d8117ce91`

change 编号 0–1 连续，P-001 是本运行唯一阶段；没有 corrective phase、未决问题、部分
迁移、未知 overlap 或 blocking/report-only finding。

## 5. 测试与验证

- 交付与验证策略：`relaxed`。
- 验证结论：`passed`。
- 全部 change-1 core 和计划硬门禁通过，没有使用 report-only 例外。

| 验证 | 结果 |
| --- | --- |
| `npm run lint` | passed。 |
| `npm run typecheck` | passed。 |
| `npm run test:platform` | passed，3 files / 40 tests。 |
| `npm run test:poker` | passed，1 file / 17 tests。 |
| `npm run test:avalon` | passed，1 file / 8 tests。 |
| `npm run test:realtime` | passed，1 file / 5 tests。 |
| `npm run test:capacity` | passed，1 file / 4 tests。 |
| `npm run test:e2e:core` | passed；生产 build/static、Chromium desktop 与 WebKit mobile 共 8/8。 |
| E2E 内置生产构建/静态资源检查 | passed；Web 47 modules、server ESM bundle，2 个 HTML/CSS 文件无公网引用。 |
| 生产 E2E 视觉/交互断言 | passed；边框、计算色、身份位置、toast 顺序/计时、16 面值步长、紧凑行距、旁观者避让和 300px 阴影/焦点全部成立。 |
| `git diff --check` 与文件归属检查 | passed；无空白错误、生成物、秘密、真实配置或无关文件。 |

最终产品候选经过完整双浏览器 8/8；最终测试断言同步后又完整运行 8/8，并重跑 lint、
typecheck 和 diff。npm 用户级 cache 日志清理的 EPERM 为非失败警告。没有用本地构建或
模拟结果替代正式服务器部署证据。

## 6. 与路线图及阶段计划的偏差

- change plan 保持 `single + compact` rev 1，P-001 及 P-001-T-001 边界未变。
- 没有需求、变更计划、阶段计划、阶段数或验证策略修订。
- `locales.ts` 作为“必要时”文件最终无需修改；既有消息已双语，关闭按钮按当前文档语言
  生成中英文可访问名称。
- 验证中发现并修复缓存/旁观者点击重叠、焦点测试模态及旧 toast 断言，均为同任务内
  正常闭环，最终没有开放偏差或 finding。
- 提交与正式发布由用户明确授权，但仅在本记录和 completed state 冻结后执行；部署结果
  属于后续运维事实，不反写成本产品阶段证据。

## 7. 遗留事项

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

没有产品遗留事项。未来产品变化应从 `effective-requirements.md` 建立连续的 `change-2`，
不得改写本记录、阶段结果或 completed execution state。正式发布状态以最近一次受支持部署
输出和只读服务器事实为准。
