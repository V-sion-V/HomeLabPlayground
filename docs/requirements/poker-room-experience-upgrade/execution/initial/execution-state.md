# poker-room-experience-upgrade initial 执行状态

## 元数据

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：`change-0.md`
- 运行状态：`completed`
- schema 版本：`3.2`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 当前路线图修订：`1`
- 需求指纹：`sha256:3e794909bca607258472ec356ff8218019a7f76aeccf65d03aceab64d872c00a`
- 路线图或变更计划指纹：`sha256:065e7ac3e7e33da276c526e9edcad0f7b4db1315322a07f65e60397ea37e415a`
- 当前阶段：`P-001（completed）`
- 当前任务：`无`
- 项目基线：干净的 `main@b204ea246e4c0e9770893bc737c5c631838ff33f`
- 最后更新时间：`2026-07-28T21:37:36+08:00`

## 1. 运行目标或待生效变更

已依照批准的 [requirements.md](../../requirements.md)、[implementation-plan.md](../../implementation-plan.md) 和 [phase-001-plan.md](phase-001-plan.md) 完成房主踢人/退出与随机转让、顶栏操作、中途加入观战、首局与结算统一准备、动态面值、设置重构、亮暗主题、配置化头像以及相关兼容恢复和验证。[phase-001-result.md](phase-001-result.md)、[change-0.md](../../change-0.md) 与 [effective-requirements.md](../../effective-requirements.md) 已一致生成，initial 历史现已冻结。部署自动化和正式服务器发布不在本运行范围内。

## 2. 阶段状态

| 阶段/任务 | 状态 | 说明 |
| --- | --- | --- |
| P-001 | completed | 唯一阶段；全部 core、项目硬门禁和 supplemental 验收通过。 |
| P-001-T-001 | completed | 权威配置、数据模型、命令、投影与分层测试已完成并通过四项检查点验证。 |
| P-001-T-002 | completed | Web 与最终集成已完成；计划修订 4 的远端 Docker smoke 通过且临时资源已清理。 |

没有其他 planned、ready 或 in-progress 阶段。首次实现采用 `single + expanded`：一个完整交付阶段、两个有序任务。

## 3. 当前检查点

- 需求审计：通过。`FR-001`–`FR-021`、`AC-001`–`AC-026`、`NFR-001`–`NFR-011` 可执行且无未决产品问题。
- 工作流审计：通过。合同为 schema `3.2`，需求已批准，initial 路线图、唯一阶段计划/结果、`change-0.md` 与有效需求快照连续一致。
- 项目事实审计：完成。规划前 Git 为干净 `main@b204ea246e4c0e9770893bc737c5c631838ff33f`；现有 `Room.seats`/`PokerState.players` 分层、单 JSON 快照、事务命令、控制租约和私牌投影可作为实现基础。
- 路线图：[implementation-plan.md](../../implementation-plan.md)，修订 `1`，模式 `single`，详细程度 `expanded`。
- 即时计划：[phase-001-plan.md](phase-001-plan.md)，修订 `4`，状态 `in_progress`。修订 2 修正 Docker 测试文件路径；修订 3 增加用户授权的隔离远端 daemon 执行；修订 4 处理目标 legacy builder 未注入 `BUILDPLATFORM` 的构建兼容。
- 进入执行复核：需求指纹 `3e7949…00a` 与路线图指纹 `065e7a…15a` 均匹配；唯一 phase plan 最终修订为 4，指纹 `sha256:5fe0e199db51a06ba66837738b494950f72efff8eb90f4170582111d09ee9ee6`。
- T1 开始基线：`main@b204ea246e4c0e9770893bc737c5c631838ff33f`；产品源码与测试无跟踪改动，未跟踪项仅为本运行的 `implementation-plan.md`、`phase-001-plan.md` 和本状态文件。
- T1 预计范围：`packages/contracts/src/{product-config,index}.ts`、`packages/domain/src/index.ts`、`apps/server/src/app.ts`、`packages/test-support/src/index.ts`，以及 platform/server/poker/realtime（必要时 docker smoke）测试。
- T1 计划验证：`npm run typecheck`、`npm run test:platform`、`npm run test:poker`、`npm run test:realtime`。
- T1 完成条件：兼容恢复、成员/参赛者/准备/面值、加入/踢出/房主退出和私牌投影均有权威实现及自动化证据，四项验证全部通过且无 core 问题。
- T1 结果：完成。服务端权威先于 Web 入口建立；platform 20 项、poker 15 项、realtime 3 项及 TypeScript 检查均通过。
- T2 开始基线：T1 九个实际文件及三份规划/状态文档属于本运行；没有其他 Git 改动或用户重叠文件。
- T2 预计范围：新增 `apps/web/src/ui.tsx`，修改 `apps/web/src/main.tsx`、`styles.css`、`locales.ts`、`apps/web/index.html`、`tests/e2e/core.spec.ts` 和 `tests/capacity.test.ts`；若回改 T1 文件则重跑相应验证。
- T2 计划验证：先 `npm run lint`、`npm run typecheck`，随后执行 E2E、capacity、docker smoke 和 diff 门禁。
- T2 完成条件：设置、主题、配置头像/面值、房主管理、统一准备、登录观战、双语、300px、键盘/触控及有界筹码渲染全部集成，所有阶段最终硬门禁通过。
- T2 实现结果：完成共享 Web 控件、配置化主题/头像/面值、固定设置窗口、统一准备、房主管理、中途观战、结算后参赛与有界筹码渲染；桌面与移动 E2E 在定位并修复牌桌成员菜单遮挡后通过。
- T2 最终验证结果：lint、typecheck、生产 E2E/build/静态资源、capacity、受影响的 platform/realtime 回归、远端 Docker smoke 和 `git diff --check` 均通过。
- 恢复授权：用户明确授权利用自动化部署连接把当前功能推到服务器 Docker 测试。采用更小、可恢复的授权子集：不先切换生产服务，复用忽略配置的 SSH 边界，在远程 daemon 上运行随机临时镜像/容器/卷的原 `npm run test:docker-smoke`。
- 完成基线：Git 仍为 `main@b204ea246e4c0e9770893bc737c5c631838ff33f`；全部未提交差异已由本运行的结果、修改记录和有效需求快照解释。
- 当前精确下一步：无。initial 已完成并冻结；未来产品需求从 `effective-requirements.md` 进入新的连续 `change-N` 运行。

