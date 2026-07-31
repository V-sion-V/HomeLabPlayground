# P-001 阶段计划：Poker 贴边、缓存与座位轨道纠错

- 运行编号：`change-2`
- 阶段编号：`P-001`
- 阶段计划修订：`1`
- 父变更计划修订：`1`
- 当前有效需求指纹：`sha256:605714942543c3d2bb0b486b58843c75b1bf02506a0c26fa69409b6d8117ce91`
- 变更计划指纹：`sha256:7a7c30ed4ed5ee23c21399bfbcc8bd44e49812303cb1997949329d51d575dfdd`
- 项目基线：`main@d1dfadf47d1315efec9cb0b955cae5c5c5cea1dc`
- 创建日期：`2026-08-01`
- 详细程度：`compact`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

P-001 在一个可构建的 Poker Web 候选中完成 RC-2-001–RC-2-003 和
AC-C2-001–AC-C2-004：让等待页真正贴边且头像保持圆形，让缓存少量节点自然从左排列、
只在拥挤时动态压缩，让手机上方玩家卡恢复紧凑视觉位置并用独立裁剪安全区和层级完整
显示阴影、焦点与庄家标识。

阶段只修改 `apps/web` 布局和 E2E，不改变服务命令、Poker/Avalon 规则、投影、资产、
SQLite、依赖、Docker 或部署接口。提交和正式部署只在阶段/变更冻结后执行，不作为阶段
通过证据。

## 2. 任务与文件范围

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-001-T-001 | 交付三项 Poker 布局纠错并形成发布前证据 | `apps/web/src/main.tsx`、`apps/web/src/styles.css`、`tests/e2e/core.spec.ts`；`AGENTS.md` 与本 change run 工件 | waiting 根语义类和贴边 grid；头像确定正方形；缓存 flex 自然 basis/受限 shrink；手机轨道负向起点、小可见顶距、clip padding 和 stacking；用行为几何替换错误断言 | 目标 Poker E2E；随后 lint、typecheck、platform、Poker、Avalon、realtime、完整 E2E/build/static、capacity、diff | 少量/拥挤缓存两阶段排布、waiting 盒模型/头像比例、紧凑座位视觉位置/完整安全余量全部成立；既有 toast、对比、开手和双游戏回归通过；实际文件与证据写入 state/result |

任务开始前把 state 与父计划阶段状态更新为 `in_progress`，记录干净基线、目标文件和完成
条件。最终验证前不创建 phase result；P-001 是 change-2 的最终阶段。

## 3. 验证与完成条件

### 3.1 core 行为检查

1. waiting shell/header/panel 左右边界与视口一致，panel 顶边紧接 header 且填满剩余高度，
   外部 margin/radius/shadow 为零；等待头像和 active 卡片头像实际宽高相等。
2. 在宽度充足时，1–3 个缓存节点从左端以自然步长排列且不使用剩余宽度；在 300px、
   16 节点时步长小于自然步长并保持均匀，首尾、所有按钮、总额和清空在边界内。
3. 300px 上方卡片距 felt 顶边保持小间距，横向 gap 仍约 `.35rem`；track 在卡片上/下有
   足量裁剪安全余量且其层级高于 board、低于 cache/开手层。阴影非空、庄家在 felt/
   track 内、真实 Tab focus-visible 完整，document 无横溢。
4. change-1 已正确交付的 toast、身份位置、强调文字对比和紧凑数量行不退化；Poker 开手、
   下注提交、观众管理、Avalon 及公共大屏流程继续通过。

### 3.2 自动化和浏览器门禁

- 改变行为的目标 Chromium/WebKit Poker 用例
- `npm run lint`
- `npm run typecheck`
- `npm run test:platform`
- `npm run test:poker`
- `npm run test:avalon`
- `npm run test:realtime`
- `npm run test:e2e:core`（生产 build/static、Chromium desktop 与 WebKit mobile）
- `npm run test:capacity`
- `git diff --check`

若 E2E 后修改构建输入，必须重跑受影响的 E2E/build。`test:deploy` 与 Docker smoke 不重复
作为产品阶段门禁，因为差异不触及部署/容器接口；正式部署入口会独立执行远端 build、
backup、switch、health 和 recovery 状态机。

`relaxed` 不要求 red-first，但全部 core、构建、隐私、资产、兼容和发布前硬门禁阻塞。
下一可用 finding ID 为 `FND-C2-001`；不得把未知视觉影响降级为 report-only。

## 4. 风险、恢复与修订记录

- waiting 选择器必须限定 `.poker-waiting-shell`，不能让大厅/Avalon 的 card shell 贴边。
- flex slot 只收缩不增长；末 slot 固定一个筹码直径，保证拥挤时右端点完整。
- track 的内部安全 padding 不能再次表现为可见大间距；通过负向 top 抵消，并同时测量
  felt 可见顶距与 track clip 余量。
- 座位层只高于 board/spectator，继续低于 cache、hand-start、hole-card 和 settlement。
- 当前无用户 overlap。中断时保留 diff，state 保持 `in_progress` 并记录最后通过证据；
  不 reset、checkout 或 stash。

| 修订 | 日期 | 结论与依据 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-08-01 | 三项纠错属于同一无迁移 Poker Web 交付面，采用 single + compact；验收分别覆盖宽松和拥挤状态，避免再次由代理指标产生误判。 | 建立 P-001-T-001 和完整相关发布前门禁。 |
