# P-001 阶段结果：完整阿瓦隆与有符号平台资产

- 运行编号：`initial`
- 阶段编号：`P-001`
- 阶段计划：[phase-001-plan.md](phase-001-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 完成日期：`2026-07-31`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 开始基线：`main@67e68cea036a41c38917e19936c27e3f7cd49f19`
- 结束基线：上述 HEAD 加本结果所列完整候选差异；Git 提交按用户要求在 initial 冻结后执行

## 1. 阶段目标与结果

P-001 的三个有序任务全部完成。平台在保留既有德州扑克、账户偏好、管理员、赛季、
排行榜、SQLite、实时投影和部署边界的同时，交付了完整 5–10 人原版阿瓦隆：

- 账户、赛季基础分、排行榜、流水和退役使用有符号安全整数；Poker/Avalon 游戏资产、
  押分和转移金额仍为非负且保持原子守恒。
- 独立 `@party/avalon` 纯状态机覆盖人数规则、角色配置、原版/Dized 奥伯伦、知识、
  自动/手动夜间、提名、秘密投票、任务、五次否决、三成败、刺杀、结算和作废。
- 共享契约、领域、Fastify、SQLite 快照和 WebSocket 使用严格游戏判别；Avalon 押分、
  结果、删除、匿名化、恢复、幂等、并发和角色化投影均由服务端权威执行。
- 大厅、管理员、玩家、观战成员和匿名 display 提供双语、主题/音量一致、键盘/触控、
  300px、默认遮盖的完整流程；公共大屏不占名额、无控制且无活动秘密。
- 最终本地硬门禁、远端随机隔离 Docker smoke、Chromium、WebKit 和独立浏览器视觉检查
  全部通过；随机远端资源已清理，正式服务与持久资源未改变。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 主要需求与验收 | 完成证据 |
| --- | --- | --- | --- |
| P-001-T-001 | completed | FR-001–FR-009、FR-020–FR-043 的纯规则基础、FR-044–FR-049 的有符号资产；AC-009–AC-016 | Avalon 规则 8/8、极值/守恒/回滚、Poker 15/15 |
| P-001-T-002 | completed | FR-010–FR-049 的平台生命周期、命令、秘密、结算、删除和恢复；AC-001–AC-020、AC-022–AC-026 | platform/server 37/37、realtime 5/5、角色化投影、故障注入与重启 |
| P-001-T-003 | completed | FR-050–FR-058 的玩家/管理员/display 与全部可见流程；AC-001–AC-031、NFR-006–NFR-012 | 本地 Chromium/WebKit 8/8、容量 4/4、build/static、远端 Docker 与浏览器验收 |

FR-001–FR-058、AC-001–AC-031 和 NFR-001–NFR-012 均由
[implementation-plan.md](../../implementation-plan.md) 的追踪矩阵映射到本阶段，并至少有一项
独立自动化或浏览器证据。AC-001–AC-027 core 与所有项目硬门禁通过；AC-028–AC-031
supplemental 也全部通过，没有使用 relaxed 策略保留异常。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `docs/requirements/avalon-game/requirements.md` | add | 保留用户批准的原始需求权威。 |
| `docs/requirements/avalon-game/workflow-contract.md` | add | 保留 schema-v3.2 工作流合同。 |
| `docs/requirements/avalon-game/implementation-plan.md` | add | 单阶段 expanded 路线图、全局设计与追踪。 |
| `docs/requirements/avalon-game/execution/initial/phase-001-plan.md` | add | P-001 rev 1 的三个有序任务、门禁和恢复指令。 |
| `docs/requirements/avalon-game/execution/initial/execution-state.md` | add | initial 的 durable 检查点、累计清单与证据。 |
| `docs/requirements/avalon-game/execution/initial/phase-001-result.md` | add | 冻结本阶段结果。 |
| `packages/avalon/package.json`、`packages/avalon/src/index.ts` | add | 私有 ESM workspace 与完整纯 Avalon 状态机。 |
| `package.json`、`package-lock.json`、`tsconfig.json` | modify | 注册 workspace、路径和 `test:avalon`/平台门禁；无新外部依赖。 |
| `packages/contracts/src/index.ts` | modify | 严格 Poker/Avalon 判别联合、Avalon 投影/结果/设置与秘密断言。 |
| `packages/domain/src/index.ts` | modify | 有符号 checked arithmetic、Avalon 生命周期、原子押分/派分/作废、删除、恢复和不变量。 |
| `packages/test-support/src/index.ts` | modify | 判别明确的 Poker/Avalon 测试配置与辅助函数。 |
| `apps/server/src/app.ts` | modify | safe-integer API、Avalon 完整命令族、跨游戏拒绝、随机源、租约和角色化广播。 |
| `apps/web/src/avalon-ui.tsx` | add | 玩家、观战和 display 的完整固定壳层及交互。 |
| `apps/web/src/main.tsx` | modify | 游戏选择、判别创建/加入、房间卡与 Avalon 页面接入。 |
| `apps/web/src/admin-ui.tsx` | modify | Avalon 全局设置/5–10 人预设原子编辑和负基础分输入。 |
| `apps/web/src/locales.ts`、`apps/web/src/styles.css` | modify | 双语错误、主题、焦点、触控、减动效、桌面和 300px 视觉。 |
| `Dockerfile` | modify | 生产安装前复制 Avalon workspace manifest。 |
| `playwright.config.ts` | modify | 保留本地默认地址并允许显式隔离远端 base URL。 |
| `tests/avalon.test.ts` | add | 纯规则矩阵、知识、夜间、并发版本、作废与终局。 |
| `tests/avalon-platform.test.ts` | add | Fastify/领域/事务/秘密/恢复/删除/溢出与故障回滚。 |
| `tests/platform.test.ts`、`tests/server.test.ts` | modify | 有符号资产、严格判别和 Avalon 服务集成回归。 |
| `tests/realtime.test.ts` | modify | 角色、知识、租约、display 和跨房实时隔离。 |
| `tests/capacity.test.ts` | modify | 15 账户、Poker/Avalon 双房间与多 display 容量。 |
| `tests/e2e/core.spec.ts` | modify | Chromium/WebKit 自动/手动全流程、秘密、负分、300px 与网络同步。 |
| `tests/docker-smoke.mjs` | modify | Avalon 活动中间态、负分押分、重启、旧租约、一次提交和作废退款。 |
| `AGENTS.md` | modify | 当前产品、架构、不变量、完成状态和正式未发布事实。 |

没有修改 `packages/persistence` 表结构、`deploy/**`、`.dockerignore`、正式 Compose 配置、
真实部署配置、其他 feature 的冻结工件或生成的 `dist/`。

## 4. 测试与验证

| 类型 | 命令或证据 | 观察结果 |
| --- | --- | --- |
| 最终综合 | `npm run verify:core` | passed；lint、typecheck、platform/server 37/37、Poker 15/15、realtime 5/5、生产 build/static、Chromium/WebKit 8/8。 |
| Avalon 规则 | `npm run test:avalon` | passed，1 file / 8 tests。 |
| 容量与隔离 | `npm run test:capacity` | passed，1 file / 4 tests；15 账户、双游戏房间、多 display。 |
| 显式生产构建 | `npm run build` | passed；Web 47 modules，server ESM bundle；2 个 HTML/CSS 文件无公网资源。 |
| 差异卫生 | `git diff --check` 与未跟踪/临时项审计 | passed；无空白错误、秘密、真实配置或保留测试归档。 |
| 隔离 Docker | 在 `192.168.100.1` 随机临时归档执行 `npm run test:docker-smoke` | passed；`linux/amd64`、UID 1000、healthy、离线启动、旧偏好、Avalon 负分押分/秘密/投票/任务恢复与作废、Poker 私牌和命名卷恢复。 |
| 隔离 Chromium | 随机容器端口、全新卷运行 Avalon E2E | passed，1/1（17.1s）。 |
| 隔离 WebKit | 同一随机命名空间重建全新卷后运行 Avalon E2E | passed，1/1（2.4m）。 |
| 独立浏览器审阅 | 桌面、300px 和匿名 display | passed；300px 无页面横溢；display 为 0 buttons、0 inputs、0 secret。 |
| 正式资源审计 | 隔离测试前后只读检查 | passed；正式容器/镜像、固定卷、release `67e68cea…`、备份大小 `1425408` 与 SHA-256 `346072bb…`、无锁和 health version 726 不变。 |
| 随机资源清理 | 精确 inspect 后删除本轮随机容器、卷、镜像、归档和临时目录 | passed；残留 0。 |

用户级 npm cache 日志清理 `EPERM` 警告不改变任何命令退出码、lockfile 或交付证据；未把
该警告当作通过依据，也不构成 delivered-function finding。

## 5. 发现项与处置

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

验证结论为 `passed`，不是 `passed_with_findings`。下一可用 initial finding ID 仍为
`FND-I-001`。

## 6. 决策、计划偏差与恢复记录

- 采用已记录的 `single + expanded + relaxed`，没有改变验收层级、阶段边界或阶段计划修订。
- 远端生产镜像首次构建发现 Dockerfile 未在 `npm ci` 前复制新增 workspace manifest；
  这是本阶段 build/runtime 硬门禁，已补齐并由后续远端生产构建、Docker smoke 和本地 build
  独立证明。
- 远端 LAN 回归暴露 E2E 夹具连续玩家操作时未等待服务端权威版本，以及手动夜间按钮随状态
  重建的时序问题。服务端正确拒绝过期命令；夹具改为逐票、逐任务、逐夜间步骤等待公共投影
  版本/计数后，本地与两种远端浏览器均通过。该问题已闭合，没有产品影响或开放 finding。
- 每次失败尝试只使用可证明归属的随机资源并在重试前清空；最终所有远端随机资源已删除。
  隔离验收从未切换 `home-table`、固定卷、正式发布目录或唯一备份，也不冒充正式发布。
- 没有迁移、半应用状态、用户工作区 overlap、未解释文件或需要人工恢复的现场。

## 7. 遗留风险与下一阶段进入条件

- P-001 是唯一且最终阶段；没有下一执行阶段，运行可进入 `finalizing`。
- 正式 `home-table` 仍运行旧 Git `67e68cea…`。正式发布明确不属于本 initial；若未来需要
  发布，应在干净提交上通过受支持部署入口另行授权执行。
- initial 收口必须生成并互相核对 `effective-requirements.md`、`change-0.md` 和 completed
  execution state；完成后原始需求、路线图、阶段计划/结果和 initial 状态冻结。
- 后续任何产品需求必须创建连续的 `change-1` 运行，不得改写本阶段结果。