## 4. 已完成任务

### P-001-T-001

- 状态：completed
- 实际结果：新增共享头像/主题/筹码配置；扩展动态面值、每手快照、waiting 准备、成员角色和 viewer 角色契约；实现旧 JSON 与失效头像归一化、牌中加入、显式准备/开手、在线踢出、房主主动退出/随机转让和观众私牌隔离。
- 实际文件：
  - `packages/contracts/src/product-config.ts`
  - `packages/contracts/src/index.ts`
  - `packages/domain/src/index.ts`
  - `packages/poker/src/index.ts`
  - `apps/server/src/app.ts`
  - `tests/platform.test.ts`
  - `tests/server.test.ts`
  - `tests/poker.test.ts`
  - `tests/realtime.test.ts`
- 计划偏差：没有修改 `packages/test-support/src/index.ts` 或 `tests/docker-smoke.mjs`；现有测试构造器无需变更，Docker 恢复证据留在阶段最终硬门禁。阶段计划仅修正 Docker 测试文件扩展名并升为修订 2。
- 完成证据：四项计划验证全部通过，无 core 问题。

### P-001-T-002

- 状态：completed
- 实际结果：完成固定全局设置窗口、主题与共享 UI、动态头像/面值、房主管理、顶部退出/关闭、统一准备、登录观战、结算后参赛、双语响应式体验和有界筹码渲染；完成全部最终硬门禁。
- 实际文件：
  - `apps/web/src/ui.tsx`
  - `apps/web/src/main.tsx`
  - `apps/web/src/styles.css`
  - `apps/web/src/locales.ts`
  - `apps/web/index.html`
  - `tests/e2e/core.spec.ts`
  - `tests/capacity.test.ts`
  - `tests/docker-smoke.mjs`
  - `Dockerfile`
  - 为结算角色连续性回改的 `packages/domain/src/index.ts`
- 计划偏差：E2E 暴露成员菜单定位问题并在任务内修复；本机 Docker 缺失由用户授权的远端隔离 daemon 恢复；首次远端构建暴露 legacy builder 平台变量缺口，计划修订 4 增加固定 amd64 默认值后通过。
- 完成证据：lint、typecheck、生产 Chromium/WebKit 4/4、capacity 3/3、platform 20/20、realtime 3/3、远端 Docker smoke 和 `git diff --check` 全部通过。

## 5. 运行累计文件变化

本次规划运行相对干净基线只新增以下工作流文档：

- `docs/requirements/poker-room-experience-upgrade/implementation-plan.md`
- `docs/requirements/poker-room-experience-upgrade/execution/initial/phase-001-plan.md`
- `docs/requirements/poker-room-experience-upgrade/execution/initial/execution-state.md`

`requirements.md` 与 `workflow-contract.md` 未修改。产品源码、测试、部署文件、冻结历史和生成目录均未修改；规划开始时不存在需吸收或覆盖的用户工作区改动。

