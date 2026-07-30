# 阿瓦隆游戏 initial：执行状态

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：`change-0.md`
- 运行状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 当前路线图修订：`1`
- 需求指纹：`sha256:7b27e53479b995e9aa5decb9a73f29f91ee015cd7ad9a7ec56765d14765b936d`
- 路线图或变更计划指纹：`sha256:b53079171c9e4a4bd238d503547a2c7663274b0b08207dda0eb933a286ce012c`
- 当前阶段计划修订：`1`
- 当前阶段计划指纹：`sha256:a0c7c3dd3b2a91014cb4ba57ad5adf4bc751e2abec221c834394cba723e51afb`
- 当前阶段：无（`P-001` 已完成）
- 当前任务：无（`P-001-T-003` 已完成，等待阶段结果）
- 项目基线：`main@67e68cea036a41c38917e19936c27e3f7cd49f19`
- 最后更新时间：`2026-07-31`

## 1. 运行目标或待生效变更

按 [requirements.md](../../requirements.md) 首次实现完整 5–10 人原版阿瓦隆，并把平台
账户分数、赛季基础分、排行榜、流水和退役迁移为有符号安全整数语义。交付必须同时保留
扑克正数游戏资产、服务器权威、SQLite 原子性/恢复、租约秘密隔离、匿名只读 display、
双语和离线容器边界。

本运行采用用户明确选择的 `relaxed` 策略。AC-001–AC-027、全部安全/隐私/数据/兼容/
构建/恢复硬门禁阻塞；AC-028–AC-031 只有在独立证明无交付影响时才可保留 report-only
finding。

## 2. 阶段状态

| 阶段 | 目标 | 状态 | 计划 | 结果 | 当前说明 |
| --- | --- | --- | --- | --- | --- |
| P-001 | 完整阿瓦隆、全平台有符号资产和本地/隔离 iStoreOS 验收 | completed | [phase-001-plan.md](phase-001-plan.md) rev 1 | [phase-001-result.md](phase-001-result.md) | T1–T3、阶段退出门禁、change-0 与有效需求快照一致；initial 已冻结 |

路线图模式为 `single`，详细程度为 `expanded`。P-001 包含三个有序任务，最终集成和 initial
收口属于同一阶段。

## 3. 当前检查点

- 检查点类型：initial completed / frozen checkpoint。
- 当前阶段：无；P-001 `completed`。
- 当前任务：无；T1–T3 completed，最终本地与隔离环境证据对应当前源码。
- 基线与 overlap：HEAD 仍为 `67e68cea…`；当前 diff 仅含本功能规划、实现、测试和收口工件，没有
  新的用户改动或未知 overlap。
- T3 结果：大厅游戏选择、管理员 Avalon 原子设置、完整玩家/观战/display 流程、遮盖私密区、
  自动/手动夜间、投票/任务/刺杀/结算/作废、双语、主题、音量、300px 和只读大屏均完成。
- 最终门禁：`verify:core`、Avalon、capacity、显式 build/static、远端随机 Docker smoke、
  Chromium/WebKit 隔离浏览器流程与独立视觉检查全部通过。
- 远端边界：只使用随机容器、卷、镜像、端口和 `/tmp` 归档；全部已删除。正式容器、镜像、
  固定卷、发布标记、唯一备份、部署锁与 health 前后逐项一致，未执行正式发布。
- 收口结果：[change-0.md](../../change-0.md) 与
  [effective-requirements.md](../../effective-requirements.md) 已生成并与本状态一致。
- 下一动作：无 initial 执行工作；未来需求必须新建连续 `change-1`，不得修改冻结工件。

## 4. 已完成任务

| 任务 | 状态 | 结果 | 验证 |
| --- | --- | --- | --- |
| P-001-T-001 | completed | 有符号资产与纯 Avalon 规则基础完成；未开放 Avalon API | typecheck passed；Avalon 8/8；platform/server 31/31；poker 15/15 |
| P-001-T-002 | completed | 严格游戏判别、Avalon 平台生命周期、原子资产、角色化投影、Fastify 命令和恢复完成 | typecheck passed；Avalon 8/8；platform/server 37/37；poker 15/15；realtime 5/5 |
| P-001-T-003 | completed | 玩家、管理员与 display 全流程、最终本地门禁及隔离 iStoreOS 验收完成 | verify:core passed；Avalon 8/8；capacity 4/4；remote Docker smoke passed；remote Chromium/WebKit passed |

