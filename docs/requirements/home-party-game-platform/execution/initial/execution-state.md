# 家庭聚会游戏平台：首次实现执行状态

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：`change-0.md`
- 运行状态：`blocked`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`
- 当前路线图修订：`1`
- 需求指纹：`sha256:92d44a0fef69bf1d25a698bebe54156a4e6496cf38d6d27d7fe5d462406bba1e`
- 路线图或变更计划指纹：`sha256:aecddaa28948a0eb4f7b12a4d58819afbc36cd2b1d1d131b394a2342f880df3c`
- 当前阶段：`P-001`
- 当前任务：`P-001-T-003`
- 项目基线：`git 57996021ff2df803fc792002f3ecb0f0b680cbc9`；工作树干净且除功能工作流文档外无项目文件
- 下一个发现项编号：`FND-I-001`
- 最后更新时间：`2026-07-26`

## 1. 运行目标或待生效变更

按 `requirements.md` 与 `implementation-plan.md` 首次实现家庭聚会游戏平台，在一个紧凑阶段内完成平台公共能力、两种德州扑克模式、响应式双语客户端、公共大屏、SQLite 持久化和 x86-64 iStoreOS Docker 部署。最终目标记录为 `change-0.md`；该记录尚未创建，初始历史尚未冻结。

## 2. 阶段状态

| 阶段 | 计划 | 计划修订 | 状态 | 首个/当前任务 | 退出门禁 |
| --- | --- | --- | --- | --- | --- |
| P-001 | `phase-001-plan.md` | 1 | blocked | P-001-T-003 | 28 个 core 与全部硬门禁通过；2 个 supplemental 通过或以无交付影响的 FND-I-* 汇总；生产容器和数据卷恢复通过 |

只有 P-001 处于活动状态；没有其他已规划、进行中或完成阶段。

## 3. 当前检查点

- 规划模式：初始路线图模式。
- schema：`3.2`，契约路径与需求路径匹配。
- 需求审计：通过；FR-001–FR-057 连续，AC-001–AC-030 连续，其中 28 个 core、2 个 supplemental；未决问题明确为“无”。
- 交付策略：需求中的用户明确选择为 `relaxed`，未由规划者推断。
- 路线图：修订 1，`single` + `compact`，P-001 已 `ready`。
- 阶段计划：修订 1，指纹 `sha256:c52c7decce7ec9b0032160207e0bb37a1ad3f7d08e0f8edec18edfbb49785ab9`。
- 项目检查：规划后已初始化 Git，当前提交为 `57996021ff2df803fc792002f3ecb0f0b680cbc9`；当前差异均由 P-001 的累计文件表解释，未发现 `AGENTS.md` 或用户工作重叠。
- 当前安全状态：P-001-T-001 与 P-001-T-002 已完成；P-001-T-003 的文件修改、核心重验、容量检查和生产构建已完成，但 Docker 硬门禁因本机没有 Docker CLI/daemon 而阻塞。未创建阶段结果或最终记录。
- 实际文件范围：生产 `Dockerfile`、`.dockerignore`、`deploy/compose.yml` 与运行说明；静态资产检查器、容量测试、Docker 离线/健康/数据卷重启烟雾脚本；服务端拒绝日志字段。
- 已观察验证：`npm run verify:core` 通过；`npm run test:capacity` 为 2/2；`npm run build` 通过并证明生产前端/服务端产物生成且 HTML/CSS 无外部资产引用；`npm run test:docker-smoke` 未执行容器步骤，明确失败为 “Docker CLI/daemon is required”。
- 未完成的硬门禁：尚无 x86-64 镜像实际构建、非 root 容器启动、无网络运行、健康检查、`/data` 卷以及容器重启前后状态/资产指纹证据。根据 schema 3.2，这些构建/运行/恢复项不能降级为 finding。

## 4. 已完成任务

| 任务 | 结果 | 实际文件 | 验证 | 偏差 |
| --- | --- | --- | --- | --- |
| P-001-T-001 | 完成 | 根配置；`apps/server`；`packages/contracts`、`packages/domain`、`packages/persistence`、`packages/test-support`；平台测试 | lint、typecheck、6/6 定向测试通过 | 本机 Node.js 为 20.13.1，生产目标仍锁定 Node 24；首次 SQLite 迁移测试暴露引导表顺序错误，修复后重跑通过 |
| P-001-T-002 | 完成 | `packages/poker`；`apps/web`；服务端游戏适配；浏览器配置与运行器；扑克/实时/E2E 测试 | typecheck；5/5 poker；3/3 realtime；6/6 Chromium/WebKit | 首次扑克测试暴露翻牌前首个行动者索引错误并已修复；Playwright 托管 Vite 在 Windows 沙箱退出时挂起，改为仓库运行器显式管理进程后相同场景完整通过 |

## 5. 运行累计文件变化

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `implementation-plan.md` | add | 建立初始单阶段紧凑路线图、全局设计与完整追踪 |
| `execution/initial/phase-001-plan.md` | add | 建立且仅建立下一个可执行阶段 P-001 的详细计划 |
| `execution/initial/execution-state.md` | add | 初始化首次实现的可恢复协调状态 |
| `.gitignore`、`package.json`、`package-lock.json`、`tsconfig.json`、`eslint.config.js` | add | 建立可重复 npm/TypeScript workspace、工具门禁和生成物边界 |
| `apps/server/**` | add | Fastify HTTP/WebSocket 入口、健康检查、静态托管与脱敏日志 |
| `packages/contracts/**` | add | 权威命令、状态、房间与角色投影共享契约 |
| `packages/domain/**` | add | 账户、租约、房间、赛季、排行榜和守恒资产领域 |
| `packages/persistence/**` | add | SQLite 迁移、快照、幂等结果、事务回滚和截止时间恢复 |
| `packages/test-support/**`、`tests/platform.test.ts`、`tests/server.test.ts` | add | 确定性平台、持久化与服务启动证据 |
| `packages/poker/**` | add | 纯德州扑克状态机、洗牌、牌型、行动、底池、撤销与自动推进 |
| `apps/web/**` | add | 响应式双语大厅、设置/赛季 modal、玩家牌桌、筹码缓存与只读大屏 |
| `apps/server/src/app.ts` | modify | 增加角色过滤订阅和扑克命令适配，移除 WebSocket 原始私有快照 |
| `playwright.config.ts`、`scripts/run-e2e.mjs`、`tests/poker.test.ts`、`tests/realtime.test.ts`、`tests/e2e/core.spec.ts` | add | G-002 规则、隐私、并发及 Chromium/WebKit 核心流程证据 |
| `Dockerfile`、`.dockerignore`、`deploy/compose.yml`、`deploy/README.md`、`README.md` | add | x86-64 Node 24 非 root 生产镜像、数据卷、健康检查和 iStoreOS 运维约定 |
| `scripts/verify-static-assets.mjs`、`tests/capacity.test.ts`、`tests/docker-smoke.mjs` | add | 本地资产、目标容量、离线容器与重启恢复门禁 |
| `apps/server/src/app.ts` | modify | 为拒绝命令记录无 payload、无租约、无手牌的结构化诊断字段 |

需求与契约未修改；生产与验证文件变化均已列入上表。

## 6. 测试与验证证据

| 日期 | 类型 | 证据 | 结果 |
| --- | --- | --- | --- |
| 2026-07-26 | 需求结构审计 | 57 个唯一 FR、30 个唯一 AC、12 个 NFR；AC 分层为 28 core / 2 supplemental；`relaxed` 有用户明确来源 | 通过 |
| 2026-07-26 | 契约与路径审计 | schema 3.2；契约声明的需求、路线图、执行根和阶段文件路径均可解析 | 通过 |
| 2026-07-26 | 项目基线审计 | 当前 Git 修订 `57996021ff2df803fc792002f3ecb0f0b680cbc9`；工作树干净，递归检查仅发现需求与契约，未发现 Agent 指令、代码、配置或测试 | 通过；Git 为规划后的可解释基线变化 |
| 2026-07-26 | 本机工具链 | Node.js `v20.13.1`、npm `10.5.2`；未安装 Docker CLI | T-001 可执行；Docker 只影响后续 G-003 实机烟雾门禁 |
| 2026-07-26 | 需求指纹 | `sha256:92d44a0fef69bf1d25a698bebe54156a4e6496cf38d6d27d7fe5d462406bba1e` | 已记录 |
| 2026-07-26 | 路线图指纹 | `sha256:aecddaa28948a0eb4f7b12a4d58819afbc36cd2b1d1d131b394a2342f880df3c` | 已记录 |
| 2026-07-26 | P-001-T-001 lint | `npm run lint` | 通过 |
| 2026-07-26 | P-001-T-001 类型 | `npm run typecheck` | 通过 |
| 2026-07-26 | P-001-T-001 平台测试 | `npm run test:platform` | 通过：2 个文件、6 个测试 |
| 2026-07-26 | P-001-T-002 类型 | `npm run typecheck` | 通过 |
| 2026-07-26 | P-001-T-002 扑克规则 | `npm run test:poker` | 通过：1 个文件、5 个测试 |
| 2026-07-26 | P-001-T-002 实时与投影 | `npm run test:realtime` | 通过：1 个文件、3 个测试 |
| 2026-07-26 | P-001-T-002 浏览器 | `npm run test:e2e:core` | 通过：Chromium 桌面＋WebKit 移动，6 个场景 |
| 2026-07-26 | P-001-T-003 最终聚合 | `npm run verify:core` | 通过：lint、typecheck、6 platform、5 poker、3 realtime、6 Chromium/WebKit E2E |
| 2026-07-26 | P-001-T-003 容量 | `npm run test:capacity` | 通过：15 账户、2 房间、多大屏隔离与重复命令重放，2/2 |
| 2026-07-26 | P-001-T-003 生产构建 | `npm run build` | 通过：Vite 生产客户端、tsup 服务端、2 个 HTML/CSS 产物无外部资源引用 |
| 2026-07-26 | P-001-T-003 Docker 烟雾 | `npm run test:docker-smoke` | 阻塞：本机找不到 Docker CLI/daemon，未进入镜像或容器步骤 |
| 2026-07-26 | BLK-I-001 恢复复查 2 | `Get-Command docker,podman,nerdctl,buildah`、`Env:DOCKER_HOST` 与 WSL 检查 | 仍无本地或远程容器运行时；恢复条件未满足，未重复无意义的 Docker 烟雾 |
| 2026-07-26 | BLK-I-001 恢复复查 3 | 指纹复核、Git 差异、`Get-Command docker,podman,nerdctl,buildah` 与 `wsl.exe --status` | 工作流与实现无漂移；第三次仍无可用容器运行时，目标进入持久 blocked 状态 |

## 7. 决策、待确认问题与回答

规划使用需求中已记录的 D-001–D-030。关键运行决策为：用户明确选择 `relaxed`；项目现状确认空白基线；技术方案采用可逆的 Node.js 24 LTS/TypeScript、单进程 Fastify、SQLite 事务和 React/Vite 客户端；路线图采用 `single` + `compact`。

| ID | 阶段/任务 | 问题 | 已确认事实 | 可选方案与影响 | 需要确认 | 状态 | 用户回答及来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| — | P-001 | 无未决问题 | 需求第 13 节明确为“无”且审计未发现必须发明的产品行为 | — | — | resolved | `requirements.md` |

## 8. 发现项、偏差、风险与阻塞

- 当前无 `FND-I-*` 发现项；下一个可分配编号为 `FND-I-001`。
- 当前无产品决策、用户工作重叠或 P-001-T-001 阻塞。项目从计划记录的非 Git 基线变为干净 Git 仓库，已作为可解释的非生产漂移记录。
- P-001-T-001 的唯一实现内诊断偏差为首次迁移在创建 `schema_migrations` 前查询该表；已在迁移入口显式引导该表，全部 G-001 证据随后通过。
- npm 默认缓存目录受工作区沙箱限制，改用忽略的 `.npm-cache`；依赖通过镜像下载并由 `package-lock.json` 锁定。此项不影响交付行为。
- P-001-T-002 首次规则测试发现三人桌翻牌前首个行动者错误地停在大盲；已改为大盲后的首个可行动玩家，全部扑克证据通过。
- Playwright 的内建 `webServer` 在当前 Windows 沙箱中完成断言后无法收尾；仓库运行器现以直接子进程启动/停止 Vite。相同 Chromium/WebKit 场景 6/6 通过，无开放 finding。
- P-001-T-003 首次最终 lint 检查发现一个未使用导入和 Node 脚本缺少 ESLint 环境声明；修复配置和导入后，完整 `verify:core` 通过。
- 阻塞项 `BLK-I-001`：当前环境没有 `docker.exe`，`where.exe docker` 无结果，WSL 未安装，`npm run test:docker-smoke` 在任何容器写入前退出。影响为 AC-027 与生产构建/运行/恢复硬门禁缺少独立证据；该项不是 supplemental finding。
- `BLK-I-001` 已在原始执行与两次连续恢复调用中重复确认三次；除等待 Docker CLI/daemon 或等价 x86-64 Linux runner 外，当前无法对该硬门禁取得真实证据。
- 已记录的主要实施风险为资产一致性、私有牌投影、撤销/自动推进并发、浏览器交互差异和 iStoreOS 容器恢复；对应控制和阻塞门禁见路线图 R-001–R-005。
- `relaxed` 只允许经独立证明确实不影响交付行为的 supplemental 异常作为报告项；core、硬门禁和未知影响永远阻塞。

## 9. 精确恢复步骤

1. 第一恢复动作：重新读取本状态与 `phase-001-plan.md`，并用 SHA-256 验证 `requirements.md`、`implementation-plan.md`、`phase-001-plan.md` 分别仍为 `92d44a0f...bba1e`、`aecddaa2...0df3c`、`c52c7dec...85ab9`；任一不一致时停止实现并重新进入规划审计。
2. 确认 Git 基线 `57996021ff2df803fc792002f3ecb0f0b680cbc9` 与累计文件表可解释当前差异；保留任何额外用户文件。
3. 恢复条件：在本机或等价 x86-64 Linux runner 上提供可访问的 Docker CLI 与 daemon，且允许构建 `linux/amd64` 镜像、创建临时容器和命名卷。
4. 第一恢复命令：`npm run test:docker-smoke`。该脚本使用唯一名称，验证镜像构建、无网络健康、非 root 运行路径、命名卷和容器重启指纹，并在结束时清理其临时资源。
5. 只有 Docker 烟雾通过后，才检查最新 diff 是否使其他 G-003 证据失效；需要时只重跑受影响门禁，随后完成 P-001-T-003 后置检查点、全 AC 追踪审计、阶段结果与最终化。当前不得创建 `phase-001-result.md`、`change-0.md` 或 `effective-requirements.md`。

## 10. 最终完成门禁

- P-001-T-001、P-001-T-002、P-001-T-003 均有前后检查点和完成证据。
- AC-001–AC-028、资产/隐私/兼容/构建/运行/恢复硬门禁全部通过。
- AC-029、AC-030 通过或只留下符合契约的 `FND-I-*` 报告项，且每项已证明不影响交付行为。
- 生产镜像在 x86-64 Docker 约束下不依赖公网运行，数据卷与容器重启恢复证据通过。
- P-001 的不可变结果、`change-0.md` 与 `effective-requirements.md` 内容一致，全部开放发现已汇总。
- 只有满足以上条件后，验证结论才能设为 `passed` 或 `passed_with_findings`，运行状态才能设为 `completed`。
