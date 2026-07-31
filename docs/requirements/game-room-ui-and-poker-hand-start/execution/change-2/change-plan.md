# 游戏房间界面统一与德州扑克开手体验 change-2：Poker 布局纠错变更计划

- 运行编号：`change-2`
- 运行类型：`需求变更`
- 目标记录：`change-2.md`
- 变更计划修订：`1`
- 当前有效需求：[../../effective-requirements.md](../../effective-requirements.md)
- 当前有效需求指纹：`sha256:605714942543c3d2bb0b486b58843c75b1bf02506a0c26fa69409b6d8117ce91`
- 项目基线：`main@d1dfadf47d1315efec9cb0b955cae5c5c5cea1dc`
- 创建日期：`2026-08-01`
- 详细程度：`compact`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`
- 下一可用发现项：`FND-C2-001`

## 1. 变更说明审核与待生效增量

本运行纠正 change-1 对三项 Poker 视觉需求的错误解释：准备页只去掉了 border，却仍以
带外部 margin、圆角和阴影的居中卡片呈现；缓存被错误改为无条件首尾均分；手机座位轨道
通过大幅增加可见 padding 避免裁剪，导致上方卡片离牌桌边缘过远。change-1 的冻结历史
保持不变，本运行只修改当前产品行为、回归断言和新的连续证据。

| 变更项 | 类型 | 关联当前需求 | 变更前 | 待生效结果 | 验收影响 |
| --- | --- | --- | --- | --- | --- |
| RC-2-001 | modify | FR-030、AC-028、NFR-005 | Poker 等待页的 `.waiting-panel` 虽无 border，仍有居中宽度、外部 margin、圆角、背景阴影和外层 shell padding，形成一圈空白；头像只有最小宽高，受内容行高影响可呈椭圆。 | Poker 等待页成为视口内从共享顶栏到页面底部的贴边表面：顶栏和主面板左右贴合视口，二者之间无外部空隙，主面板无外部圆角/阴影；内容保留必要内边距。等待席位头像具有确定相等宽高、`aspect-ratio: 1` 和圆形边界。 | AC-C2-001 core |
| RC-2-002 | modify | FR-025、AC-020、RC-1-002 | 不同面值节点无论多少都锚定首尾并均分整个轨道，少量筹码之间出现大空档。 | 缓存节点默认从左到右按完整筹码直径加正常小间距紧邻排列，不因轨道变宽而拉伸；只有节点总自然宽度超过可用轨道时才均匀压缩相邻步长并形成重叠，首尾完整、所有节点仍可操作，右侧总额/清空不变。 | AC-C2-002 core |
| RC-2-003 | modify | FR-028、AC-022、RC-1-003 | 手机轨道以 `2rem/2.4rem` 上下 padding 直接扩张卡片可见间距，虽避免裁剪但破坏紧凑布局。 | 恢复接近 change-1 前的小顶部间距和原横向 gap；滚动裁剪安全空间在独立的轨道坐标中向牌桌边缘外偏移，并提高座位层级，使阴影、焦点轮廓和庄家标识完整显示而不把卡片推远；横滚、吸附和管理手势保持。 | AC-C2-003 core |

### 变更验收

| 验收 | 层级 | 可观察结果 |
| --- | --- | --- |
| AC-C2-001 | core | 桌面和 300px 下 Poker 等待页的共享顶栏与主面板左右边界贴合视口，面板紧接顶栏并至少填满剩余视口；面板无外部 margin、圆角或阴影，内部内容仍有可读 padding；每个等待席位头像的计算宽高相等且呈圆形。 |
| AC-C2-002 | core | 1–3 个不同面值从轨道左端按“筹码直径 + 正常小间距”排列，末项不被拉到轨道右端；在 300px 下加入 16 个不同面值后，相邻中心步长才缩小且保持一致，首尾完整、面值/数量紧凑、各按钮及总额/清空可达。 |
| AC-C2-003 | core | 300px 下上方玩家卡距 felt 顶边保持紧凑、相邻卡横向 gap 保持原小间距；座位轨道层级高于中心牌面，滚动裁剪盒在不增加可见间距的情况下容纳阴影、真实 Tab 焦点和庄家标识，且无页面横向溢出。 |
| AC-C2-004 | core | lint、typecheck、realtime、生产 Chromium/WebKit E2E/build/static、capacity 和 `git diff --check` 通过；既有 Poker 开手、toast、玩家卡文字对比、资产、秘密投影和部署接口不回归。 |

## 2. 当前有效状态与项目依据

- schema 为 `3.2`；`change-0.md`、`change-1.md`、两次 completed execution evidence 与
  当前 effective snapshot 的编号、来源链和 SHA-256 均一致。
- 规划前工作区为干净 `main@d1dfadf…`，没有用户改动、未知 overlap 或活动 change run；
  `execution/change-2/` 是下一连续保留号。
- `.app-shell` 提供外层 padding，`.waiting-panel` 仍有 `margin: 3rem auto`、圆角、背景和
  通用 surface 阴影；change-1 只覆盖了 `border: 0`。`.member-avatar` 只有 min-width/
  min-height，没有锁定相等实际尺寸。
- 缓存 React 为每个节点写入 0–100% 绝对位置和反向百分比位移，所以 2 个节点也被放在
  轨道两端；原始 FR-025 明确要求未达宽度上限时使用正常间距，拥挤后才增加重叠。
- 手机 `.table-seats` 原横向 gap 为 `.35rem`，change-1 追加 `padding: 2rem .3rem 2.4rem`
  直接把卡片下推。滚动元素确实需要垂直裁剪安全空间，但可通过负向轨道起点、较小可见
  顶距和独立 z-index 同时满足，而无需扩大卡片与牌桌边缘的视觉间距。

## 3. 影响分析与全局设计

1. 仅给 Poker waiting 根节点增加语义类，不改变 Avalon 或大厅的 `.app-shell`。该 shell
   使用两行 grid、零外层 padding；共享顶栏占首行，waiting panel 占满剩余行。panel
   清除外部 margin、圆角和 surface 阴影，保留内容 padding；头像基础样式固定正方形，
   active Poker 卡片的较小头像同步覆盖确定宽高。
2. 缓存轨道改为 flex 压缩模型：非末节点的自然 flex-basis 等于筹码直径加正常 gap，
   末节点固定为一个完整筹码直径。空间充足时容器不分配剩余空间，所有节点自然左对齐；
   空间不足时仅非末 slot 等比例缩小，按钮保持完整直径并产生均匀重叠，末节点右边缘落在
   轨道内。删除 React 的绝对百分比定位和与布局无关的计数变量。
3. 手机座位滚动层保持 `.35rem` 横向 gap。通过把滚动盒 top 向 felt 外偏移、使用较小
   padding 建立真实裁剪安全区，使卡片本身仍靠近 felt 顶边；提高轨道和交互卡片 stacking
   level，确保阴影/焦点位于中心牌面之上、缓存/开手层之下。felt 的最终裁剪边界仍保护
   页面不横溢。
4. E2E 不再把“border 为 0”“16 节点全宽均分”“大 topGap”误当作完整验收。它直接测量
   waiting shell/panel/viewport 盒模型和头像比例，分别测量少量节点自然步长与拥挤节点
   压缩步长，并同时约束玩家卡的可见顶距与裁剪安全余量。

不涉及服务命令、游戏规则、投影、资产、SQLite、数据迁移、运行时依赖、Docker 或部署
接口。回滚只需恢复 Web DOM/CSS 和 E2E；正式发布仍在 change-2 冻结和提交后由受支持
入口独立执行。

## 4. 阶段路线图

| 阶段 | 目标 | 关联需求与验收 | 前置阶段 | 退出条件 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| P-001 | 纠正 Poker waiting、缓存和手机上方玩家轨道，并形成可部署候选 | RC-2-001–RC-2-003；AC-C2-001–AC-C2-004；FR-025、FR-028、FR-030；AC-020、AC-022、AC-028；NFR-005、NFR-007 | 无 | 三项真实几何行为和既有相关回归通过；无阻塞 finding、未解释文件或部署接口变化；可生成 phase result、change-2 与新 effective snapshot | in_progress |

三项纠错共享同一 Poker Web 布局和同一双浏览器验收面，不存在迁移、兼容期或安全中间
发布边界，因此使用 `single + compact` 和一个连贯任务。

## 5. 跨阶段依赖与兼容约束

- 只调整本机布局；服务端继续权威决定房间、阶段、行动、下注、资产和秘密投影。
- waiting 贴边只作用于 Poker 等待视图，不能改变共享顶栏语义或其他 `.app-shell` 页面。
- 缓存金额、失效清空、提交命令、面值排序和同面值合并保持不变；布局只消费当前不同
  面值节点，不复制实际筹码数量级 DOM。
- 座位轨道仍是唯一横向滚动所有者；不得用页面横溢、删除阴影/焦点/庄家或增大可见间距
  绕过裁剪。
- toast、玩家卡身份位置/对比、开手协议、按住私牌、旁观者管理和 public display 保持。
- 不修改 initial、change-0/change-1 冻结证据、其他 feature 历史、部署接口或真实配置。

## 6. 最终集成、回归与验收流程

1. 修改 Poker waiting 根类、头像尺寸、缓存 DOM/CSS 和手机座位轨道 stacking/裁剪空间，
   同步更新 E2E 的盒模型、自然间距、压缩间距和卡片紧凑几何断言。
2. 先运行改变行为的目标 Playwright Poker 用例；在最终源码运行 `npm run lint`、
   `npm run typecheck`、`npm run test:platform`、`npm run test:poker`、
   `npm run test:avalon`、`npm run test:realtime`、`npm run test:e2e:core` 和
   `npm run test:capacity`。核心 E2E 内含生产 build/static 与 Chromium/WebKit。
3. 运行 `git diff --check` 和文件归属/敏感信息检查；`relaxed` 仅允许已独立证明不影响
   交付行为的 supplemental 异常，任何 core、构建、秘密、资产或未知影响仍阻塞。
4. 写入 phase result、`change-2.md`、更新 effective snapshot 和 completed state；随后按
   本次连续纠错所沿用的用户明确授权提交干净 HEAD。
5. 提交后读取部署文档与最新状态，以受支持入口正式发布；发布后再次运行同入口确认
   matching healthy SHA 的 no-op。部署事实不倒写为产品阶段证据。

不计划修改或专项测试 `deploy/**`；若实际差异触及该边界，必须先暂停修订计划。

## 7. 需求与阶段追踪矩阵

| 范围 | 阶段/任务 | 实现 | 验证 |
| --- | --- | --- | --- |
| RC-2-001；AC-C2-001 | P-001-T-001 | `main.tsx` waiting 根类；`styles.css` 贴边 grid/panel 与确定圆形头像 | Chromium/WebKit 的 viewport/header/panel 边界、剩余高度、外部 chrome 和头像宽高/圆角 |
| RC-2-002；AC-C2-002 | P-001-T-001 | `main.tsx` 移除绝对百分比位置；`styles.css` 自然 basis + 受限 flex shrink | 1–3 节点左对齐正常步长；300px/16 节点压缩步长、首尾、按钮、总额/清空 |
| RC-2-003；AC-C2-003 | P-001-T-001 | `styles.css` 轨道 top/padding/z-index 和交互卡片层级 | 300px felt 顶距、横向 gap、track 安全余量、shadow/dealer/真实 Tab、层级和 document width |
| AC-C2-004 与兼容验收 | P-001-T-001 | 全部 changed area | lint、typecheck、platform/Poker/Avalon/realtime、E2E build/static、capacity、diff |

## 8. 风险、技术决策与修订记录

| 风险 | 控制 |
| --- | --- |
| waiting 贴边误伤大厅/Avalon | 使用 Poker waiting 根语义类限定选择器；E2E 同时继续完整双游戏流程。 |
| flex 压缩让少量节点拉伸或 16 节点端点越界 | 最后 slot 固定完整直径，其他 slot 只收缩不增长；少量和拥挤场景分别测量。 |
| 减少可见 padding 后重新裁剪阴影/焦点/庄家 | 把滚动盒坐标向 felt 边缘外偏移，保留足量内部 clip padding，并分别约束卡片可见顶距和 track 安全余量。 |
| 提高层级遮挡开手卡或缓存 | 座位轨道只高于 board/spectator，仍低于 cache、开手卡、私牌层和结算层；既有交互 E2E 阻塞。 |
| 再次由错误测试掩盖需求 | 验收断言直接对应用户描述的两阶段排布和盒模型，不再以 border、单一 16 节点均分或大 padding 作为代理。 |

| 修订 | 日期 | 结论与依据 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-08-01 | 用户指出 change-1 三项具体偏差；沿用其原始请求中明确的 `relaxed`、提交和正式部署授权，建立连续纠错 change-2。 | 新增 RC-2-001–RC-2-003、AC-C2-001–AC-C2-004 和唯一 P-001；不改写 change-1。 |
