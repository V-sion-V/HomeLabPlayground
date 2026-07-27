# initial / P-002 阶段计划

- 运行编号：`initial`
- 阶段编号：`P-002`
- 计划修订：`5`
- 父路线图修订：`3`
- 需求指纹：`sha256:b63b2a82a7fa098d45a4354c3844071c2e1d53c4925f7026984e4791ca1a6ec3`
- 路线图指纹：`sha256:fe86edbd0e8a56f9d62cc6e87bd005b4229934afaccada49e9e77d8b670aa6b8`
- 继承基线：P-001 已冻结为 `completed / passed`；P-002-T-001 已完成真实首次接管；P-002-T-002 因本地短探测 token 在真实 Windows/OpenSSH 边界变形而未完成
- 当前 Git 基线：`f049a7c6e2524ffa9da670ab6629ad2f9e7fd466`；该 SHA 当前在配置正式目录 healthy 运行，固定卷和唯一备份有效；主工作区保存工作流检查点，真实配置被忽略，未跟踪 `AGENTS.md` 保持用户所有
- 创建日期：`2026-07-28`
- 详细程度：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

P-002 保留已通过的首次接管证据，并在同一未完成阶段内纠正实机发现的两个构建/运行边界问题：

1. Windows PowerShell 5.1 把多行远端命令作为 `ssh.exe` 参数传递时，内嵌双引号丢失，`printf "NOOP\n"` 实际输出 `NOOPn`，导致本地短探测误入归档和上传路径。
2. `better-sqlite3` 在 Node 24 下源码编译时默认下载 Node 头文件；基础镜像已包含完整 `/usr/local/include/node`，但 Dockerfile 未让 `node-gyp` 使用它，缓存失效时会暴露不稳定的额外公网依赖。

纠正后形成新的合法 Git SHA，从 clean detached worktree完成一次已有受管版本的正常更新，并立即以同一新 SHA 验证本地短探测直接返回的零归档、零 SCP、零远端状态机 no-op。P-002 通过后只生成 `phase-002-result.md` 并进入 `awaiting_next_phase`；P-003 的受控实机回滚及 initial 最终化仍不在本阶段执行。

本阶段继续覆盖 FR-001、FR-004–FR-008、FR-010–FR-013、NFR-001–NFR-010 和 AC-001、AC-004、AC-005、AC-007–AC-010、AC-012–AC-015。AC-001、AC-004、AC-005、AC-007–AC-010、AC-012、AC-013、AC-015 以及构建、凭据、数据、卷、恢复和工作区所有权均为 core/hard gate；AC-014 是唯一 supplemental 项。用户已在 Q-005 授权 Codex 连续完成技术条件满足后的生产环境测试，Q-006 授权提交非敏感计划内改动；该授权不包含 P-003 破坏性回滚演练或旧 Docker/旧目录操作。

本阶段明确不做：

- 不改写 P-001 计划或结果，不破坏性删除当前配置正式目录来重造“首次部署”，不把失败的旧 SHA no-op 记为通过。
- 不修改应用业务源码、共享契约、数据库内容或 `docs/requirements/home-party-game-platform/**`、`docs/requirements/poker-room-experience-upgrade/**`。
- 不提交、打印或记录真实配置、主机、用户名、私钥路径、玩家/牌局数据或数据库内容；未跟踪 `AGENTS.md` 保持用户所有且不提交。
- 不删除、重建或匿名替换 `home-party-game-platform-data`，不运行 `docker compose down -v`，不进入或操作配置目录之外的旧 Docker/旧目录。
- 不制造 health 失败、数据库损坏、强杀或回滚故障；P-003 仍等待独立滚动规划。
- 不在全部 core/hard gate 通过前生成 P-002 结果，不创建 `change-0.md` 或 `effective-requirements.md`。

## 2. 任务、激活门禁与文件范围

### 2.1 阶段激活门禁

P-002 修订 5 为 `ready`。实施开始前和每个外部副作用边界必须满足：

