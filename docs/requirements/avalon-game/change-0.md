# 阿瓦隆游戏：change-0 首次实现记录

- 修改编号：`0`
- 修改类型：`initial implementation`
- 原始需求：[requirements.md](requirements.md)
- 初始路线图：[implementation-plan.md](implementation-plan.md)
- 执行运行：[execution/initial/execution-state.md](execution/initial/execution-state.md)
- 项目基线：`main@67e68cea036a41c38917e19936c27e3f7cd49f19`
- 完成日期：`2026-07-31`
- 运行状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 实现概览

本记录冻结 `avalon-game` initial 的完整交付：

- 新增独立纯 TypeScript Avalon 引擎，完成 5–10 人原版配置、角色/知识、自动与手动夜间、
  提名、秘密投票、任务、五次否决、刺杀、结算和作废。
- 把共享房间、配置、命令、投影、结果和恢复迁移为严格 Poker/Avalon 判别；服务端保持
  配置、随机、权限、秘密、版本、胜负和资产的唯一权威。
- 把账户、赛季基础分、排行榜、流水和退役扩展为有符号安全整数语义，同时保持 Poker/
  Avalon 内部资产非负、方向明确、原子守恒、幂等、并发和故障回滚。
- 交付大厅、管理员、玩家、观战和匿名 display 的完整双语、主题/音量、键盘/触控、桌面和
  300px UI；活动秘密默认遮盖并仅进入本人有效租约投影。
- 本地全部硬门禁与 supplemental 验收通过；真实 iStoreOS 仅使用随机隔离资源完成
  `linux/amd64` Docker/重启恢复和 Chromium/WebKit 流程，随后清理为零，正式资源未改变。

## 2. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `AGENTS.md` | modify | 同步当前双游戏产品、架构、不变量、门禁和正式未发布状态。 |
| `Dockerfile` | modify | 生产安装前包含 Avalon workspace manifest。 |
| `package.json`、`package-lock.json`、`tsconfig.json` | modify | 注册 Avalon workspace、路径和正式测试入口；无新外部依赖。 |
| `packages/avalon/package.json`、`packages/avalon/src/index.ts` | add | 独立 ESM Avalon 纯规则包。 |
| `packages/contracts/src/index.ts` | modify | 严格游戏判别、Avalon 设置/状态/投影/结果和秘密断言。 |
| `packages/domain/src/index.ts` | modify | 有符号资产、Avalon 平台生命周期、事务、删除、结果、恢复和不变量。 |
| `packages/test-support/src/index.ts` | modify | 判别明确的测试配置与辅助函数。 |
| `apps/server/src/app.ts` | modify | safe-integer API、Avalon 命令族、跨游戏拒绝、租约和角色化广播。 |
| `apps/web/src/avalon-ui.tsx` | add | 玩家/观战/display 完整固定壳层和全流程交互。 |
| `apps/web/src/main.tsx` | modify | 大厅游戏选择、判别创建/加入、房间卡和 Avalon 页面接入。 |
| `apps/web/src/admin-ui.tsx` | modify | Avalon 设置/六套预设原子编辑和负基础分输入。 |
| `apps/web/src/locales.ts`、`apps/web/src/styles.css` | modify | 双语错误、主题、响应式、焦点、触控和减动效。 |
| `playwright.config.ts` | modify | 本地默认不变并支持显式隔离远端 base URL。 |
| `tests/avalon.test.ts` | add | Avalon 纯规则矩阵和不变量。 |
| `tests/avalon-platform.test.ts` | add | Fastify/领域/事务/秘密/恢复/删除/故障集成证据。 |
| `tests/platform.test.ts`、`tests/server.test.ts` | modify | 有符号资产、严格判别和服务集成回归。 |
| `tests/realtime.test.ts` | modify | Avalon 角色化租约和跨房秘密隔离。 |
| `tests/capacity.test.ts` | modify | 15 账户、双游戏房间和多 display 容量。 |
| `tests/e2e/core.spec.ts` | modify | Chromium/WebKit 完整 Avalon、负分、隐私、结算和 300px 流程。 |
| `tests/docker-smoke.mjs` | modify | 隔离容器中的 Avalon 活动状态、重启、租约、作废和 Poker 兼容。 |
| `docs/requirements/avalon-game/requirements.md` | add | 用户批准的原始需求。 |
| `docs/requirements/avalon-game/workflow-contract.md` | add | schema-v3.2 工作流合同。 |
| `docs/requirements/avalon-game/implementation-plan.md` | add | initial 路线图 rev 1 和完整追踪。 |
| `docs/requirements/avalon-game/execution/initial/phase-001-plan.md` | add | 唯一阶段 P-001 rev 1 的执行计划。 |
| `docs/requirements/avalon-game/execution/initial/phase-001-result.md` | add | P-001 completed / passed 冻结结果。 |
| `docs/requirements/avalon-game/execution/initial/execution-state.md` | add | completed initial 状态、累计清单、证据和发现项权威。 |
| `docs/requirements/avalon-game/effective-requirements.md` | add | change-0 后可重新生成的当前产品权威。 |
| `docs/requirements/avalon-game/change-0.md` | add | 本首次实现冻结记录。 |

