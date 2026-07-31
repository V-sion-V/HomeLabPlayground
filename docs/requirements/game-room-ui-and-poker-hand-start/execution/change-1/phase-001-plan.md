# P-001 阶段计划：Poker 视觉修复与全局临时提示

- 运行编号：`change-1`
- 阶段编号：`P-001`
- 阶段计划修订：`1`
- 父变更计划修订：`1`
- 当前有效需求指纹：`sha256:7060e8aa69f42c79b5d9ffe019323235b1f9e879569c389dcc36c8248329d504`
- 变更计划指纹：`sha256:1ed77a8dee217d21a46c4c466d32f8c94c865da6d42da5e2d599daabee141082`
- 项目基线：`main@4b305b2c3c77e0a88036692143a7a3fd48ba33ef`
- 创建日期：`2026-07-31`
- 详细程度：`compact`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

P-001 在一个可构建的 Web 候选中完成 RC-1-001–RC-1-004 与
AC-C1-001–AC-C1-006：移除 Poker 准备页外框，修复玩家卡强调填充的文字对比与身份
布局，重做全宽且按面值节点数动态排布的下注缓存，保留手机卡片视觉安全空间，并把跨
普通/游戏/管理员页面的瞬时操作结果迁移到左上角可关闭、自动消失、最新在上的 toast。

阶段不修改服务命令、领域/Poker/Avalon 规则、投影、资产、SQLite、Docker 或部署接口。
用户授权的提交与正式发布仅在本阶段完成、change-1 冻结后执行，不作为阶段通过证据。

## 2. 任务与文件范围

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-001-T-001 | 交付 Poker 准备/玩家卡/缓存/手机视觉修复与全局 transient toast，并形成发布前证据 | `apps/web/src/ui.tsx`、`main.tsx`、`admin-ui.tsx`、`avalon-ui.tsx`、`styles.css`；必要的 `locales.ts`；`tests/e2e/core.spec.ts`；本 change run 工件 | 建立共享 toast provider/portal 与有界计时队列；删除布局内 notice；调整 Poker 卡片身份网格和强调前景；移除准备外框；以当前缓存面值节点数驱动全宽等距网格并压紧数量行高；扩大手机轨道视觉安全区；同步浏览器断言 | `npm run lint`、`npm run typecheck`、`npm run test:platform`、`npm run test:poker`、`npm run test:avalon`、`npm run test:realtime`、`npm run test:e2e:core`、`npm run test:capacity`、`git diff --check` | 全部 AC-C1 core 与项目硬门禁通过；两种主题/浏览器和 300px 的颜色、顺序、计时、16 面值与几何成立；秘密、权限、资产和缓存权威边界不退化；实际文件和证据写入 state/result |

任务开始前必须把 state 与本阶段更新为 `in_progress`，记录干净基线、目标文件和完成条件。
任务完成并验证前不创建 phase result；P-001 是最终阶段，通过后直接收口 change-1。

## 3. 验证与完成条件

### 3.1 core 行为检查

1. Poker 准备主面板无外圈边框；活动玩家卡的在线状态位于头像右侧昵称下方，尺寸更
   紧凑；普通/本人/行动待办叠加时全部文字在 light/dark 中具有可读前景并保留 ARIA。
2. 缓存贴合 felt 左右安全边距；1、多个及最多 16 个不同面值节点按实际节点数等距，
   首尾完整、相邻中心间距一致、总额/清空可达，面值和数量行高紧凑。
3. 300px 与常见手机宽度下，横向座位轨道为阴影、焦点轮廓和庄家标识保留安全边界，
   卡片可横滚/吸附/管理且 `documentElement.scrollWidth === innerWidth`。
4. 运行时操作反馈只出现于视口左上角 fixed toast，不改变页面主内容位置；多条按最新在上
   排列，每条关闭按钮可键盘/触控使用，并在约 5 秒后自动移除。
5. 连接接管后原页面立即遮盖私牌并显示 toast；普通命令和管理员反馈使用同一机制；字段
   校验、静态警告和确认对话框仍在原上下文。

### 3.2 自动化和浏览器门禁

- `npm run lint`
- `npm run typecheck`
- `npm run test:platform`
- `npm run test:poker`
- `npm run test:avalon`
- `npm run test:realtime`
- `npm run test:e2e:core`（包含生产 build/static 与 Chromium/WebKit 核心流程）
- `npm run test:capacity`
- `git diff --check`

若 E2E 后修改构建输入，必须重跑受影响的 E2E/build。`test:deploy` 和 Docker smoke 默认
不作为产品阶段重复门禁，因为源码不改变部署/容器接口；正式部署将由受支持入口构建并
执行健康/恢复状态机。实际差异触及这些边界时先修订计划。

`relaxed` 不要求 red-first，但全部 core、隐私、权限、资产、恢复、可访问性、构建与发布
前硬门禁阻塞。既有 supplemental 异常只有在独立证明无交付影响时才能以 `FND-C1-*`
保留。

## 4. 风险、恢复与修订记录

- toast 只接管瞬时 `notice`；不要把字段错误、危险影响说明或确认对话框变成短时提示。
- 每个 toast 的 timer 必须在手动关闭与 provider 卸载时清理；空消息不入队，队列 DOM
  始终有界于自动消失窗口。
- 动态筹码排布只依据不同面值节点数和可用 CSS 宽度，不读取或复制实际筹码数量，也不
  改变缓存金额、失效或提交逻辑。
- 卡片压缩不得删除房主菜单目标、本人/行动文字、庄家标识、长名称省略或焦点轮廓。
- 当前没有用户 overlap。中断时保留 diff，把 state 保持 `in_progress`，记录最后通过的
  命令、未完成验收和下一条精确动作；不得 reset、checkout 或 stash。

| 修订 | 日期 | 结论与依据 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-31 | 初次 just-in-time compact 计划；四项客户端增量共享一个无迁移交付面，适合单任务。 | 建立 P-001-T-001、core 检查、完整相关回归与发布前门禁。 |
