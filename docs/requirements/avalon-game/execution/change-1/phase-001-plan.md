# P-001 阶段计划：阿瓦隆 UI 层级、玩家卡交互与独立主题

- 运行编号：`change-1`
- 阶段编号：`P-001`
- 阶段计划修订：`1`
- 父变更计划修订：`1`
- 当前有效需求指纹：`sha256:eeed9136cb86ce4eaf646513a46286c51748e47ca4bd80cc482d25e310bd312e`
- 变更计划指纹：`sha256:62140e9748bd134301888e671f2514d07239716505d639343d84abde672de6e0`
- 项目基线：`main@ec437a4e6d1ebb4e548f4b7a9271fc1e9a412270`
- 创建日期：`2026-07-31`
- 详细程度：`compact`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

P-001 在一个可构建的前端候选中完成 RC-1-001–RC-1-005 和
AC-C1-001–AC-C1-008：统一大厅/加入/创建的游戏信息层级，修正准备区与设置表单几何，
把私密知识和队长选人迁移到上方玩家卡，强化准备/投票/当前行动/本人/队长状态，常态显示
五任务规则，并为 Avalon 增加与 Poker 分离的 light/dark 调色板。

阶段不修改服务命令、领域规则、投影授权、资产、SQLite、部署或真实服务器。现有
`ownKnowledge`、队长 ID、提交 ID 和任务规则是唯一输入；客户端只改变可见呈现和本地草稿。

## 2. 任务与文件范围

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-001-T-001 | 交付共享大厅/加入、Avalon 准备与活动牌桌交互、独立主题及响应式证据 | `packages/contracts/src/product-config.ts`；`apps/web/src/ui.tsx`、`main.tsx`、`avalon-ui.tsx`、`locales.ts`、`styles.css`；`tests/e2e/core.spec.ts`；本 change run 工件 | 增加 `avalon` theme scope；本地化系统游戏名；统一加入摘要；十点准备计与稳定表单；玩家卡私密覆盖/队长选人/准备与提交状态；不对称底部操作区；五任务固定规则；同步 E2E 与视觉检查 | `npm run lint`、`npm run typecheck`、`npm run test:realtime`、`npm run test:e2e:core`、桌面/300px 浏览器检查、`git diff --check` | 全部 AC-C1 core 与 changed-area 硬门禁通过；秘密和服务端权限不退化；Poker 加入/主题正常；无未知文件、阻塞 finding 或横向溢出；实际文件和证据写入 state/result |

任务开始前必须把 state 与本阶段更新为 `in_progress`，记录当前干净基线、目标文件和完成
条件。任务完成并验证前不创建 phase result；P-001 是最终阶段，通过后直接收口 change-1。

## 3. 验证与完成条件

### 3.1 core 行为检查

1. 中文系统标签只显示“阿瓦隆”，英文仍显示 `Avalon`；选择卡没有规则小字；Poker/Avalon
   加入层都居中显示醒目房间名、本地化游戏名和当前人数。
2. 准备卡十圆点从左填充，前五空位实线、后五空位虚线；开始按钮在底部；设置控件不被拉伸。
3. 按住私密按钮时，上方对应卡显示本人角色/合法关系；松开及现有安全事件后隐藏；display
   没有私密 DOM 或操作。
4. 队长用上方玩家卡选人并保留 `aria-pressed`；右下仅提交。准备、待投票、已投票、本人、
   队长和当前行动层级符合 RC-1-003，队长/本人重合时队长色优先。
5. 五任务始终显示人数/失败阈值，当前任务使用队长色填充；结果文字与规则同时保留。
6. HTML `data-theme-scope` 在大厅/Poker/Avalon 分别为 `main`/`poker`/`avalon`，Avalon
   light/dark 调色板与 Poker 不同且焦点、按钮、文字可读。

### 3.2 自动化和浏览器门禁

- `npm run lint`
- `npm run typecheck`
- `npm run test:realtime`
- `npm run test:e2e:core`（包含生产 build/static 与 Chromium/WebKit 核心流程）
- `git diff --check`
- 本地生产页面桌面和 300px 浏览器视觉/交互检查

若 E2E 后修改任何构建输入，必须重跑受影响的 E2E/build。`test:platform`、`test:avalon`、
`test:poker`、capacity、Docker 和 deploy 默认不运行，因为本阶段不改变服务/规则/容量/
容器/发布接口；实际差异触及这些边界时先修订计划并加入相应门禁。

`relaxed` 不要求 red-first，但全部上述 core、隐私、Poker 兼容、可访问性和构建门禁阻塞。
既有 supplemental 异常只有在独立证据证明无交付影响时才能以 `FND-C1-*` 保留。

## 4. 风险、恢复与修订记录

- 私密状态只在当前组件内由 `secretVisible` 控制，继续响应 pointer/key release、
  `visibilitychange`、blur、offline、版本和阶段变化；任何失败优先检查 DOM 是否残留秘密。
- 队长提名期间玩家卡是唯一选择控件，避免嵌套房主管理按钮；退出提名阶段后本地选择随
  Avalon version 清空。
- 主题改动仅增加 `avalon` scope；若出现无色变量或 Poker 回归，恢复 scope 判别和新增
  palette 即可，不涉及数据回滚。
- 当前没有用户 overlap。中断时保留 diff，把 state 保持 `in_progress` 并记录最后通过的
  命令、未完成验收和下一条精确动作；不得 reset、checkout 或 stash。

| 修订 | 日期 | 结论与依据 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-31 | 初次 just-in-time compact 计划；单一前端交付面和无迁移风险支持一个任务。 | 建立 P-001-T-001、core 检查、changed-area 自动化与实际浏览器验收。 |