1. 需求指纹与路线图修订 3 匹配；P-001 不可变结果的六个关键文件哈希仍一致；P-002-T-001 的首次接管证据和失败的 no-op 证据都保留在执行状态中。
2. 主工作区只允许当前 deployment-automation 工作流差异、计划内纠正文件差异和用户持有的 `AGENTS.md`；真实 `deploy/deploy.config.psd1` 被 Git 忽略且未跟踪，私钥位于仓库外。不得归属、提交或删除用户文件。
3. T-002 完成本地验证后，所有计划内 tracked 文件形成一个新的合法提交；发布必须从该提交的新 clean detached worktree执行。旧 `C:\tmp\home-table-p2-f049a7c6` 只作历史来源核对，不再发布。
4. T-003 前只读确认配置正式目录仍标记并 healthy 运行旧 SHA `f049a7c6...`，恰好一个受管 `home-table` 使用固定卷，唯一备份有效，无锁、upload/incoming/previous/failed、备份临时项或 rollback 标签。旧 Docker/旧目录不在检查范围。
5. 正常更新前记录容器、镜像、发布标记、卷、备份哈希/时间和安静窗口数据库的脱敏指纹；部署入口负责在新镜像构建成功后停止当前受管服务并冷备份，不要求人为预先停止当前服务。
6. 非交互 SSH、Docker Engine/Compose、精确基础镜像和 `/usr/local/include/node` 头文件继续可用；用户对计划内提交、正常更新和紧随其后的 no-op 授权仍有效。

任何门禁失败时在下一服务器副作用前暂停。不得用空提交、dirty worktree、关闭主机密钥检查、禁用 TLS、手工覆盖备份或手工替换正式目录绕过。

### 2.2 文件与外部状态所有权

| 文件或范围 | 模式 | 所有权与目的 |
| --- | --- | --- |
| `deploy/deploy.ps1` | modify | 把短探测的 `NOOP`/`DEPLOY` 输出改为 Windows PowerShell 5.1/OpenSSH 参数封送后仍精确的 token；保持双重权威 no-op 和其他入口语义 |
| `Dockerfile` | modify | 构建阶段让 `node-gyp` 使用官方 Node 镜像内置 `/usr/local` 头文件，避免同版本头文件额外下载；运行镜像接口不变 |
| `tests/deployment-automation.test.ts` | modify | 覆盖真实边界 token 约束、零归档/零 SCP 快路径和非 no-op 路径 |
| `tests/fixtures/deployment-automation/fake-open-ssh.mjs` | modify if needed | 仅在测试需要时模拟 Windows/OpenSSH token 变形；不得掩盖生产脚本文本缺陷 |
| `execution/initial/execution-state.md` | modify | 每个任务、提交和外部副作用前后保存事实、指纹、验证、失败和恢复入口 |
| `execution/initial/phase-002-result.md` | add on success only | 冻结首次接管、纠正实现、新 SHA 更新、零上传 no-op、finding 和 P-003 进入条件 |
| `implementation-plan.md`、`execution/initial/phase-002-plan.md` | planned inputs | 路线图修订 3 与本计划修订 5；实施时只核对/提交，不再改写，除非新事实再次要求规划 |
| `deploy/deploy.config.psd1`、仓库外私钥 | ignored/user-owned | 只验证存在、允许键、路径分离、忽略和非交互认证；不记录值 |
| 根 `AGENTS.md` | untracked/user-owned | 保留，不编辑、不暂存、不提交、不发布 |
| 当前 iStoreOS 正式目录、唯一备份、新旧受管 SHA 镜像和固定卷 | external mutation via supported entry only | T-003 只通过 `deploy/deploy.ps1` 正常更新和 no-op；直接命令仅作只读观察 |
| 配置目录之外的旧 Docker/旧目录 | user-owned external state | 不识别、不修改、不清理、不作为自动恢复入口 |
| P-001 计划/结果、`requirements.md`、`workflow-contract.md`、`change-0.md`、`effective-requirements.md` | immutable/out of phase | 不修改；后两者仅在 P-003 成功时创建 |

