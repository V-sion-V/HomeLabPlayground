# P-001 阶段结果：Poker 贴边、缓存与座位轨道纠错

- 运行编号：`change-2`
- 阶段编号：`P-001`
- 阶段计划：[phase-001-plan.md](phase-001-plan.md)
- 阶段计划修订：`1`
- 父变更计划修订：`1`
- 完成日期：`2026-08-01`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：`main@d1dfadf47d1315efec9cb0b955cae5c5c5cea1dc`
- 结束基线：上述 HEAD 加本结果所列未提交候选差异；用户授权的提交与正式部署在工作流冻结后单独执行

## 1. 阶段目标与结果

P-001 的唯一任务 `P-001-T-001` 已完成，RC-2-001–RC-2-003 在同一个 Web 候选中交付：

- Poker 等待页新增专用根类，以顶栏和剩余页面组成无外圈的两行 grid；顶栏与主表面
  左右贴合视口，主表面紧接顶栏并至少填满剩余高度，外部 margin、边框、圆角和阴影
  全部清除，仅保留内容内边距。基础头像和活动 Poker 头像均锁定相等宽高、1:1 比例及
  圆形边界，不再受文字行高撑成椭圆。
- 下注缓存删除 React 的首尾百分比绝对定位，改为只收缩不增长的 flex slot。空间充足时
  节点从左侧按完整筹码直径加正常小间距排列；自然总宽超过轨道后，非末 slot 才等比
  收缩并形成均匀重叠，末节点保持完整直径，使首尾、面值、数量及按钮都位于轨道内。
- 手机玩家轨道恢复 change-1 前 `.95rem` 的可见顶部距离及原 `.35rem` 横向 gap；轨道
  自身使用抵消后的坐标和独立上下裁剪安全区，并提高到 board 之上的隔离层。卡片阴影、
  真实 Tab 焦点及庄家标识完整显示，卡片没有因安全 padding 再次被向下推远。
- E2E 用视口盒模型、头像实际比例、少量节点自然步长、拥挤节点压缩步长、旧顶部距离、
  裁剪安全余量和层级直接验证用户描述，不再沿用 change-1 的代理断言。

全部 AC-C2-001–AC-C2-004 core 与计划硬门禁通过。change-1 已正确交付的 toast、玩家卡
身份位置/文字对比、紧凑数量行和旁观者避让保留；服务命令、游戏规则、投影、资产、
SQLite、Docker 和部署接口没有改变。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 需求与验收 | 完成证据 |
| --- | --- | --- | --- |
| P-001-T-001 | completed | RC-2-001–RC-2-003；AC-C2-001–AC-C2-004 core | lint、typecheck、platform/server 40/40、Poker 17/17、Avalon 8/8、realtime 5/5、capacity 4/4、最终生产 Chromium/WebKit 8/8、桌面/300px 两阶段缓存和盒模型几何及差异卫生全部通过 |

| 验收 | 状态 | 可观察结果 |
| --- | --- | --- |
| AC-C2-001 | passed | 桌面与 300px 下 waiting shell、顶栏和主表面左右边界与视口一致；主表面紧接顶栏、填满剩余高度，外部 margin/border/radius/shadow 为零；头像实际宽高相等且圆角达到半径。 |
| AC-C2-002 | passed | 300px 下 3 个不同面值从轨道左端按计算后的自然 slot 步长排列并留下右侧空间；16 个面值时相邻步长小于自然步长、离散差不超过 1.5px，首尾贴合轨道且全部按钮可键盘操作；面值/数量间距不超过 1px。 |
| AC-C2-003 | passed | 300px 下卡片可见顶部距离为旧版目标范围 14–17px，横向 gap 为 4–8px；track 上/下安全余量分别至少 14/20px，层级高于 board，非空阴影、真实 Tab 轮廓和庄家标识均位于 track/felt 内，document 宽度等于 300px。 |
| AC-C2-004 | passed | 全部计划内静态、领域、服务、实时、容量、生产构建/静态资源、双浏览器和 diff 门禁通过，无 toast、对比、开手、秘密、权限、资产、恢复或部署接口回归。 |

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `apps/web/src/main.tsx` | modify | 为 Poker waiting 增加专用根类；移除缓存节点的无条件百分比均分和布局计数变量。 |
| `apps/web/src/styles.css` | modify | waiting 贴边表面、确定圆形头像、缓存自然排列/拥挤压缩，以及手机轨道旧可见间距、裁剪安全区和层级。 |
| `tests/e2e/core.spec.ts` | modify | 直接验证 waiting 盒模型/头像、缓存宽松与拥挤两阶段、旧卡片间距、阴影/焦点/庄家边界和层级。 |
| `AGENTS.md` | modify | 同步 change-2 completed 状态、验证范围和正式发布事实边界。 |
| `execution/change-2/change-plan.md` | add | RC-2-001–RC-2-003、core 验收、单阶段设计与 `relaxed` 门禁。 |
| `execution/change-2/phase-001-plan.md` | add | P-001 rev 1 compact just-in-time 阶段计划。 |
| `execution/change-2/phase-001-result.md` | add | 本阶段 completed / passed 冻结结果。 |
| `execution/change-2/execution-state.md` | add | change-2 durable 状态；收口时更新为 completed。 |
| `effective-requirements.md` | modify | 把三项纠错应用到当前有效产品权威与来源链。 |
| `change-2.md` | add | 冻结本次连续编号需求变更。 |

