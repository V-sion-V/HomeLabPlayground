# P-001 阶段结果：Poker 视觉修复与全局临时提示

- 运行编号：`change-1`
- 阶段编号：`P-001`
- 阶段计划：[phase-001-plan.md](phase-001-plan.md)
- 阶段计划修订：`1`
- 父变更计划修订：`1`
- 完成日期：`2026-07-31`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：`main@4b305b2c3c77e0a88036692143a7a3fd48ba33ef`
- 结束基线：上述 HEAD 加本结果所列未提交候选差异；用户授权的提交与正式部署在工作流冻结后单独执行

## 1. 阶段目标与结果

P-001 的唯一任务 `P-001-T-001` 已完成，RC-1-001–RC-1-004 在同一个 Web 候选中交付：

- Poker 准备主面板移除外圈边框。玩家卡改为头像、身份、资产和状态徽标的紧凑网格，
  在线/离线位于头像右侧昵称下方；行动/开手待办填充时，名称、连接、筹码标签/数值和
  折叠文字使用同一可读前景色，本人边框与状态文字继续叠加。
- 本人正式回合的下注缓存铺满 felt 左右安全宽度；当前不同面值节点数决定首尾锚点和
  中间等分位置，16 种面值在 300px 下仍保持首尾完整、中心步长一致和全部按钮可操作。
  面值与 `×数量` 使用零行距和紧凑行高，总额与清空保持独立可达。
- 缓存出现时旁观者条移出其视觉/点击区域，缓存透明空白不拦截牌桌事件；既满足全宽，
  也不遮断房主管理入口。
- 手机玩家轨道增加上下视觉安全区并缩小卡片，300px 下卡片阴影、键盘焦点轮廓和庄家
  标识均位于滚动裁剪盒内，横滚、吸附和上下文管理手势保留。
- 共享 `ToastProvider` 通过 portal 在左上角显示瞬时反馈；最新提示前插到最上方，每条有
  本地化关闭按钮、独立五秒计时和卸载清理。主应用、Poker/Avalon 和管理员操作不再把
  transient notice 放入布局；字段校验、静态警告和危险确认继续留在原上下文。

全部 AC-C1-001–AC-C1-006 core 与计划硬门禁通过。服务命令、领域/Poker/Avalon 规则、
投影、资产、SQLite、Docker 和部署接口没有改变。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 需求与验收 | 完成证据 |
| --- | --- | --- | --- |
| P-001-T-001 | completed | RC-1-001–RC-1-004；AC-C1-001–AC-C1-006 core | lint、typecheck、platform/server 40/40、Poker 17/17、Avalon 8/8、realtime 5/5、capacity 4/4、生产 Chromium/WebKit 8/8、300px/16 面值几何和差异卫生全部通过 |

| 验收 | 状态 | 可观察结果 |
| --- | --- | --- |
| AC-C1-001 | passed | 准备主面板四边边框计算值均为 0；行动卡内身份/连接/资产文字与填充前景一致，卡宽不超过 150px，在线状态位于昵称下方和头像右侧。 |
| AC-C1-002 | passed | 缓存贴合 felt 安全边距；16 节点 CSS 计数为 16，首尾均在轨道内，相邻中心步长差不超过 1.5px，数量行与面值间距不超过 1px，总额/清空可达。 |
| AC-C1-003 | passed | Chromium/WebKit 的 300px 牌桌无页面横溢；玩家卡上下安全距离、非空阴影、庄家边界及实际 Tab 焦点轮廓均通过。 |
| AC-C1-004 | passed | 两条管理员反馈同时存在时较新 ID 的 toast 位于较小 top；关闭最新项后只余旧项，旧项在六秒验收窗口内自动消失，主内容 top 不变化。 |
| AC-C1-005 | passed | 管理员设置/赛季、普通命令和连接接管共用 alert toast；中英文关闭名称、键盘/触控入口及静态上下文消息边界保留。 |
| AC-C1-006 | passed | 全部计划内静态、领域、服务、实时、容量、生产构建/静态资源、双浏览器和 diff 门禁通过，无秘密、权限、资产或恢复回归。 |

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `apps/web/src/ui.tsx` | modify | 增加共享 toast context/provider、独立计时、手动关闭和 portal 队列。 |
| `apps/web/src/main.tsx` | modify | 主应用瞬时反馈接入 toast；调整 Poker 玩家卡身份结构和按节点数定位的缓存 DOM。 |
| `apps/web/src/admin-ui.tsx` | modify | 管理员操作结果/错误迁移到共享 toast，移除布局内 notice 传递。 |
| `apps/web/src/avalon-ui.tsx` | modify | 移除 Avalon 房间布局内 transient notice 占位。 |
| `apps/web/src/styles.css` | modify | toast、无边框准备面板、紧凑玩家卡/语义前景、全宽动态缓存、旁观者避让和手机视觉安全区。 |
| `tests/e2e/core.spec.ts` | modify | 覆盖 toast 顺序/关闭/计时/不占位、准备边框、卡片颜色/布局、16 面值间距、旁观者避让和 300px 阴影/焦点。 |
| `docs/requirements/game-room-ui-and-poker-hand-start/execution/change-1/change-plan.md` | add | 冻结 RC、验收、路线图、风险和 `relaxed` 策略。 |
| `docs/requirements/game-room-ui-and-poker-hand-start/execution/change-1/phase-001-plan.md` | add | P-001 rev 1 compact just-in-time 阶段计划。 |
| `docs/requirements/game-room-ui-and-poker-hand-start/execution/change-1/phase-001-result.md` | add | 本阶段 completed / passed 结果。 |
| `docs/requirements/game-room-ui-and-poker-hand-start/execution/change-1/execution-state.md` | add | change-1 durable 状态；收口时更新为 completed。 |