### 2.3 有序任务

| 任务 | 状态/结果 | 文件或范围 | 执行摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-002-T-001 | completed / 首次自动化接管 healthy | 固定 SHA `f049a7c6...`、真实 iStoreOS、执行状态 | 已从配置目录不存在且固定卷停写的状态完成构建、冷备份、正式目录创建、SHA 服务启动和清理；不触碰旧 Docker/旧目录 | G-P2-002 及执行状态中保留的首次接管构建、外部 health、固定卷、单备份和无临时项证据 | 不重做；结果作为 P-002 最终证据的一部分保留 |
| P-002-T-002 | pending / 纠正真实 no-op 与构建边界并形成新提交 | `deploy/deploy.ps1`、`Dockerfile`、部署测试/夹具、执行状态、计划内工作流文档 | 记录基线；将短探测 token 改为不依赖内嵌双引号/转义换行的固定输出；设置 `npm_config_nodedir=/usr/local`；增加最小回归；运行本地门禁；仅暂存计划内 tracked 文件并创建新提交，排除配置、私钥和 `AGENTS.md` | PowerShell AST；生产 token 静态/进程边界回归；`npm run test:deploy`；`npm run lint`；`npm run typecheck`；`npm run build`；POSIX `sh -n`；安全扫描；`git diff --check`；提交后敏感项/工作区核对 | 真实 token 根因有确定性回归；17 个既存部署场景及新增场景通过；Node 本地头文件配置存在；新提交只含计划内非敏感文件；新 detached worktree clean |
| P-002-T-003 | pending / 新 SHA 受管更新、零上传 no-op 与阶段冻结 | 新 clean detached worktree、忽略配置、真实 iStoreOS、执行状态、P2 结果 | 只读记录旧 SHA healthy 基线；从新 SHA 运行一次受支持入口，观察构建期旧服务保持、冷备份、切换和新服务 healthy；后置核对；记录 no-op 前快照；从同一 worktree第二次运行，要求本地短探测直接退出；比较状态；合并证据、分类 finding并冻结 P-002 | G-P2-001–G-P2-007；正常更新退出 0且构建日志不出现 `gyp http GET`；第二次退出 0且日志只有 preflight/health，无 `UPLOAD`/`BUILD`、SCP或远端状态机；前后结构/数据库指纹一致 | 新 SHA 正常更新与 no-op来自同一 clean提交；当前服务 healthy、固定卷/单备份/单正式目录保持且无临时项；全部 core/hard gate通过；结果进入 `awaiting_next_phase` |

依赖顺序：`P-002-T-001 (completed) -> P-002-T-002 -> P-002-T-003`。一次 `$implement-planned-feature` 只恢复并执行 P-002，但可按 durable checkpoint 顺序完成剩余两个任务；不得提前进入 P-003。

## 3. 验证与完成条件

### 3.1 门禁