## 5. 运行累计文件变化

### 5.1 规划前用户输入

| 文件 | 基线状态 | 所有权与处理 |
| --- | --- | --- |
| `docs/requirements/avalon-game/requirements.md` | 未跟踪 | 用户提供的已澄清产品权威；保留并纳入最终 feature 历史，不冒充实现编辑。 |
| `docs/requirements/avalon-game/workflow-contract.md` | 未跟踪 | 用户提供的 schema-v3.2 合同；保持不变。 |

### 5.2 本运行规划工件

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `docs/requirements/avalon-game/implementation-plan.md` | add | 路线图 rev 1、全局设计、唯一阶段和完整追踪。 |
| `docs/requirements/avalon-game/execution/initial/phase-001-plan.md` | add | P-001 rev 1 的三个有序任务、门禁、风险和恢复。 |
| `docs/requirements/avalon-game/execution/initial/execution-state.md` | add | initial 的 durable coordination authority。 |

T1 之后的产品与测试变化如下；未保留生成物。

### 5.3 P-001-T-001 实际变化

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/avalon/package.json` | add | 私有 ESM Avalon workspace。 |
| `packages/avalon/src/index.ts` | add | 原版规则矩阵、角色配置、知识、夜间和完整纯状态机。 |
| `tests/avalon.test.ts` | add | 六人数、角色、知识、夜间、投票、任务、刺杀、版本和作废证据。 |
| `package.json`、`package-lock.json`、`tsconfig.json` | modify | 注册 workspace、`test:avalon` 和 TypeScript 路径；无新外部依赖。 |
| `packages/contracts/src/index.ts` | modify | 增加独立 Avalon/GameType 值与状态类型；command platform version 改为 safe integer。 |
| `packages/domain/src/index.ts` | modify | checked arithmetic、有符号发行/负债/退役守恒、排行榜比较和扑克透支兼容。 |
| `apps/server/src/app.ts` | modify | 现有金额/版本 Zod 使用 safe integer；赛季基础分接受有符号值。 |
| `tests/platform.test.ts`、`tests/server.test.ts` | modify | 负基础分、扑克透支、负债退役、极值回滚和管理员 API 证据。 |

T1 未修改持久化实现、Web、部署接口或其他 feature 工件。

### 5.4 P-001-T-002 实际变化

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/contracts/src/index.ts` | modify | 完成 Poker/Avalon Room、配置、大厅、投影和结果判别联合，增加 Avalon 全局设置与秘密断言。 |
| `packages/domain/src/index.ts` | modify | Avalon 成员/准备/配置、冻结对局、押分托管、状态转换、结算/作废、参与事实、删除匿名化、恢复和守恒不变量。 |
| `apps/server/src/app.ts` | modify | 严格游戏判别 Zod、Avalon 完整外部命令族、跨游戏拒绝、随机源和角色化广播。 |
| `packages/test-support/src/index.ts` | modify | 显式 Poker/Avalon 默认配置和判别辅助函数。 |
| `apps/web/src/main.tsx` | modify | 机械迁移既有 Poker 调用者的严格判别和显式 Poker payload；Avalon 可达 UI 留给 T3。 |
| `tests/avalon-platform.test.ts` | add | Fastify、原子结算、负分押分、秘密、恢复、幂等、租约、跨游戏、作废删除、溢出和故障回滚。 |
| `tests/platform.test.ts`、`tests/server.test.ts`、`tests/realtime.test.ts`、`tests/capacity.test.ts` | modify | 迁移严格判别，并增加 Avalon viewer/秘密隔离与现有 Poker 兼容证据。 |
| `package.json` | modify | 把 Avalon 平台集成测试纳入 `test:platform` 正式门禁。 |

T2 未修改 SQLite 表结构、部署状态机、正式 Compose 资源或其他 feature 的冻结历史。

