# 游戏房间界面统一与德州扑克开手体验：change-2 Poker 布局纠错记录

- 修改编号：`2`
- 修改类型：`requirement change`
- 原始需求：[requirements.md](requirements.md)
- 初始路线图：[implementation-plan.md](implementation-plan.md)
- 变更计划：[execution/change-2/change-plan.md](execution/change-2/change-plan.md)
- 执行运行：[execution/change-2/execution-state.md](execution/change-2/execution-state.md)
- 项目基线：`main@d1dfadf47d1315efec9cb0b955cae5c5c5cea1dc`
- 完成日期：`2026-08-01`
- 运行状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 原始需求变更项目

| 变更项 | 变更类型 | 关联历史需求 | 变更前 | 变更后 | 验收影响 |
| --- | --- | --- | --- | --- | --- |
| RC-2-001 | modify | FR-030、AC-028、NFR-005 | Poker 准备面板只去掉 border，外层 shell padding、panel margin/圆角/阴影仍形成一圈空白；头像仅有最小宽高，可能被内容撑成椭圆。 | Poker 准备页从共享顶栏下沿到视口底部形成左右贴边表面，无外部空白、margin、边框、圆角或阴影，内容保留内边距；等待与活动头像锁定相等宽高、1:1 比例和圆形边界。 | AC-C2-001、AC-C2-004 core passed |
| RC-2-002 | modify | FR-025、AC-020、RC-1-002 | 缓存节点不分数量始终锚定首尾并均分轨道，少量面值被拉开。 | 空间充足时节点从左向右按完整筹码直径加正常小间距排列；仅当自然总宽超过轨道时才均匀压缩步长并重叠。首尾完整，面值/数量紧凑，按钮及总额/清空可达。 | AC-C2-002、AC-C2-004 core passed |
| RC-2-003 | modify | FR-028、AC-022、RC-1-003 | 手机玩家轨道用 `2rem/2.4rem` 可见上下 padding 避免裁剪，把卡片明显向下推远。 | 恢复 change-1 前 `.95rem` 可见顶部距离和原 `.35rem` 横向 gap；用抵消后的轨道坐标、独立内部安全区及高于 board 的隔离层完整容纳阴影、焦点和庄家标识。 | AC-C2-003、AC-C2-004 core passed |

## 2. 实现概述

本记录把 change-2 的三项纠错应用到当前 Web：

- `WaitingRoom` 使用 Poker 专属根类；根布局改为“共享顶栏 + 剩余视口”两行 grid，清除
  waiting panel 的外部 chrome。头像基础规则及活动玩家卡覆盖都给出确定相等宽高。
- 缓存 DOM 删除每节点的百分比位置、反向位移和节点计数变量。CSS 让非末 slot 的自然
  basis 等于筹码直径加正常间距且只允许收缩，末 slot 固定完整筹码直径：少量左侧紧邻，
  拥挤时其他 slot 才等比压缩并让最后一枚完整落在右端。
- 手机座位轨道保留原横向 gap，以负向抵消的 top 与增量内部 padding 分离“卡片可见
  位置”和“滚动裁剪空间”；轨道建立隔离层并高于 board，交互/本人/待办卡片再局部抬层。
- 浏览器断言直接比较 waiting/viewport 盒模型、头像比例、3 节点自然步长、16 节点压缩
  步长、旧顶部距离、横向 gap、track 安全余量、阴影、真实 Tab、庄家和层级。

实现只调整 Web DOM/CSS 和 E2E；没有改变命令、游戏状态、资产、秘密投影、SQLite、
依赖、Docker 或部署接口。change-1 的 toast、文字对比、身份位置和数量行紧凑行为保留。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `apps/web/src/main.tsx` | modify | Poker waiting 专用根类；缓存移除无条件百分比均分定位。 |
| `apps/web/src/styles.css` | modify | 贴边准备表面、圆形头像、自然/拥挤两阶段缓存，以及旧卡片间距与独立阴影安全层。 |
| `tests/e2e/core.spec.ts` | modify | 桌面/300px waiting 盒模型、缓存两阶段和手机卡片真实边界回归。 |
| `AGENTS.md` | modify | 同步 change-2 completed 状态、验证范围和正式发布事实边界。 |
| `docs/requirements/game-room-ui-and-poker-hand-start/execution/change-2/change-plan.md` | add | RC-2-001–RC-2-003、core 验收、单阶段路线图和门禁。 |
| `docs/requirements/game-room-ui-and-poker-hand-start/execution/change-2/phase-001-plan.md` | add | P-001 rev 1 compact 阶段计划。 |
| `docs/requirements/game-room-ui-and-poker-hand-start/execution/change-2/phase-001-result.md` | add | P-001 completed / passed 冻结结果。 |
| `docs/requirements/game-room-ui-and-poker-hand-start/execution/change-2/execution-state.md` | add | change-2 completed durable 状态与累计证据。 |
| `docs/requirements/game-room-ui-and-poker-hand-start/effective-requirements.md` | modify | 把三项 RC 应用到当前有效产品权威。 |
| `docs/requirements/game-room-ui-and-poker-hand-start/change-2.md` | add | 冻结本次连续编号需求变更。 |