| 门禁 | 层级 | 必须观察的证据 |
| --- | --- | --- |
| G-P2-001 来源、配置与授权 | hard gate | 新提交只含计划内非敏感文件；新 detached worktree clean；真实配置忽略未跟踪；非交互 SSH 与授权有效；P-001 哈希及需求/路线图指纹匹配 |
| G-P2-002 首次接管隔离 | data hard gate / completed evidence | `f049a7c6...` 从新目录首次接管时无运行卷写入者，未操作旧 Docker/旧目录；该既存证据不得重写或冒充纠正后新 SHA 证据 |
| G-P2-003 纠正实现与本地回归 | build/compatibility hard gate | 短探测 token 在 Windows 原生命令边界保持精确；本地 healthy-SHA 路径零归档/零 SCP；非 no-op、锁和远端权威 no-op仍通过；Dockerfile 使用内置 Node 头文件；计划本地命令全部通过 |
| G-P2-004 新 SHA 正常更新与健康 | core | 受支持命令退出 0；旧受管服务在远端构建期间保持 healthy；运行镜像/发布标记为新 full SHA；恰好一个服务且 Docker health、对外 `/healthz` 成功 |
| G-P2-005 数据、卷与空间上界 | data hard gate | 切换前有效冷备份；固定卷和 `/data` 挂载不变；备份目录恰好一个有效固定文件；自动化范围一个正式目录；无锁、token 临时目录/文件或 rollback 标签 |
| G-P2-006 零上传 no-op 与状态恒等 | core/data hard gate | 同一新 SHA 第二次命令在本地 `health` 快路径返回 0；无归档、SCP、远端状态机、build、stop、backup、switch或up；容器、镜像、卷、备份哈希/时间、正式目录和安静窗口数据库指纹逐字不变 |
| G-P2-007 阶段证据完整性 | hard gate | P-001 冻结证据、首次接管、失败/恢复、纠正提交、新 SHA 更新/no-op全部可追踪；无半完成远端状态、未解释失败或敏感证据；P-003 明确保留未执行 |
| AC-014 阶段日志 | supplemental | 正常更新日志能区分全部阶段；no-op 只显示 preflight/health；无敏感内容 |

本地没有 Docker daemon，因此不单独运行本地 `test:docker-smoke`。T-003 的真实 iStoreOS 新 SHA 构建、非 root 运行镜像、health、固定卷复用和容器重建后数据库指纹/业务状态保持，提供与本次 Dockerfile 改动直接相关且更强的外部 core 证据；不得把该说明扩展为未观察的完整 smoke 套件通过。

### 3.2 失败、恢复与暂停

- T-002 实现或本地门禁失败：不创建提交、不连接服务器，保留最小 diff 和失败证据；修复同一根因后重跑受影响的最小门禁。
- 提交候选包含配置、私钥、`AGENTS.md`、未知用户文件或非计划应用改动：停止暂存/提交，保持文件原样并暂停。
- 新提交或 detached worktree 不 clean/不匹配：在任何服务器副作用前停止；不得使用主工作区或旧 worktree替代。
- 上传/构建失败：当前旧 SHA 服务继续 healthy，正式目录和固定备份不变；只读核对并阻塞，不盲目重试。构建日志若仍出现 `gyp http GET`，视为本地头文件纠正未生效。
- 正常更新在停服、备份、切换或 health 阶段失败：按已有远端状态机恢复旧 SHA 镜像与部署前数据库；只读核对恢复后的服务、卷、备份、目录和锁。恢复不确定时停止额外变更并保留现场。
- 新 SHA 更新成功但第二次仍出现 `UPLOAD`/`BUILD`、SCP、远端状态机或任何恒等变化：保留当前 healthy 服务和全部比较证据，P-002 保持 `blocked`，不得第三次尝试或人工覆盖备份。
- AC-014 以外的任何 core/hard gate 失败都阻塞；构建、运行、安全、凭据、数据、恢复或未知影响不得降级为 `FND-I-*`。

### 3.3 完成判定

只有以下全部成立才创建 `phase-002-result.md`：

- P-002-T-001、P-002-T-002、P-002-T-003 全部完成，G-P2-001–G-P2-007 全部通过。
- 首次接管证据真实保留；纠正后的正常更新和零上传 no-op 来自同一个新 clean Git SHA。
- FR/NFR/AC 由 P-001 冻结证据、P-002 首次接管和纠正后新 SHA 证据合并后无缺口。
- AC-014 通过时结论为 `passed`；只有其存在已证明无交付影响的异常时才分配下一个 `FND-I-*` 并使用 `passed_with_findings`。
- 当前服务 healthy，固定卷、唯一备份、唯一正式目录和无临时状态已独立核对；没有未决问题、半完成远端状态或用户文件归属错误。
- 结果创建后把 initial 状态置为 `awaiting_next_phase`，保留 P-003 未执行；不创建 `change-0.md` 或有效需求快照。

