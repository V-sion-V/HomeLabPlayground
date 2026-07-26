# P-001 阶段结果：完整首版平台与德州扑克

- 运行编号：`initial`
- 阶段编号：`P-001`
- 阶段计划：[phase-001-plan.md](phase-001-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 开始基线：`2026-07-26` 的非 Git 空白工作区，仅有功能需求与工作流契约
- 完成基线：Git 修订 `43bc732b132ced577c2ce1cf7495e6dd7769a26f`
- 完成日期：`2026-07-27`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 阶段目标与结果

P-001 从空白工作区交付了可在 x86-64 iStoreOS Docker 环境运行的家庭聚会游戏平台首版。平台包含免密码账户、资料与设备偏好、房间和连接租约、公共大屏、赛季与排行榜、守恒型积分/筹码资产、简体中文/英文界面、SQLite 持久化，以及可完整游玩的“仅筹码”和“筹码＋牌”两种 2–10 人无上限德州扑克。

生产服务以单进程 Fastify 提供 HTTP、WebSocket、静态客户端与健康检查，以 SQLite 事务保存权威状态和资产流水；容器以非 root Node 用户运行，数据位于命名卷，运行时不依赖公网。最终本地聚合、真实浏览器、容量、目标机命名卷恢复、局域网 HTTP、无网络容器与非 root 门禁全部通过。

## 2. 任务、需求与验收覆盖

| 任务 | 完成结果 | 需求范围 | 主要证据 |
| --- | --- | --- | --- |
| P-001-T-001 | 完成 | FR-001–FR-029、FR-055–FR-057 的平台、资产与持久化基础 | `npm run lint`、`npm run typecheck`、platform/server 14/14、SQLite 重开与事务故障测试 |
| P-001-T-002 | 完成（真实服务纠正后） | FR-030–FR-054 及玩家端、大屏、实时投影 | poker 14/14、realtime 3/3、生产 Chromium/WebKit 4/4、目标 Chrome 双玩家/大屏主流程 |
| P-001-T-003 | 完成 | FR-055–FR-057、NFR-001–NFR-012、部署与全量追踪 | `verify:core`、容量 3/3、生产构建、静态资源检查、iStoreOS 健康/恢复/离线/非 root 烟雾 |

| 验收 | 层级 | 通过证据 |
| --- | --- | --- |
| AC-001–AC-004 | core | platform 与生产 E2E 覆盖账户创建/规范化/切换、资料快照、双语和设备语言持久化 |
| AC-005–AC-007 | core | platform/server 与 E2E 覆盖房间占用、开局限制、重连/接管、房主超时转让及无人在线关闭退款 |
| AC-008–AC-009 | core | realtime 与 E2E 覆盖多大屏只读投影、玩家名额隔离、隐藏牌隔离及两种模式牌槽差异 |
| AC-010–AC-014 | core | platform 与 E2E 覆盖设置 modal、房主时限、赛季创建阻断/归档、排行榜切换和入桌冻结 |
| AC-015–AC-016 | core | platform/server 覆盖守恒不变量、原子流水、幂等重放、过期/重复命令及故障回滚 |
| AC-017 | core | poker 14/14 覆盖 2–10 人、按钮/盲注/行动、全押、主池/边池、平分、短额大盲和累计短额全押重新开放加注 |
| AC-018 | core | poker/server 覆盖仅筹码多底池、合格赢家校验、平分和下一手前反向流水撤销 |
| AC-019 | core | poker、realtime 与 E2E 覆盖服务端牌组/牌型/自动分池、本人手牌投影及刷新重连不重发 |
| AC-020 | core | server 与 E2E 覆盖合法买入、两手间补码/退出、零筹码处理及牌中移除断线玩家自动弃牌 |
| AC-021–AC-022 | core | Chromium/WebKit E2E 覆盖固定面值、鼠标/触摸拖放、单枚移除/清空、合法性原因及跟注/全押只填缓存 |
| AC-023–AC-024 | core | poker/server 与目标 Chrome 覆盖有限撤销、并发版本竞争、至少 3 秒自动推进等待、提示音和静音持久化 |
| AC-025 | core | Chromium 桌面与 WebKit 手机 E2E 覆盖鼠标、键盘和触摸的完整下注操作且无数字输入 |
| AC-026 | core | platform/server 覆盖 SQLite 重开、在线状态归一化、截止时间恢复；目标命名卷跨镜像替换后资产和排行榜保持 |
| AC-027 | core | iStoreOS Compose 健康检查、命名卷、`uid=1000(node)` 与 `--network none` 独立容器烟雾全部通过 |
| AC-028 | core | 容量测试 3/3：15 个账户、2 个活动房间、15 个玩家 WebSocket、4 个大屏 WebSocket 无串房或私有泄露 |
| AC-029 | supplemental | 结构化启动/拒绝/持久化/不变量诊断字段与日志脱敏测试通过；目标启动和健康日志无异常 |
| AC-030 | supplemental | 生产 Chromium 桌面与 WebKit 手机 4/4；交互、信息、状态及静音刷新保持均通过 |

全部 `FR-001`–`FR-057`、`AC-001`–`AC-030` 与 `NFR-001`–`NFR-012` 已覆盖，无降级验收、用户豁免或开放报告项。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `.gitignore`、`package.json`、`package-lock.json`、`tsconfig.json`、`eslint.config.js`、`vitest.config.ts` | add | 建立可重复的 npm/TypeScript workspace、静态门禁与正确的测试收集边界 |
| `apps/server/**` | add | 提供 Fastify HTTP/WebSocket 服务、会话控制、角色投影、健康检查、静态托管和脱敏结构化日志 |
| `apps/web/**` | add | 提供真实权威状态驱动的响应式双语大厅、设置、排行榜、玩家牌桌、筹码交互与公共大屏 |
| `packages/contracts/**` | add | 定义命令、错误、版本、房间、牌局、结果及按角色过滤的投影契约 |
| `packages/domain/**` | add | 实现账户、租约、房间、赛季、排行榜、资产守恒、幂等和截止时间领域逻辑 |
| `packages/persistence/**` | add | 实现 SQLite 迁移、事务、快照、流水、幂等结果及启动恢复 |
| `packages/poker/**` | add | 实现两种无上限德州扑克模式、牌型、行动、全押/边池、结算、撤销与自动推进 |
| `packages/test-support/**` | add | 提供确定性时钟、随机源、牌组和测试平台 |
| `tests/**`、`playwright.config.ts`、`scripts/**` | add | 覆盖平台、服务、扑克、实时隐私、生产浏览器、容量、静态资产和 Docker 烟雾 |
| `Dockerfile`、`.dockerignore`、`deploy/**`、`README.md` | add | 提供 Node 24 多阶段非 root 镜像、Compose 命名卷、健康检查和 iStoreOS 运维说明 |
| `implementation-plan.md`、`execution/initial/phase-001-plan.md`、`execution/initial/execution-state.md`、`execution/initial/phase-001-result.md` | add | 保存初始路线图、阶段计划、可恢复执行证据和本阶段不可变结果 |

## 4. 测试与验证

| 验证 | 观察结果 |
| --- | --- |
| `npm run verify:core` | 通过：lint、typecheck、platform/server 14/14、poker 14/14、realtime 3/3、生产构建、静态资源检查、Chromium 桌面与 WebKit 手机 4/4 |
| `npm run test:capacity` | 通过 3/3：15 账户、2 房间、15 玩家 WebSocket、4 大屏 WebSocket 与空闲大厅隔离 |
| `npm test` | 通过：5 个 Vitest 文件、34/34 测试 |
| `npm run build` | 通过：Vite 客户端与 tsup 服务端生产产物生成，静态资源无外部运行依赖 |
| `git diff --check` | 通过：无空白错误 |
| 最终部署归档 | `home-party-game-platform-20260727-rule-final.tar.gz`，72 个条目，SHA-256 `57312dcaa3f2f8c83f914ef9d5e7d7631585160b9bed5073516c51de00123b4a` |
| iStoreOS Compose | 通过：服务 `healthy`，`/healthz` 返回 `{"status":"ok","version":11}`，运行身份 `uid=1000(node)`，启动/健康日志正常 |
| iStoreOS 命名卷恢复 | 通过：最终镜像替换后排行榜仍保持 V_sion 10,100、Codex验收0727 10,000、VVV 10,000、Focol 9,900 |
| iStoreOS 最终 Chrome | 通过：目标加载最终生产资源 `assets/index-CvJC4023.js`；双语标签和局域网 HTTP UUID 降级生效；可创建并关闭房间，资产不重复、不丢失 |
| iStoreOS 离线容器 | 通过：`--network none` 下健康，独立卷可用，身份为 `uid=1000(node) gid=1000(node)`；临时容器和卷已清理 |

## 5. 发现项与处置

无 `FND-I-*` 报告项。下一个可分配编号仍为 `FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

## 6. 决策、计划偏差与恢复记录

- 保持用户选择的 `relaxed` 策略；所有 core、硬门禁和两个 supplemental 验收实际均通过，未使用 `passed_with_findings`。
- 初版客户端与 E2E 曾使用固定演示状态和路由桩，目标 Chrome 审计暴露该偏差后，在阶段结果冻结前改为真实 HTTP/WebSocket/SQLite 集成并重跑全部相关门禁。
- 目标局域网 HTTP 暴露 `crypto.randomUUID` 在非安全来源不可用；加入能力检测和降级 ID，并由本地 E2E与目标 Chrome 复验。
- 目标主流程后的逐条规则审计发现短额大盲及连续短额全押边界；在冻结结果前修复并将 poker 证据扩充至 14/14。
- 本地环境无 Docker CLI/daemon，Docker 门禁改由实际目标 iStoreOS 执行。目标证据覆盖生产 Compose、命名卷跨镜像替换、无网络健康和非 root 运行，比本地模拟更接近交付环境。
- 执行曾因等待目标部署进入 `blocked`，恢复时按记录指纹和部分差异重建安全状态；最终三个冻结输入的 SHA-256 均保持不变。

## 7. 遗留风险与下一阶段进入条件

没有阻止交付的遗留风险、未决产品问题或开放 finding。P-001 是初始路线图唯一阶段，不存在下一初始阶段。

后续产品需求只能在 `change-0.md` 冻结后通过新的 `change-N` 变更运行进入；不得修改本阶段计划或本结果。运行维护仍应保留 `/data` 命名卷，先备份数据再升级镜像，并在替换后检查 `healthy`、`/healthz` 和关键排行榜/房间状态。