没有修改 SQLite 表结构、`deploy/**`、`.dockerignore`、正式 Compose/部署配置、固定卷接口、
正式发布目录、唯一备份或其他 feature 的冻结历史；没有保留 `dist/`、测试报告、归档或远端
随机资源。

## 3. 需求、阶段与任务完成情况

| 范围 | 状态 | 结果 |
| --- | --- | --- |
| FR-001–FR-058 | completed | 全部生效并归入 [effective-requirements.md](effective-requirements.md)。 |
| AC-001–AC-027 core | passed | 产品功能、隐私、数据、兼容、恢复、构建和项目硬门禁全部通过。 |
| AC-028–AC-031 supplemental | passed | Chromium/WebKit、容量、无秘密日志边界和独立 UI 审阅通过；无 report-only finding。 |
| NFR-001–NFR-012 | completed | 守恒、隐私、权威、恢复、兼容、可访问性、本地化、容量、离线、分层、日志和发布安全成立。 |
| P-001-T-001 | completed | 有符号资产与纯 Avalon 规则基础。 |
| P-001-T-002 | completed | 平台、SQLite、Fastify、WebSocket、秘密和恢复。 |
| P-001-T-003 | completed | Web/管理员/display、本地最终门禁和隔离 iStoreOS 验收。 |
| P-001 | completed | [phase-001-plan.md](execution/initial/phase-001-plan.md) rev 1 与 [phase-001-result.md](execution/initial/phase-001-result.md) 已冻结。 |
| initial | completed | 单阶段路线图完成，编号记录和有效需求快照一致。 |

需求指纹、路线图指纹和阶段计划指纹分别保持：

- `sha256:7b27e53479b995e9aa5decb9a73f29f91ee015cd7ad9a7ec56765d14765b936d`
- `sha256:b53079171c9e4a4bd238d503547a2c7663274b0b08207dda0eb933a286ce012c`
- `sha256:a0c7c3dd3b2a91014cb4ba57ad5adf4bc751e2abec221c834394cba723e51afb`

阶段编号从 P-001 连续且无纠正阶段；没有 unresolved question、部分迁移、未知 overlap、
blocking finding 或未解释保留文件。

## 4. 测试与验证

- 交付与验证策略：`relaxed`。
- 验证结论：`passed`。
- core 与硬门禁均通过；supplemental 也全部通过，没有使用 report-only 例外。

| 验证 | 结果 |
| --- | --- |
| `npm run verify:core` | passed；lint、typecheck、platform/server 37/37、Poker 15/15、realtime 5/5、生产 build/static、Chromium/WebKit 8/8。 |
| `npm run test:avalon` | passed，8/8。 |
| `npm run test:capacity` | passed，4/4；约 15 账户、Poker/Avalon 双房间、多 display。 |
| `npm run build` | passed；47 Web modules、server ESM bundle；静态 HTML/CSS 无公网引用。 |
| `git diff --check` | passed；无空白错误或临时归档。 |
| 隔离 iStoreOS Docker smoke | passed；`linux/amd64`、非 root、healthy、离线、旧偏好、Avalon 负分押分/秘密/投票/任务重启恢复与作废、Poker 私牌和命名卷。 |
| 隔离 Chromium Avalon E2E | passed，1/1（17.1s），使用全新随机卷。 |
| 隔离 WebKit Avalon E2E | passed，1/1（2.4m），独立重建全新随机卷。 |
| 独立浏览器 UI 审阅 | passed；桌面层级清晰，300px 无页面横溢，匿名 display 0 buttons / 0 inputs / 0 secret。 |
| 远端正式资源审计 | passed；正式 release `67e68cea…`、固定卷、备份 `1425408` bytes / SHA-256 `346072bb…`、无锁、health version 726 前后不变；随机资源残留 0。 |

用户级 npm cache 日志清理 `EPERM` 警告不改变退出码、lockfile 或证据结论，且没有交付影响。

## 5. 与路线图及阶段计划的偏差

- 路线图仍为 `single + expanded`，P-001 rev 1 的三个任务顺序、边界和最终门禁未变；
  没有路线图、阶段计划修订或纠正阶段。
- 远端生产构建发现 Dockerfile 缺少新增 workspace manifest，作为 build/runtime 硬门禁
  在同一 T3 内修复并由后续本地/远端构建独立证明。
- LAN 时延暴露 E2E 夹具未逐次等待权威版本和夜间 DOM 重建。服务端正确拒绝了旧版本；
  夹具改为等待公共投影版本/计数/夜间索引，之后本地和远端两种浏览器全部通过。
- 上述均是阶段范围内的最小集成闭环，不改变产品需求、全局设计、阶段边界或已冻结结果。
- 远端测试严格使用随机隔离资源，没有执行正式发布；这与计划一致。

## 6. 遗留事项

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

正式 `home-table` 尚未发布本提交，这是明确排除范围而非 finding。若以后需要正式发布或修改
Avalon 行为，应分别取得发布授权或创建连续的 `change-1` 运行；不得改写本记录、
`phase-001-result.md` 或 completed execution state。