T1 追加的产品与测试文件：

- 新增 `packages/contracts/src/product-config.ts`
- 修改 `packages/contracts/src/index.ts`
- 修改 `packages/domain/src/index.ts`
- 修改 `packages/poker/src/index.ts`
- 修改 `apps/server/src/app.ts`
- 修改 `tests/platform.test.ts`
- 修改 `tests/server.test.ts`
- 修改 `tests/poker.test.ts`
- 修改 `tests/realtime.test.ts`

截至 T1 检查点没有 `deploy/**`、冻结工作流或生成目录改动。

T2 追加的 Web 与验收文件：

- 新增 `apps/web/src/ui.tsx`
- 修改 `apps/web/src/main.tsx`
- 修改 `apps/web/src/styles.css`
- 修改 `apps/web/src/locales.ts`
- 修改 `apps/web/index.html`
- 修改 `tests/e2e/core.spec.ts`
- 修改 `tests/capacity.test.ts`

T2 为修复成员角色在结算投影中的连续性，回改了 `packages/domain/src/index.ts`；相应的 typecheck、platform 和 realtime 已在最终源码状态重跑通过。实际 diff 仍未触及 `deploy/**`、`.dockerignore`、冻结工作流或生成目录。

T2 的远端 Docker smoke 首次运行暴露目标 daemon 使用 legacy builder 且未注入 BuildKit 自动 `BUILDPLATFORM`。计划修订 4 增加 `Dockerfile` 的 `linux/amd64` 默认参数；它保持项目既有目标架构和 BuildKit 覆盖语义，不修改 `deploy/**` 或发布命令接口。

T2 最终追加的容器与工作流文件：

- 修改 `tests/docker-smoke.mjs`
- 修改 `Dockerfile`
- 新增 `execution/initial/phase-001-result.md`
- 新增 `change-0.md`
- 新增 `effective-requirements.md`
- 完成更新 `execution/initial/execution-state.md` 与 `AGENTS.md`

暂停检查点同步修改根 `AGENTS.md` 的带日期阶段快照，使后续 agent 不会把本功能误判为“尚未规划”；该文档改动不改变产品或验证范围。

## 6. 测试与验证证据

阶段验证结论为 `passed`。以下通过结果来自最终源码状态；T1 的 poker 结果仍有效，T2 未修改扑克引擎或对应测试。

| 时点 | 待运行验证 | 状态 |
| --- | --- | --- |
| T1 检查点 | `npm run typecheck` | passed；TypeScript 无错误 |
| T1 检查点 | `npm run test:platform` | passed；2 files、20 tests |
| T1 检查点 | `npm run test:poker` | passed；1 file、15 tests |
| T1 检查点 | `npm run test:realtime` | passed；1 file、3 tests |
| T2/最终 | `npm run lint` | passed；ESLint 无错误 |
| T2/最终 | `npm run typecheck` | passed；T2 与回改后的最终源码无 TypeScript 错误 |
| T2/最终 | `npm run test:e2e:core`（含生产 build 与静态资源检查） | passed；Chromium desktop 与 WebKit mobile 共 4 tests；构建成功且 2 个 HTML/CSS 产物无公网资源 |
| T2/最终 | `npm run test:capacity` | passed；1 file、3 tests，覆盖 15 账户、双房间和多 display |
| T2/回归 | `npm run test:platform` | passed；2 files、20 tests |
| T2/回归 | `npm run test:realtime` | passed；1 file、3 tests |
| T2/最终 | `npm run test:docker-smoke` | not run / blocked；命令以 1 退出并报告 `Docker CLI/daemon is required for test:docker-smoke.`；只读检查确认常见 Docker/Rancher CLI 路径、Docker 服务和进程均不存在 |
| T2/远端恢复 | `npm run test:docker-smoke` | failed；临时 Docker CLI 成功连接 iStoreOS daemon，但 legacy builder 在 `FROM --platform=$BUILDPLATFORM` 解析到空平台后退出；失败发生在镜像构建第一步，脚本 `finally` 已执行资源清理 |
| T2/远端最终 | `npm run test:docker-smoke` | passed；Docker 29.6.2 client / 27.3.1 server / API 1.47 / amd64，当前工作树冷构建、离线健康、非 root、随机命名卷牌局与私牌重启恢复全部通过 |
| T2/远端后置审计 | 正式服务与随机资源只读检查 | passed；正式 b949 容器仍 healthy、固定业务卷存在；smoke 容器、卷、镜像标签均为空 |
| T2/最终重跑 | `npm run lint`、`git diff --check` | passed；Docker 修正后的最终工作树无 lint 或空白错误 |
| T2/最终 | `git diff --check` | passed |

