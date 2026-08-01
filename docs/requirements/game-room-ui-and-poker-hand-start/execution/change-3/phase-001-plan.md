# P-001 阶段计划：Poker 玩家卡连续几何

- 运行编号：`change-3`
- 阶段编号：`P-001`
- 阶段计划修订：`1`
- 父变更计划修订：`1`
- 当前有效需求指纹：`sha256:e1ef0a78c7f8dcaf6ad88f39caeb9568ae25114716f8f26cf85c5cbcf0e3bce4`
- 变更计划指纹：`sha256:d3b26113eabd92a8c12b732d3e8f2a33ebe2a3586cf2c2a7f727a70d31719324`
- 项目基线：`main@ae347cc6982e3de2de872b6c0629c2b830ef7a0b`
- 创建日期：`2026-08-01`
- 详细程度：`compact`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标与边界

P-001 在一个可构建的 Poker Web 候选中完成 RC-3-001～RC-3-002 与 AC-C3-001～AC-C3-003：所有宽度共享一条横向玩家卡轨道；可见顶部、左侧和相邻卡使用相同固定间距；卡宽只连续增长且桌面不超过手机两倍；旧断点不再触发布局或间距跳变；阴影、焦点、庄家标识和层级安全继续成立。

阶段只修改 Web CSS、E2E 与本 change run 工件。服务命令、规则、投影、资产、SQLite、依赖、Docker 和部署接口均不变；本轮没有提交或正式部署授权。

## 2. 任务与文件范围

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-001-T-001 | 交付连续玩家卡轨道并形成验证证据 | `apps/web/src/styles.css`、`tests/e2e/core.spec.ts`；`AGENTS.md` 与本 change run 工件 | 以统一 flex/scroll 规则覆盖旧 grid/断点几何；一个间距变量驱动可见 top/left/gap；连续 clamp 控制卡宽；安全 padding、负向 top 与 z-index 独立保护装饰 | 目标 Poker E2E；随后 lint、typecheck、realtime、完整 E2E/build/static、diff | 多视口固定间距、断点连续性、卡宽比例、阴影/焦点/庄家/层级和无页面横溢全部成立；既有关键流程通过；实际文件与证据写入 state/result |

本计划及父计划已在产品编辑前置为 `in_progress`。最终验证前不创建 phase result；P-001 是 change-3 的最终阶段。

## 3. core 检查与自动化门禁

1. 在桌面、旧断点两侧和 300px 下读取真实卡片矩形；每个视口的可见 top gap、left gap 与相邻 card gap 在 1px 容差内相等，且该固定间距在所有视口间不漂移。
2. 每个视口都使用 flex/scroll；跨 761/760、601/600、521/520px 的 1px 缩放不产生布局模式、间距或卡宽跳变。桌面最大卡宽不超过 300px 卡宽两倍，页面没有横向溢出。
3. 轨道保留足够 clip 安全余量，层级高于 board；box-shadow 非 none、庄家标识在安全边界内，真实 Tab `focus-visible` 完整，横向滚动和玩家卡交互继续可用。
4. Poker 开手、下注缓存、toast、玩家卡内容/管理手势、Avalon、公屏、秘密信息和资产相关既有回归不退化。

计划门禁：

- 改变行为的目标 Chromium/WebKit Poker 用例
- `npm run lint`
- `npm run typecheck`
- `npm run test:realtime`
- `npm run test:e2e:core`（生产 build/static、Chromium desktop、WebKit mobile）
- `git diff --check`

如果差异触及服务器、领域、容量、容器或部署代码，先修订计划并加入相应测试。`relaxed` 不要求 red-first，但以上 core、构建、隐私、资产、可访问性与未知影响全部阻塞；下一 finding ID 为 `FND-C3-001`。

## 4. 风险、恢复与修订记录

- 统一规则必须晚于遗留媒体查询或直接移除其 `.table-seats` 覆盖，避免 cascade 中仍有隐式跳变。
- 可见间距与裁剪安全余量分别测量；安全 padding 不得把卡片再次推离 felt。
- 卡宽连续公式应只影响卡片，不影响固定 gap；横向空间不足时由轨道滚动承载。
- 当前没有用户 overlap。中断时保留 diff，state 维持 `in_progress` 并记录最后通过证据；不 reset、checkout 或 stash。

| 修订 | 日期 | 结论与依据 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-08-01 | 同一无迁移 Web 布局使用 single + compact；以跨断点真实几何直接覆盖用户指出的桌面偏差与缩放跳变。 | 建立 P-001-T-001 和比例足够的 Web 发布前门禁。 |