没有修改 change-0/change-1 或 initial 的冻结证据、其他 feature 历史、文案字典、服务/
契约/领域/规则、SQLite、部署脚本、Docker 接口、真实配置或生成的 `dist/`。

## 4. 测试与验证

| 类型 | 命令或检查 | 观察结果 |
| --- | --- | --- |
| 静态质量 | `npm run lint` | passed。 |
| 类型 | `npm run typecheck` | passed。 |
| 平台/服务 | `npm run test:platform` | passed，3 files / 40 tests。 |
| Poker 规则回归 | `npm run test:poker` | passed，1 file / 17 tests。 |
| Avalon 规则回归 | `npm run test:avalon` | passed，1 file / 8 tests。 |
| 实时投影 | `npm run test:realtime` | passed，1 file / 5 tests。 |
| 容量 | `npm run test:capacity` | passed，1 file / 4 tests。 |
| 核心浏览器 | `npm run test:e2e:core` | 最终候选 passed；生产 build/static、Chromium desktop 与 WebKit mobile 共 8/8。 |
| 构建/静态资源 | 上述 E2E 内置 `npm run build` 与静态检查 | passed；Web 47 modules、server ESM bundle，2 个 HTML/CSS 文件无公网资源。 |
| 视觉/交互几何 | 上述生产 E2E 的桌面与 300px 页面 | passed；waiting 全盒模型、圆形头像、3 节点自然左排、16 节点拥挤压缩、旧顶部间距、横向 gap、阴影安全区、层级、真实 Tab 和庄家边界成立。 |
| 差异卫生 | `git diff --check`、`git status --short` 与归属检查 | passed；无空白错误、生成物、真实配置或无关文件。 |

首次完整 E2E 在新的 3 节点断言处失败，原因是测试对 CSS 自定义属性 `.25rem` 使用
`parseFloat` 后误当作 `0.25px`，而浏览器实际计算间距为 `4px`；实现本身已经按自然
间距排列。断言改为读取 slot 的计算像素宽度后完整 8/8。随后又把玩家卡可见顶部位置
从近似紧凑值精确恢复为 change-1 前 `.95rem`，并在最终源码再次完整运行 8/8。首次失败
后的 WebKit 管理员 409 是开放 Poker 房间造成的级联；clean-run 不再出现。

最终 CSS/测试源码之后重跑 lint、typecheck、platform、Poker、Avalon、realtime 和
capacity，全部退出码为 0。npm 用户级 cache 日志清理产生非失败 EPERM 警告，不影响
任何门禁结论。

## 5. 发现项与处置

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

错误的 `rem` 测试换算及其级联不是最终产品 finding：根因已被精确定位并修正，最终候选
在两个浏览器的 clean-run 和所有分组回归中均通过。没有使用 `relaxed` report-only 例外。

## 6. 决策、计划偏差与恢复记录

- 用户原始连续请求明确选择 `relaxed` 并授权完成后提交、正式部署；本纠错运行沿用该
  明确策略与授权。全部 core 和硬门禁实际通过，没有降级任何视觉问题。
- 变更保持 `single + compact` rev 1，没有新增阶段、任务、计划修订或纠正阶段。
- change plan 最初写为“接近 change-1 前的小顶部间距”；实现审计后将最终值精确恢复
  为旧版 `.95rem`，这是既有 RC-2-003/AC-C2-003 内的收紧，不改变范围或路线图。
- 没有用户 overlap、数据迁移、未知文件、外部状态变化或部分提交。

## 7. 遗留风险与下一阶段进入条件

没有开放 finding、未决问题、阻塞风险或下一执行阶段。P-001 是 change-2 的最终阶段；
本结果冻结后生成 `change-2.md`、更新 `effective-requirements.md` 并把 durable state 标记为
`completed`。提交和正式服务器发布按用户授权在工作流冻结后执行，不作为本阶段通过证据。
