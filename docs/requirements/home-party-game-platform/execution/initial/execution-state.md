# 家庭聚会游戏平台：首次实现执行状态

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：`change-0.md`
- 运行状态：`in_progress`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`
- 当前路线图修订：`1`
- 需求指纹：`sha256:92d44a0fef69bf1d25a698bebe54156a4e6496cf38d6d27d7fe5d462406bba1e`
- 路线图或变更计划指纹：`sha256:aecddaa28948a0eb4f7b12a4d58819afbc36cd2b1d1d131b394a2342f880df3c`
- 当前阶段：`P-001`
- 当前任务：`P-001-T-003`
- 项目基线：`git 57996021ff2df803fc792002f3ecb0f0b680cbc9`；工作树干净且除功能工作流文档外无项目文件
- 下一个发现项编号：`FND-I-001`
- 最后更新时间：`2026-07-27`

## 1. 运行目标或待生效变更

按 `requirements.md` 与 `implementation-plan.md` 首次实现家庭聚会游戏平台，在一个紧凑阶段内完成平台公共能力、两种德州扑克模式、响应式双语客户端、公共大屏、SQLite 持久化和 x86-64 iStoreOS Docker 部署。最终目标记录为 `change-0.md`；该记录尚未创建，初始历史尚未冻结。

## 2. 阶段状态

| 阶段 | 计划 | 计划修订 | 状态 | 首个/当前任务 | 退出门禁 |
| --- | --- | --- | --- | --- | --- |
| P-001 | `phase-001-plan.md` | 1 | in_progress | P-001-T-003 | 28 个 core 与全部硬门禁通过；2 个 supplemental 通过或以无交付影响的 FND-I-* 汇总；生产容器和数据卷恢复通过 |

只有 P-001 处于活动状态；没有其他已规划、进行中或完成阶段。

## 3. 当前检查点

- 规划模式：初始路线图模式。
- schema：`3.2`，契约路径与需求路径匹配。
- 需求审计：通过；FR-001–FR-057 连续，AC-001–AC-030 连续，其中 28 个 core、2 个 supplemental；未决问题明确为“无”。
- 交付策略：需求中的用户明确选择为 `relaxed`，未由规划者推断。
- 路线图：修订 1，`single` + `compact`，P-001 已 `ready`。
- 阶段计划：修订 1，指纹 `sha256:c52c7decce7ec9b0032160207e0bb37a1ad3f7d08e0f8edec18edfbb49785ab9`。
- 项目检查：规划后已初始化 Git；本次检查修订为 `5d250e8e3ec3d7cfdf43e2be400caedcedc8239f`，检查前工作树干净，检查后只有本执行状态证据更新；未发现 `AGENTS.md` 或用户工作重叠。
- 当前安全状态：P-001-T-001 仍有确定性通过证据；P-001-T-002 已完成纠正并重新通过 G-002 与最终聚合的本地部分。客户端现由真实 HTTP/WebSocket、SQLite 和角色投影驱动，不再使用固定演示状态；连接接管、房主断线截止时间、资产守恒、牌桌内部流水和手牌结果摘要也已接入。P-001-T-003 已恢复执行，等待目标 iStoreOS 更新镜像后的 Docker 烟雾和 Chrome 实机复验。未创建阶段结果或最终记录。
- 本次生产编辑前基线：Git 修订 `5d250e8e3ec3d7cfdf43e2be400caedcedc8239f`；仅 `execution-state.md` 含本轮已解释的工作流证据差异。预计范围为 `apps/server/src/app.ts`、`apps/web/src/**`、共享契约/领域中被真实流程暴露的缺口，以及 `tests/e2e/**` 和对应运行器。
- 本次完成条件：已满足。大厅、排行榜、设置、赛季、房间、牌桌和公共大屏均读取权威状态；真实 Fastify E2E 使用两个独立玩家上下文和独立大屏，覆盖刷新恢复、跨客户端同步、新设备接管及隐藏牌隔离；`npm run verify:core` 与 `npm run test:capacity` 通过。
- 已观察验证：本地生产构建驱动的 Chromium 桌面与 WebKit 手机测试各完成账户/资料/设置/赛季/语言持久化，以及双玩家建房、入桌、下注、大屏、刷新恢复、私有牌隔离、新设备接管和关闭兑换，共 4/4 场景通过。服务级测试还证明无租约私有投影返回 403、畸形命令返回 400、提前弃牌可在未发完整公共牌时正确结算、结果摘要与结算流水跨 SQLite 重开保留。
- 未完成的硬门禁：目标 iStoreOS 仍运行纠正前镜像；需更新后执行完整无网络、非 root、命名卷及重启状态/资产指纹烟雾，并用 Chrome 对目标部署复验真实大厅、双客户端牌局与公共大屏。该容器运行/恢复门禁不能降级为 finding。

## 4. 任务状态

| 任务 | 结果 | 实际文件 | 验证 | 偏差 |
| --- | --- | --- | --- | --- |
| P-001-T-001 | 完成 | 根配置；`apps/server`；`packages/contracts`、`packages/domain`、`packages/persistence`、`packages/test-support`；平台测试 | lint、typecheck、6/6 定向测试通过 | 本机 Node.js 为 20.13.1，生产目标仍锁定 Node 24；首次 SQLite 迁移测试暴露引导表顺序错误，修复后重跑通过 |
| P-001-T-002 | 完成（纠正后） | `packages/contracts`、`packages/domain`、`packages/poker`；`apps/server/src/app.ts`；`apps/web/src/**`；真实生产服务 E2E 运行器与平台/扑克/服务测试 | lint、typecheck；8/8 platform/server；6/6 poker；3/3 realtime；Chromium 桌面＋WebKit 手机真实服务 E2E 4/4；生产构建通过 | 原路由桩静态 E2E 已删除；纠正中补充了租约化私有投影、连接接管、房主超时、牌桌流水、结果摘要、纯筹码赢家等待、提前弃牌自动结算、双向拖放和补充筹码 |
| P-001-T-003 | 进行中，等待目标部署 | `Dockerfile`、`deploy/**`、生产构建/静态资产检查、容量与 Docker 烟雾、工作流证据 | `npm run verify:core` 通过；`npm run test:capacity` 2/2；生产构建通过；待 iStoreOS `npm run test:docker-smoke` 与目标 Chrome 复验 | 本机仍无 Docker CLI/daemon；用户已提供 iStoreOS Docker 环境并同意在此检查点更新镜像 |

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
| 2026-07-27 | iStoreOS 生产页面可达性 | Chrome 打开 `http://192.168.100.1:3000/` 并通过 `Codex验收0727` 调用 `/api/enter` | 生产镜像已构建并启动，静态页面与账户进入接口可用 |
| 2026-07-27 | P-001-T-002 目标部署核心流程 | Chrome 检查大厅、设置、加入牌局、下注确认、刷新恢复和公共大屏；同时核对 `apps/web/src/main.tsx` 与 `apps/server/src/app.ts` | 失败：大厅/排行榜/牌桌/大屏为固定演示数据；设置不可保存；赛季确认只关闭 modal；加入房间与下注不提交命令；刷新不恢复最近账户或座位；原 E2E 未覆盖真实服务端集成 |
| 2026-07-27 | P-001-T-002 静态与领域纠正 | `npm run lint`、`npm run typecheck`、`npm run test:platform`、`npm run test:poker`、`npm run test:realtime` | 通过：lint/typecheck；platform/server 8/8；poker 6/6；realtime 3/3 |
| 2026-07-27 | P-001-T-002 真实浏览器纠正 | `npm run test:e2e:core`；运行器先生产构建并启动真实 Fastify/SQLite，再运行 Chromium 桌面与 WebKit 手机 | 通过：4/4；无 API 路由桩，覆盖双客户端同步、私有牌隔离、公共大屏、刷新恢复和连接接管 |
| 2026-07-27 | P-001-T-003 本地最终聚合 | `npm run verify:core` | 通过：lint、typecheck、8 platform/server、6 poker、3 realtime、4 真实 Chromium/WebKit E2E；生产构建和无外部静态资源检查同时通过 |
| 2026-07-27 | P-001-T-003 容量复验 | `npm run test:capacity` | 通过：15 账户、2 房间、多大屏隔离与命令幂等，2/2 |

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
- 阻塞项 `BLK-I-001`：目标 iStoreOS 已证明 x86-64 镜像能够构建、启动并托管页面，但当前环境仍不能执行仓库的完整 Docker 烟雾脚本；非 root、无网络运行、命名卷和容器重启状态/资产指纹尚未取得完整证据。影响为 AC-027 与生产恢复硬门禁仍未全部关闭。
- 已关闭 `BLK-I-002`：固定演示状态与路由桩 E2E 已被真实权威客户端和生产服务 E2E 替换；2026-07-27 本地最终聚合确定性通过。目标部署仍需更新镜像后复验，若实机与本地证据不一致则重新打开阻塞项。
- 已记录的主要实施风险为资产一致性、私有牌投影、撤销/自动推进并发、浏览器交互差异和 iStoreOS 容器恢复；对应控制和阻塞门禁见路线图 R-001–R-005。
- `relaxed` 只允许经独立证明确实不影响交付行为的 supplemental 异常作为报告项；core、硬门禁和未知影响永远阻塞。

## 9. 精确恢复步骤

1. 第一恢复动作：重新读取本状态与 `phase-001-plan.md`，并用 SHA-256 验证 `requirements.md`、`implementation-plan.md`、`phase-001-plan.md` 分别仍为 `92d44a0f...bba1e`、`aecddaa2...0df3c`、`c52c7dec...85ab9`；任一不一致时停止实现并重新进入规划审计。
2. 确认当前 Git 修订和差异；保留任何额外用户文件。P-001-T-002 已完成，本地 `npm run verify:core` 与 `npm run test:capacity` 为最新有效证据，不得恢复旧路由桩 E2E。
3. 在目标 iStoreOS 更新工作区后，先保留 `home-party-game-platform-data` 命名卷，重新构建并替换 `home-table` 容器；确认 Compose 报告 `healthy` 且 `/healthz` 返回成功。
4. 在目标工作区执行 `npm run test:docker-smoke`，验证 linux/amd64 镜像、无网络健康、非 root 运行路径、独立命名卷和容器重启指纹；随后用 Chrome 打开 `http://192.168.100.1:3000/`，复验真实建房、两名玩家同步下注、刷新恢复和公共大屏隐私。
5. 只有目标 Docker 烟雾与 Chrome 实机复验都通过后，才能完成 P-001-T-003 后置检查点、全 AC 追踪审计、阶段结果与最终化。当前不得创建 `phase-001-result.md`、`change-0.md` 或 `effective-requirements.md`。

## 10. 最终完成门禁

- P-001-T-001、P-001-T-002、P-001-T-003 均有前后检查点和完成证据。
- AC-001–AC-028、资产/隐私/兼容/构建/运行/恢复硬门禁全部通过。
- AC-029、AC-030 通过或只留下符合契约的 `FND-I-*` 报告项，且每项已证明不影响交付行为。
- 生产镜像在 x86-64 Docker 约束下不依赖公网运行，数据卷与容器重启恢复证据通过。
- P-001 的不可变结果、`change-0.md` 与 `effective-requirements.md` 内容一致，全部开放发现已汇总。
- 只有满足以上条件后，验证结论才能设为 `passed` 或 `passed_with_findings`，运行状态才能设为 `completed`。