## 4. 风险、恢复与修订记录

### 4.1 Durable checkpoints

1. 规划完成：路线图修订 3、本计划修订 5、状态 `ready`，不修改生产文件或连接服务器。
2. T-002 开始前：记录 `deploy.ps1`、Dockerfile、测试/夹具和当前 tracked/untracked 所有权基线。
3. T-002 实现后：记录实际 diff、定向测试和项目门禁；通过前不暂存。
4. 新提交后：记录 full SHA、提交文件清单、敏感扫描、新 detached worktree 路径和 clean 状态。
5. T-003 服务器写入前：记录旧 SHA healthy、容器/镜像/卷/备份/正式目录/数据库脱敏基线和无临时项。
6. 正常更新后：记录退出码、构建头文件来源、SHA/health、卷/备份/目录最终状态和 no-op 进入条件。
7. no-op 前后：记录同一新 SHA、命令阶段缺席、结构和数据库恒等比较。
8. 冻结前：重新核对需求/路线图指纹、P-001 哈希、finding、工作区/远端无半完成状态和 P-003 保留。

### 4.2 当前精确恢复入口

下一次必须调用 `$implement-planned-feature`：

1. 完整读取本计划修订 5、执行状态、路线图修订 3和 P-001 不可变结果，确认需求/路线图指纹和 P-001 六个关键哈希。
2. 激活 P-002-T-002，记录四个计划实现文件及当前工作区基线；保留被忽略配置和用户 `AGENTS.md`，不连接服务器。
3. 完成最小 token、本地 Node 头文件和回归修改，运行 T-002 全部门禁；通过后只提交计划内非敏感 tracked 文件，创建新 clean detached worktree。
4. durable checkpoint 后激活 P-002-T-003；重新只读确认当前旧 SHA 受管服务、固定卷、唯一备份和无临时状态，再从新 worktree运行一次正常更新。
5. 正常更新全部后置门禁通过后，记录 no-op 前快照并运行同一新 SHA；只有本地 health 快路径零上传且前后恒等时才冻结 P-002并进入 `awaiting_next_phase`。

本规划调用不得修改生产文件、运行测试、创建提交、连接服务器或生成阶段结果。

### 4.3 修订记录

| 修订 | 日期 | 结论与原因 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-28 | 首次创建 expanded P-002；正常发布与 no-op 分为两个有序任务，真实操作前设置干净提交、忽略配置、环境、授权和脱敏基线硬门禁 | 保留路线图修订 1；支持用户交证据或未来明确授权 Codex 连续执行，当前规划不产生服务器副作用 |
| 2 | 2026-07-28 | 用户授权提交当前全部非敏感改动、已创建真实忽略配置并要求继续实机测试；两个部署命令固定从同一提交 SHA 的 clean detached worktree执行 | 不改变需求、路线图、部署脚本或服务器语义；明确 P-002 的本地 writer 协调与清理边界 |
| 3 | 2026-07-28 | 用户已手动停止旧 Docker，要求新目录直接首次部署且不再管理旧 Docker，并把实机回滚留到下一项功能后 | 路线图修订 2 新增 P-003；P-002 改为首次接管/no-op并在结果后进入 `awaiting_next_phase` |
| 4 | 2026-07-28 | 两次构建失败后均证明未备份、未切换且数据库不变；维护者了解网络诊断后明确要求不改 SHA 再尝试一次 | 仅允许全部门禁通过后的单次重试；该次重试最终成功完成 P-002-T-001 |
| 5 | 2026-07-28 | 首次接管成功；同 SHA 第二次命令远端状态恒等，但 Windows/OpenSSH 把 `NOOP\n` 变为 `NOOPn`，导致仍归档和上传；同时基础镜像已有本地 Node 头文件但构建未使用 | 父路线图升为修订 3；保留 T-001 证据，T-002 改为纠正实现/新提交，新增 T-003 新 SHA 受管更新和零上传 no-op；需求与 P-003 不变 |
