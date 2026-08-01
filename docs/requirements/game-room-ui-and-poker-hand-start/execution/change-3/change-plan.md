# 游戏房间界面统一与德州扑克开手体验 change-3：玩家卡连续几何变更计划

- 运行编号：`change-3`
- 运行类型：`需求变更`
- 目标记录：`change-3.md`
- 变更计划修订：`1`
- 当前有效需求：[../../effective-requirements.md](../../effective-requirements.md)
- 当前有效需求指纹：`sha256:e1ef0a78c7f8dcaf6ad88f39caeb9568ae25114716f8f26cf85c5cbcf0e3bce4`
- 项目基线：`main@ae347cc6982e3de2de872b6c0629c2b830ef7a0b`
- 创建日期：`2026-08-01`
- 详细程度：`compact`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`
- 下一可用发现项：`FND-C3-001`

## 1. 变更说明与待生效增量

change-2 只约束了 300px 手机视口，没有消除桌面网格与 760px、600px、520px 多组媒体查询叠加形成的几何差异。当前桌面卡片在网格列中居中，导致首卡左距、相邻卡距和顶部距离不相等；缩放时还会在列数、轨道 padding 和 grid/flex 模式之间多次跳变。本运行保留 change-0～2 的冻结历史，只修正当前 Poker 活动牌桌上方玩家卡轨道及其回归断言。

| 变更项 | 类型 | 关联当前需求 | 变更前 | 待生效结果 | 验收影响 |
| --- | --- | --- | --- | --- | --- |
| RC-3-001 | modify | FR-028、AC-022、NFR-005 | 手机使用紧凑 flex 轨道，桌面仍使用居中 grid；多个断点分别改变列数、inset、padding、卡宽和布局模式 | 所有受支持视口共用一条横向 flex/scroll 轨道；卡片可见顶部距离、首卡左距和相邻卡 gap 使用同一个固定间距，并在缩放时保持不变；裁剪安全区和层级独立容纳阴影、焦点与庄家标识 | AC-C3-001、AC-C3-002 core |
| RC-3-002 | modify | FR-028、AC-022、NFR-005 | 桌面卡宽和卡间距都随网格列宽显著扩大，跨断点突变 | 卡宽可随视口连续增长，并限制在手机宽度的两倍以内；卡间距不随桌面宽度扩大；跨旧断点前后没有布局模式或间距跳变 | AC-C3-002 core |

### 变更验收

| 验收 | 层级 | 可观察结果 |
| --- | --- | --- |
| AC-C3-001 | core | 从 300px 手机到桌面视口，玩家卡可见顶部距、首卡左距和相邻卡距在像素容差内彼此相等，并且各视口之间保持同一固定值；轨道继续横向滚动，无页面横向溢出。 |
| AC-C3-002 | core | 卡片宽度在视口缩放时连续变化，桌面最大卡宽不超过手机卡宽两倍；跨 760/600/520px 旧断点前后不改变布局模式、不放大间距且没有明显几何跳变；阴影、真实键盘焦点和庄家标识仍完整，轨道层级继续高于中心牌面。 |
| AC-C3-003 | core | lint、typecheck、realtime、生产 Chromium/WebKit E2E（含 build/static）和 `git diff --check` 通过；Poker 开手、下注缓存、玩家卡管理手势、秘密信息与资产行为不回归。 |

## 2. 当前事实与设计

- schema 为 `3.2`；`change-0.md`～`change-2.md` 编号连续，change-2 completed，effective snapshot 指纹与 completed state 一致；规划前工作区 clean，没有用户改动或活动 change run。
- 基础 `.table-seats` 使用五列 grid；760px 改为三列，520px 改为 flex；后置 600px 规则再次改变 inset、padding 与卡宽。这是三次跳变和桌面首距/卡距不等的直接原因。
- P-001 将 `.table-seats` 收敛为所有宽度共享的 flex/scroll 轨道。一个 CSS 间距变量同时控制可见顶部、左侧和 gap；内部裁剪 padding 由轨道负向顶部坐标抵消，因此安全区不会表现为额外可见间距。
- 卡片宽度使用有上下限的连续值，手机下限沿用紧凑宽度，桌面上限远低于两倍约束。旧媒体查询不再改变 `.table-seats` 的布局模式、间距或卡宽。
- 不修改服务命令、Poker/Avalon 规则、投影、资产、SQLite、运行时依赖、Docker 或部署接口。本次用户只授权修改，未授权提交、推送或正式部署。

## 3. 阶段路线图

| 阶段 | 目标 | 关联需求与验收 | 前置阶段 | 退出条件 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| P-001 | 统一 Poker 玩家卡轨道连续几何并形成可交付候选 | RC-3-001～RC-3-002；AC-C3-001～AC-C3-003；FR-028、AC-022、NFR-005 | 无 | 跨桌面、手机及旧断点几何回归和相关门禁通过；无阻塞 finding 或未知影响；可生成 phase result、change-3 与新 effective snapshot | in_progress |

变更只涉及同一无迁移 Poker Web 布局与一组浏览器断言，采用 `single + compact` 和一个连贯任务。

## 4. 跨阶段约束与验证流程

- 玩家卡轨道仍是唯一横向滚动所有者；不得用页面横向溢出、扩大可见 padding、删除阴影/焦点/庄家标识或增大卡间距规避裁剪。
- 桌面允许卡片变宽，但间距与视口无关，最大桌面卡宽不得超过手机宽度两倍；布局不得在旧断点切换 grid/flex。
- 轨道只高于 board/spectator，继续低于下注缓存、开手、私牌和结算层；玩家卡点击、长按、右键与键盘管理行为保持。
- E2E 在 1280px、旧断点两侧与 300px 采样真实几何，直接比较顶部/左侧/gap、卡宽连续性、安全区、层级和 document width，而不是以单一媒体查询或代理属性代替验收。
- 先运行目标 Poker E2E，再运行 `npm run lint`、`npm run typecheck`、`npm run test:realtime`、`npm run test:e2e:core` 和 `git diff --check`。E2E 内置生产 build/static 与 Chromium/WebKit。差异若触及服务、领域、容量或部署边界，必须先修订本计划并增加对应门禁。
- `relaxed` 只允许经独立证明不影响交付的 supplemental finding；任何 core、构建、秘密信息、资产、可访问性或未知影响仍阻塞。
- 完成全部 core gate 后写入 phase result、`change-3.md`、更新 effective snapshot 与 completed state；没有本轮授权时停在已验证未提交工作区，不执行 Git 提交或正式部署。

## 5. 需求—任务—验证追踪

| 范围 | 阶段/任务 | 实现 | 验证 |
| --- | --- | --- | --- |
| RC-3-001；AC-C3-001 | P-001-T-001 | `styles.css` 统一 flex 轨道、固定间距变量、独立 clip padding/层级 | 多视口 top/left/gap 相等且跨视口稳定，横向滚动与 document width |
| RC-3-002；AC-C3-002 | P-001-T-001 | `styles.css` 连续卡宽上下限并退役断点几何覆盖 | 旧断点两侧连续性、桌面/手机宽度比例、shadow/dealer/真实 Tab focus/stacking |
| AC-C3-003 | P-001-T-001 | 全部 changed area | lint、typecheck、realtime、双浏览器 E2E/build/static、diff |

## 6. 风险与修订记录

| 风险 | 控制 |
| --- | --- |
| 统一 flex 后桌面卡片过窄或过宽 | 使用连续 clamp，并在真实几何测试中限制桌面最大值和手机比例。 |
| clip 安全区再次表现为卡片离边过远 | 分别测量可见几何与轨道裁剪余量，用负向轨道起点抵消顶部安全 padding。 |
| 遗留媒体查询继续覆盖统一规则 | 明确移除/中和 `.table-seats` 的断点布局与卡宽规则，并跨所有旧断点两侧采样。 |
| 自动化只验证手机而漏掉桌面 | 同一生产流程中循环测量桌面、断点邻域和 300px，不再只断言一个移动视口。 |

| 修订 | 日期 | 结论与依据 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-08-01 | 用户明确选择 `RELAXED`，并要求桌面/手机统一固定间距、连续缩放及卡宽上限；建立连续 change-3。 | 新增 RC-3-001～RC-3-002、AC-C3-001～AC-C3-003 和唯一 P-001；不改写 change-2。 |