### 5.5 P-001-T-003 实际变化

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `apps/web/src/avalon-ui.tsx` | add | 固定三段式 Avalon 玩家/观战/display 壳层、私密遮盖、夜间、提名、投票、任务、刺杀、结算和管理控件。 |
| `apps/web/src/main.tsx` | modify | 大厅游戏选择、Poker/Avalon 判别创建与加入、房间卡摘要、Avalon 路由和权威版本草稿清理。 |
| `apps/web/src/admin-ui.tsx` | modify | Avalon 默认模式、奥伯伦、押分和 5–10 人预设的原子编辑与客户端即时校验；历史赛季基础分接受负数。 |
| `apps/web/src/locales.ts`、`apps/web/src/styles.css` | modify | 中英文文案、友好错误、主题/焦点/触控/减动效、桌面与 300px 固定容器视觉。 |
| `tests/e2e/core.spec.ts`、`playwright.config.ts` | modify | Chromium/WebKit 全流程、隐私、负分、300px、公共 display 和跨网络权威版本同步；允许显式远端 base URL。 |
| `tests/capacity.test.ts` | modify | 15 个在线账户、Poker/Avalon 双房间与多 display 的容量及跨房隔离。 |
| `tests/docker-smoke.mjs` | modify | 隔离容器内负分押分、私有角色、投票/任务中间态、重启、租约失效、完成一次且作废退款证据。 |
| `Dockerfile` | modify | 在生产依赖安装前复制新增 Avalon workspace manifest，使隔离 `linux/amd64` 构建可解析完整 workspace。 |

T3 没有修改 `deploy/**`、`.dockerignore`、正式部署状态机、正式 Compose 资源或其他 feature
冻结工件。`AGENTS.md` 与本 feature 收口工件已在 initial 完成时同步。

### 5.6 阶段与 initial 收口工件

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `AGENTS.md` | modify | 同步双游戏产品、架构、不变量、门禁和正式未发布事实。 |
| `docs/requirements/avalon-game/execution/initial/phase-001-result.md` | add | 冻结 P-001 completed / passed 结果。 |
| `docs/requirements/avalon-game/effective-requirements.md` | add | change-0 后的可重新生成当前产品权威。 |
| `docs/requirements/avalon-game/change-0.md` | add | 首次实现的连续编号冻结记录。 |

## 6. 测试与验证证据

| 日期 | 类型 | 命令或检查 | 结果 |
| --- | --- | --- | --- |
| 2026-07-31 | 只读基线 | `git rev-parse HEAD`、`git status --porcelain=v1` | HEAD 为 `67e68cea…`；规划前仅本功能 requirements/contract 未跟踪。 |
| 2026-07-31 | 需求审计 | 完整读取 schema 3.2 合同、requirements、README、AGENTS、UI 规范和相关源码/测试边界 | passed；交付策略、全部 AC 层级、必须回答决策和未决问题完整。 |
| 2026-07-31 | 指纹 | SHA-256 requirements/roadmap/phase plan | 与本状态 metadata 一致。 |
| 2026-07-31 | T1 类型 | `npm run typecheck` | passed。 |
| 2026-07-31 | T1 Avalon | `npm run test:avalon` | passed，1 file / 8 tests。 |
| 2026-07-31 | T1 平台/服务 | `npm run test:platform` | passed，2 files / 31 tests。 |
| 2026-07-31 | T1 Poker | `npm run test:poker` | passed，1 file / 15 tests。 |
| 2026-07-31 | T2 类型 | `npm run typecheck` | passed。 |
| 2026-07-31 | T2 Avalon | `npm run test:avalon` | passed，1 file / 8 tests。 |
| 2026-07-31 | T2 平台/服务 | `npm run test:platform` | passed，3 files / 37 tests。 |
| 2026-07-31 | T2 Poker | `npm run test:poker` | passed，1 file / 15 tests。 |
| 2026-07-31 | T2 Realtime | `npm run test:realtime` | passed，1 file / 5 tests。 |
| 2026-07-31 | 最终本地综合 | `npm run verify:core` | passed；lint、typecheck、platform/server 37/37、poker 15/15、realtime 5/5、生产 build/static、Chromium/WebKit 8/8。 |
| 2026-07-31 | 最终 Avalon | `npm run test:avalon` | passed，1 file / 8 tests。 |
| 2026-07-31 | 最终容量 | `npm run test:capacity` | passed，1 file / 4 tests；15 账户、双房间和多 display。 |
| 2026-07-31 | 最终构建 | `npm run build` | passed；47 Web modules、server ESM bundle，2 个 HTML/CSS 文件无公网资源引用。 |
| 2026-07-31 | 隔离 Docker | 远端临时归档执行 `npm run test:docker-smoke` | passed；`linux/amd64`、非 root、health、旧偏好、Avalon 负分押分/私有角色/投票/任务恢复与作废、Poker 私牌、账户删除和命名卷重启。 |
| 2026-07-31 | 隔离浏览器 | 随机容器端口上的 Avalon E2E | passed；Chromium desktop 1/1（17.1s），WebKit mobile 1/1（2.4m），各自使用全新卷。 |
| 2026-07-31 | 独立 UI 检查 | 浏览器技能检查桌面、300px 与匿名 display | passed；300px viewport/document width 均为 300；display 为 0 buttons、0 inputs、0 secret。 |
| 2026-07-31 | 远端清理/正式审计 | 精确 inspect、清理随机资源、正式字段前后比较 | passed；随机容器/卷/镜像/临时目录为 0；正式 release `67e68cea…`、备份 SHA-256 `346072bb…`、无锁、health version 726 均未改变。 |

