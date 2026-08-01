# 游戏房间界面统一与德州扑克开手体验：change-3

- 修改编号：`change-3`
- 修改类型：`需求纠错`
- 状态：`completed`
- 验证结论：`passed`
- 交付与验证策略：`relaxed`
- 日期：`2026-08-01`
- 变更前有效需求指纹：`sha256:e1ef0a78c7f8dcaf6ad88f39caeb9568ae25114716f8f26cf85c5cbcf0e3bce4`
- 变更计划指纹：`sha256:d3b26113eabd92a8c12b732d3e8f2a33ebe2a3586cf2c2a7f727a70d31719324`
- 阶段计划指纹：`sha256:58c2e2d1d05cab028ba08eb7af004e1cfa45819babf8c8a57d77ee9d1764d6cb`
- 阶段结果指纹：`sha256:f3ccaea0e16fcc82d733ab93685ad795e02a83fc76a0192a95db8b09162ea9e1`
- 项目基线：`main@ae347cc6982e3de2de872b6c0629c2b830ef7a0b`

## 1. 修改原因

change-2 只对手机玩家卡恢复了紧凑间距，桌面仍使用五列/三列居中网格，并在 760px、600px 和 520px 叠加不同 inset、padding、卡宽及 grid/flex 切换。结果是桌面首卡左距与卡间距不一致，卡间距可能约为左距两倍，缩放到手机时产生多次跳变；直接放大间距虽能缓解裁剪，却不符合紧凑布局。

本修改不改写 change-2 历史，而是把桌面与手机统一为同一连续几何，并以跨断点真实矩形回归替换“只检查 300px”的不足。

## 2. 已生效需求增量

| ID | 类型 | 关联需求 | 生效内容 | 验收 |
| --- | --- | --- | --- | --- |
| RC-3-001 | modify | FR-028、AC-022、NFR-005 | Poker 上方玩家卡在全部受支持视口使用同一横向 flex/scroll 轨道；可见顶部距、首卡左距和相邻卡 gap 使用同一个固定间距并保持不变。轨道以独立裁剪 padding、负向顶部抵消和层级容纳阴影、焦点与庄家标识，不通过放大可见间距规避裁剪。 | AC-C3-001、AC-C3-002 core |
| RC-3-002 | modify | FR-028、AC-022、NFR-005 | 卡片宽度可随视口连续增长，桌面最大宽度不超过手机宽度两倍；卡间距不随桌面扩大，旧 760/600/520px 断点不再切换玩家轨道布局或造成几何跳变。 | AC-C3-002 core |

最终实现使用 `.6rem` 固定间距和 `clamp(6.8rem, 16vw, 9.25rem)` 卡宽；桌面上限约为手机下限的 1.36 倍。横向空间不足时仍由玩家轨道滚动承载，页面本身不横向溢出。

## 3. 验收与证据

| 验收 | 层级 | 结果 |
| --- | --- | --- |
| AC-C3-001 | core | passed；Chromium/WebKit 在 1280、900、761/760、601/600、521/520、300px 下均为 flex/auto 横轨，top/left/gap 在每个视口及全部视口间互差不超过 1px，document width 不超过 viewport。 |
| AC-C3-002 | core | passed；三组旧断点两侧的间距和卡宽变化不超过 1px，桌面卡宽大于手机且小于手机两倍；卡片同排同宽，阴影非空，dealer、真实 Tab focus 和安全区完整，track 层级高于 board。 |
| AC-C3-003 | core | passed；lint、typecheck、realtime 5/5、生产 build/static、Chromium/WebKit E2E 8/8 和 diff 检查通过。 |

详细不可变阶段证据见 [phase-001-result.md](execution/change-3/phase-001-result.md)。没有 report-only 例外、开放 finding、未解释偏差或未知影响。

## 4. 影响与非影响范围

修改文件为 `apps/web/src/styles.css`、`tests/e2e/core.spec.ts` 以及本 feature 的 change-3 工作流工件和权威快照。旧 `.table-seats` desktop grid、760px 三列、520px flex 和 600px 几何覆盖已删除；匿名 `.display-seats` 保持既有网格响应式行为。

没有修改服务命令、Poker/Avalon 规则、投影、资产、SQLite、数据迁移、翻译字典、运行时依赖、Docker 或部署接口。提交、推送和正式服务器发布不属于本修改的产品验收，且本轮未获授权、未执行。

## 5. 验证选择

- 已运行：`npm run lint`、`npm run typecheck`、`npm run test:realtime`、`npm run test:e2e:core`、`git diff --check`。
- 核心 E2E 内含生产 build、静态资源无公网引用、Chromium desktop、WebKit mobile 及 Poker/Avalon/display 完整流程。
- 未重复运行 platform/Poker/Avalon 单元、capacity、deploy 和 Docker smoke；本修改没有触及这些层的源码或接口，阶段计划已将其判定为非受影响门禁。

change-3 completed / passed。后续任何产品变化必须从新的连续 `change-4` 运行开始，不得改写本记录或其阶段证据。