`npm run test:deploy` 未纳入计划，真实 iStoreOS 部署也未获授权。若实际范围触及部署文件或发布接口，必须先修订计划。

## 7. 决策、待确认问题与回答

### 已确认决策

- 用户选择 `relaxed` 交付与验证策略。
- “房主不需要准备”采用 A：房主始终自动参赛，房主加至少一名有效已准备玩家即可开手。
- 其余澄清项采用已批准 requirements 中的默认值。
- 路线图为 `single + expanded`；一个阶段避免人为拆断同一产品交付，展开计划控制持久化、资产、隐私、并发和恢复风险。
- waiting 准备使用房间级集合，complete 继续使用现有扑克准备集合，对外统一为一套命令/投影语义。
- 全局面值存入现有 JSON 快照，活动手牌持有每手快照；不新增 SQL migration。
- 主题、头像和筹码视觉配置位于共享 contracts 配置模块，不增加运行时依赖或公网资源。
- 用户在 2026-07-28 明确授权利用现有自动化部署连接访问服务器 Docker 做本阶段测试；执行采用不触碰正式服务/固定卷的隔离 smoke 子集。

### 待确认问题与回答

| ID | 阶段/任务 | 问题 | 已确认事实 | 可选方案与影响 | 需要确认 | 状态 | 用户回答及来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| — | P-001 | 无未决问题 | requirements 已批准且所有 material decisions 已落盘 | — | 否 | resolved | 用户确认准备人数采用 A，其余采用默认；见 requirements 决策表。 |

## 8. 发现项、偏差、风险与阻塞

- 当前 severity-rated findings：无。
- 下一个稳定发现编号：`FND-I-001`。
- 当前阻塞：无。原本地 Docker 环境阻塞已由用户授权的隔离远端 daemon 验证关闭；legacy builder 平台变量缺口已修正并由最终 smoke 复验。
- 验证环境观察：npm 在各成功命令后报告无法扫描用户 npm 日志缓存的 `EPERM` 警告；所有命令均以 0 退出，测试与产物未受影响，不构成 finding 或门禁失败。
- E2E 修复记录：首次扩展场景暴露牌桌成员菜单被底部操作区拦截指针事件；通过 trace 证据修复参与者与观众成员菜单定位后，Chromium 与 WebKit 四个生产场景均通过。其余早期 E2E 失败均为测试与新确认/折叠语义未同步或配置色值断言过期，已修正并由最终通过结果取代。
- 主要风险：
  - 登录观众、房主或 display 收到他人私牌；
  - 加入、踢出、退出、开手竞争破坏资产守恒或产生无房主窗口；
  - 旧活动手牌升级后错误读取新面值；
  - 显式准备导致自动开手残留或半完成 UI；
  - 动态 `[1]` 面值产生无界 DOM；
  - Docker/浏览器环境不可用使 core 门禁无法执行。
- 风险控制和各检查点见 [phase-001-plan.md](phase-001-plan.md)。`relaxed` 不允许把 core、资产、私牌、恢复、构建或硬门禁失败降级为可接受发现。

## 9. 精确恢复说明

本运行已完成且执行状态不可变：

1. 不得继续修改 `requirements.md`、`implementation-plan.md`、`phase-001-plan.md`、`phase-001-result.md`、本状态或 `change-0.md` 来承载新产品需求。
2. 后续产品需求从 `effective-requirements.md` 出发，通过新的连续 `change-N` 运行规划和实施。
3. 本次远端 smoke 没有部署正式服务。生产发布仍须从干净、已提交的 Git HEAD 使用 `deploy/README.md` 支持的自动化入口，并单独确认维护窗口、固定卷和唯一备份。

## 10. 最终完成门禁

P-001 只有在以下条件全部满足后才能写为 completed：

1. 两项任务均完成，全部 `FR-*`、`AC-*` 和 `NFR-*` 有实现及有效证据。
2. 所有 core 与项目硬门禁在最终源码状态通过，验证结论从 `pending` 更新为 `passed`。
3. 不存在 unresolved critical/high 发现或影响行为、资产、隐私、恢复、构建和可操作性的 blocker。
4. 写入不可变 `execution/initial/phase-001-result.md`，其中记录实际 diff、命令结果、证据和发现。
5. 路线图所有阶段完成后，生成 `change-0.md` 和 `effective-requirements.md`，把 initial 状态标记 completed。
6. 不把模拟、本地构建或历史证据描述为新的真实服务器验收；真实部署仍需另行明确授权。

以上条件全部满足；验证结论为 `passed`，运行状态为 `completed`。