`npm install` 的用户级 npm cache 日志清理 `EPERM` 和当前 Node 20.13.1 对一个开发依赖的
engine warning 不改变退出码、lockfile 完整性或上述门禁结论；没有把警告当作测试通过
证据，也不构成 delivered-function finding。

## 7. 决策、待确认问题与回答

### 7.1 已生效决策

- 用户已在 requirements 明确选择 `relaxed`。
- 路线图使用 `single + expanded`：同步容器发布和无外部兼容期决定单阶段；有符号资产、
  秘密状态、活动删除和恢复组合风险决定 expanded。
- 用户已授权功能完成后连接 `192.168.100.1` 做部署环境测试并使用浏览器访问；计划把
  授权限制为随机隔离资源，不执行正式发布。
- 用户已明确要求 initial 完成后 Git 提交并推送 GitHub。

### 7.2 问题表

| ID | 阶段/任务 | 问题 | 已确认事实 | 可选方案与影响 | 需要确认 | 状态 | 用户回答及来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | 无 | requirements 第 13 节无未决问题 | — | — | resolved | 需求与当前请求 |

## 8. 发现项、偏差、风险与阻塞

- 当前没有 blocking finding、偏差或阻塞。
- 当前没有 report-only finding。
- 下一可用 finding ID：`FND-I-001`。
- 规划前未发现其他用户工作区改动；后续每个任务开始时重新检查 overlap。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

远端首次浏览器回归暴露测试夹具在 LAN 时延下连续提交旧 `expectedVersion`，以及手动夜间按钮
随权威状态更新重建的问题；服务端按设计拒绝了过期命令。测试改为逐次等待公共投影版本、
提交计数和夜间索引后，Chromium、WebKit 与本地完整 E2E 全部通过。该已修复的 validation-only
异常不影响交付功能，不保留 `FND-I-*`。

## 9. 精确恢复步骤

本 initial 已完成且没有恢复动作。原始 requirements、workflow contract、initial roadmap、
阶段计划、阶段结果、change-0 和本 completed state 均已冻结。

未来若提出产品变化：

1. 以 [effective-requirements.md](../../effective-requirements.md) 为当前产品权威。
2. 使用连续编号 `change-1` 建立新的 change run，并重新收集该运行的 strict/relaxed 策略。
3. 不改写本状态、`phase-001-plan.md`、`phase-001-result.md` 或 `change-0.md`。

## 10. 最终完成门禁

| 门禁 | 当前状态 |
| --- | --- |
| P-001-T-001 有符号资产与纯 Avalon 规则 | passed |
| P-001-T-002 平台/SQLite/Fastify/实时权威 | passed |
| P-001-T-003 Web/UI、本地与隔离环境验收 | passed |
| FR-001–FR-058 完整追踪 | passed |
| AC-001–AC-027 core 和项目硬门禁 | passed |
| AC-028–AC-031 supplemental 通过或合规 finding 汇总 | passed，无 finding |
| 无 unresolved、blocking finding、未知影响或远端残留 | passed |
| 正式资源未改变且隔离验收未冒充发布 | passed |
| phase result、change-0、effective snapshot 与 completed state 一致 | passed |

验证结论为 `passed`；运行状态为 `completed`，没有开放 finding、恢复动作或待执行阶段。