没有修改 initial、`change-0.md`、`change-1.md`、其他 feature 冻结历史、服务/契约/领域/
规则、SQLite、部署/Docker、真实配置或生成的 `dist/`。

## 4. 需求、阶段与任务完成情况

| 范围 | 状态 | 结果 |
| --- | --- | --- |
| RC-2-001–RC-2-003 | completed | 全部纠错已进入 [effective-requirements.md](effective-requirements.md)。 |
| AC-C2-001–AC-C2-004 core | passed | 准备页贴边/圆形头像、缓存两阶段排布和手机旧间距/完整阴影安全层全部通过。 |
| P-001-T-001 | completed | Web 实现、E2E 和完整发布前回归完成。 |
| P-001 | completed | [phase-001-plan.md](execution/change-2/phase-001-plan.md) rev 1 与 [phase-001-result.md](execution/change-2/phase-001-result.md) 已冻结。 |
| change-2 | completed | 单阶段 compact 运行完成，编号记录与有效需求快照一致。 |

来源指纹为：

- change-2 前有效需求：`sha256:605714942543c3d2bb0b486b58843c75b1bf02506a0c26fa69409b6d8117ce91`
- change plan rev 1：`sha256:7a7c30ed4ed5ee23c21399bfbcc8bd44e49812303cb1997949329d51d575dfdd`
- phase plan rev 1：`sha256:78075830e53f8738bb1fd5d17c43c6151d48d497d5adb6715725b0dcff3e929d`
- phase result：`sha256:a85d10b8ad68616e86f30827a9d1b084582059b2755ef4bccf6bc8d6b410a343`
- change-2 后有效需求：`sha256:e1ef0a78c7f8dcaf6ad88f39caeb9568ae25114716f8f26cf85c5cbcf0e3bce4`

change 编号 0–2 连续，P-001 是本运行唯一阶段；没有 corrective phase、未决问题、部分
迁移、未知 overlap 或 blocking/report-only finding。

## 5. 测试与验证

- 交付与验证策略：`relaxed`。
- 验证结论：`passed`。
- 全部 change-2 core 和计划硬门禁通过，没有使用 report-only 例外。

| 验证 | 结果 |
| --- | --- |
| `npm run lint` | passed。 |
| `npm run typecheck` | passed。 |
| `npm run test:platform` | passed，3 files / 40 tests。 |
| `npm run test:poker` | passed，1 file / 17 tests。 |
| `npm run test:avalon` | passed，1 file / 8 tests。 |
| `npm run test:realtime` | passed，1 file / 5 tests。 |
| `npm run test:capacity` | passed，1 file / 4 tests。 |
| `npm run test:e2e:core` | 最终候选 passed；生产 build/static、Chromium desktop 与 WebKit mobile 共 8/8。 |
| E2E 内置生产构建/静态资源检查 | passed；Web 47 modules、server ESM bundle，2 个 HTML/CSS 文件无公网引用。 |
| 生产 E2E 视觉/交互断言 | passed；waiting 全盒模型、圆形头像、3/16 节点两阶段步长、紧凑数量行、旧顶部距离、原横向 gap、阴影/焦点/庄家安全区和层级全部成立。 |
| `git diff --check` 与文件归属检查 | passed；无空白错误、生成物、秘密、真实配置或无关文件。 |

首次 E2E 的 3 节点断言因把 `.25rem` 误读为 `0.25px` 失败；改为读取浏览器计算后的
slot 像素宽度后 clean-run 8/8。随后精确恢复旧 `.95rem` 顶距并在最终源码再次完整运行
8/8，所有分组回归也在最终候选通过。首次失败后的 WebKit 409 是开放房间造成的级联，
最终运行不再出现。npm 用户级 cache 日志清理的 EPERM 为非失败警告。

## 6. 与路线图及阶段计划的偏差

- change plan 保持 `single + compact` rev 1，P-001 及 P-001-T-001 边界未变。
- 没有需求、变更计划、阶段计划、阶段数或验证策略修订。
- 计划中的“接近旧版小间距”最终收紧为精确的旧版 `.95rem` 可见顶部距离，属于
  RC-2-003/AC-C2-003 内的更严格实现和验证，不增加范围。
- 测试单位换算错误及其级联已在同任务闭环，最终没有开放偏差或 finding。
- 提交与正式发布由用户明确授权，但仅在本记录和 completed state 冻结后执行；部署结果
  属于后续运维事实，不反写成本产品阶段证据。

## 7. 遗留事项

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

没有产品遗留事项。未来产品变化应从 `effective-requirements.md` 建立连续的 `change-3`，
不得改写本记录、阶段结果或 completed execution state。正式发布状态以最近一次受支持部署
输出和只读服务器事实为准。