没有修改 `locales.ts`：既有消息本身已双语，新增关闭按钮根据当前文档语言提供中英文可
访问名称。没有修改 initial、`change-0.md`、其他 feature 历史、服务/契约/领域/持久化、
部署脚本、Docker 接口、真实配置或生成的 `dist/`。

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
| 核心浏览器 | `npm run test:e2e:core` | passed；生产 build/static、Chromium desktop 与 WebKit mobile 共 8/8。 |
| 构建/静态资源 | 上述 E2E 内置 `npm run build` 与静态检查 | passed；Web 47 modules、server ESM bundle，2 个 HTML/CSS 文件无公网资源。 |
| 视觉/交互几何 | 上述生产 E2E 的桌面与 300px 页面 | passed；计算色、边框、卡片身份几何、阴影安全区、真实 Tab 焦点、16 节点中心步长、行距、旁观者避让和 toast 视口顺序成立。 |
| 差异卫生 | `git diff --check`、`git status --short` 与归属检查 | passed；无空白错误、生成物、真实配置或无关文件。 |

最终产品代码修改后运行的完整核心 E2E/build/static 8/8 通过；随后只同步两处已迁移 toast
的测试角色断言，并再次完整运行 8/8。最终测试源码之后又重跑 lint、typecheck 和 diff。
并行 Vitest 分组全部以退出码 0 完成。npm 用户级 cache 日志清理产生非失败 EPERM 警告，
不影响任何命令退出码或交付结论。

## 5. 发现项与处置

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

阶段内浏览器验证先后发现全宽缓存覆盖旁观者管理目标、程序化 focus 不代表真实
`:focus-visible` 模态，以及两处 Avalon 旧断言仍寻找布局内 status。缓存改为透明空白
穿透并让旁观者条避让，焦点断言改用实际 Tab 顺序，旧断言改为 toast；后续完整双浏览器
8/8 通过。一次 WebKit 新赛季 409 已由 trace 证明是前一轮 Poker 提前失败留下开放房间
导致的 `ROOMS_MUST_CLOSE` 级联，最终 clean-run 不再出现，因此没有保留 finding。

## 6. 决策、计划偏差与恢复记录

- 用户明确选择 `relaxed` 并授权完成后提交、正式部署；全部 core 和硬门禁实际通过，
  没有使用 report-only 例外。
- 变更保持 `single + compact`，没有新增阶段、任务、计划修订或纠正阶段。
- `locales.ts` 最终不需要修改；既有双语消息复用，关闭名称在共享组件中按当前语言生成。
- 缓存与旁观者避让是验证中发现的同任务内必要兼容修复，没有改变产品范围或服务边界。
- 本运行没有用户 overlap、数据迁移、未知文件、外部状态变化或部分提交。

## 7. 遗留风险与下一阶段进入条件

没有开放 finding、未决问题、阻塞风险或下一执行阶段。P-001 是 change-1 的最终阶段；
本结果冻结后生成 `change-1.md`、更新 `effective-requirements.md` 并把 durable state 标记为
`completed`。提交和正式服务器发布按用户授权在工作流冻结后执行，不作为本阶段通过证据。
