# initial / P-002 阶段计划

- 运行编号：`initial`
- 阶段编号：`P-002`
- 计划修订：`2`
- 父路线图修订：`1`
- 需求指纹：`sha256:c775428ce2b0f419fcc098995591d4bbe84fb0a6a4b9b6e7372f6cb1fb511ae3`
- 路线图指纹：`sha256:992accdfc4dc4ee9faee11dbbaa4f40400a16fc386910f7af403069dbdcd4ddd`
- 继承基线：P-001 已冻结为 `completed / passed`；六个关键文件 SHA-256 于 `2026-07-28` 复核一致
- 当前 Git 基线：`f671f71c24a9f12473e58da13c01cc9e2002d8b7`；工作区尚未整理为待发布的干净提交
- 创建日期：`2026-07-28`
- 详细程度：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

P-002 在真实 iStoreOS 上完成一次正常自动发布和紧随其后的同 SHA healthy no-op 验收，关闭本地假外部边界无法证明的 Docker、SSH、文件系统、权限、现有数据库和实际健康状态风险。实机证据与 P-001 冻结证据合并后，才可生成 `phase-002-result.md`、`change-0.md` 和 `effective-requirements.md`，并完成 initial 运行。

本阶段覆盖 FR-001、FR-004–FR-013、NFR-001–NFR-010 和 AC-001、AC-004–AC-010、AC-013–AC-015 的外部验收。AC-001、AC-004–AC-010、AC-013、AC-015 以及凭据、数据、恢复、服务健康和固定卷门禁均为 core/hard gate；AC-014 仍是唯一 supplemental 项。

P-002 有两条等价执行路径：

1. 用户在本机运行受支持的单命令，并提供不含主机、用户名、私钥路径、业务身份或数据库内容的证据。
2. 用户在未来任务中明确授权 Codex 连接真实服务器并执行生产部署；该授权只适用于明确任务的目标和操作，不由本规划调用自动继承。Codex 连续执行需要 `IdentityFile` 或已可用的 SSH agent 等非交互认证；如果系统 OpenSSH 要求交互输入密码，用户在自己的终端执行，Codex 不读取、记录或代填密码。

当前用户只确认了第二条路径在技术上可行，并未授权本次规划调用连接服务器。创建本计划不会运行 SSH、SCP、Docker、healthcheck、停服、备份、切换或清理。

本阶段明确不做：

- 不修改部署脚本、Compose、应用源码或测试；实机发现实现缺陷时保留证据并暂停，先修订计划，不在验收任务中临时改生产逻辑。
- 不制造数据库损坏、健康失败、强杀、中断或其他破坏性回滚演练；恢复能力继续使用 P-001 的确定性证据。
- 不提交、打印或写入工作流记录中的真实部署配置、密码、私钥、主机指纹、业务身份或数据库内容。
- 不删除或重建 `home-party-game-platform-data`，不运行 `docker compose down -v`、卷删除或任何绕开 `deploy/deploy.ps1` 的手工发布序列。
- 不在正常发布和 no-op 的 core 门禁全部通过前生成完成记录或有效需求快照。

## 2. 任务、激活门禁与文件范围

### 2.1 阶段激活门禁

P-002 计划为 `ready`，但任何网络或服务器副作用开始前必须逐项满足以下门禁：

1. 用户已整理并提交所有拟发布内容；`git status --porcelain` 为空，`git rev-parse HEAD` 得到唯一 full SHA。当前未提交的牌局 change-2 与部署自动化改动如何组成提交由用户决定，Codex 不擅自提交、丢弃或拆分。
2. `deploy/deploy.config.psd1` 已从示例创建、能由 PowerShell 5.1 导入且被 Git 忽略；只验证允许字段和路径关系，不在日志中输出配置值。发布目录与备份目录必须独立，且不得互相嵌套。
3. 真实 iStoreOS 满足 `deploy/README.md` 前置条件：固定卷 `home-party-game-platform-data` 存在，发布/备份目录父路径可写，Docker Compose 与健康检查可用，并已安排允许短暂停服的维护窗口。
4. 执行者已明确：用户自行执行，或在新的任务中明确授权 Codex 执行真实 SSH/SCP 和部署。Codex 路径还要求无需向工具暴露交互密码。
5. 记录不敏感的部署前基线：待发布 full SHA、当前容器 ID/镜像/health、固定卷名、正式目录和部署临时项状态、固定备份文件的存在性/哈希/时间，以及可稳定比较的数据库或业务状态指纹。工作流只记录比较结论或脱敏摘要。

任一门禁不满足时，P-002 保持 `ready` 或执行后保持当前任务 `in_progress`，且在首次服务器写入前停止。不得为了通过门禁而生成空提交、把真实配置加入 Git、绕过主机密钥校验或扩大授权。

执行状态本身需要在正常发布和 no-op 之间持续写入，因此在待发布提交创建后，两个部署命令从该 full SHA 的短期 clean detached worktree 运行，并通过显式 `-ConfigPath` 使用主工作区中被忽略的真实配置。该 worktree 必须在每次命令前保持 `git status --porcelain` 为空、`HEAD` 与待发布 SHA 完全相同，不接受任何编辑；主工作区只保存检查点，不作为脚本的发布来源。该隔离只解决工作流证据与 clean-HEAD 门禁的协调，不改变归档内容、镜像 SHA、服务器状态机或保留策略；完成后只删除已验证位于本机临时目录下的该 worktree。

### 2.2 文件与外部状态所有权

| 文件或范围 | 模式 | 所有权与目的 |
| --- | --- | --- |
| `deploy/deploy.config.psd1` | ignored runtime input | 用户持有的真实配置；只检查存在、可导入、允许字段、忽略状态和路径关系，不记录内容 |
| 当前 Git `HEAD` | read-only input | 唯一发布来源；P-002 不代替用户决定如何提交当前混合工作区 |
| 真实 iStoreOS 发布目录、备份目录、容器、镜像和固定卷 | external mutation through supported entry only | 仅由 `deploy/deploy.ps1` 正常发布；直接命令只允许不改变状态的观察 |
| `execution/initial/execution-state.md` | modify | 在每个任务和外部副作用前后保存检查点、脱敏证据、失败恢复状态 |
| `execution/initial/phase-002-result.md` | add on success only | 冻结正常发布、no-op、门禁、证据和 finding 结论 |
| `change-0.md` | add on final success only | initial 运行的不可变完成记录 |
| `effective-requirements.md` | add on final success only | 与已交付 initial 需求一致的有效需求快照 |

不得修改 P-001 计划或结果、`requirements.md`、`workflow-contract.md`、部署生产文件、应用文件以及 `docs/requirements/home-party-game-platform/**`、`docs/requirements/poker-room-experience-upgrade/**`。如果实机事实要求改变上述文件，先停止 P-002 并通过新的规划调用修订路线图/阶段计划。

### 2.3 有序任务

| 任务 | 结果 | 文件或范围 | 执行摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-002-T-001 | 激活门禁通过且真实正常发布 healthy | 忽略配置、待发布提交的 clean detached worktree、真实 iStoreOS、执行状态 | 完成 2.1 的五项门禁；记录脱敏前置快照；从待发布 SHA 的 clean detached worktree 仅运行一次 `powershell.exe -NoProfile -File .\deploy\deploy.ps1 -ConfigPath <主工作区忽略配置>`；在上传/构建阶段确认旧服务继续健康，随后观察停服、冷备份、切换和新服务健康；记录脱敏后置快照 | G-P2-001–G-P2-004；脚本退出 0；发布 SHA、镜像、health、容器数量、固定卷、正式目录、固定备份和临时项逐项核对 | 新服务以 full SHA 镜像 healthy 运行；构建完成前旧服务未停止；同一固定卷仍挂载；只有一个正式目录和一个原子覆盖的固定备份；无 token 目录、临时备份、锁或回滚标签；没有敏感信息进入证据 |
| P-002-T-002 | 同 SHA no-op 通过并完成 initial 运行 | 同一 clean detached worktree、真实 iStoreOS、执行状态、P2 结果、`change-0.md`、`effective-requirements.md` | 正常发布后不修改待发布提交、detached worktree 或服务器目标；在安静窗口记录容器、备份和稳定数据库/业务状态指纹；从同一 worktree 第二次运行同一单命令；比较前后状态；合并 P-001/P-002 证据、分类 finding 并完成工作流记录 | G-P2-005–G-P2-007；第二次退出 0 且明确 no-op；无上传/build/stop/backup/switch/up；容器 ID、备份哈希/时间、卷身份和稳定数据指纹不变；最终映射审计 | 全部 core/hard gate 通过；AC-014 通过或仅形成合规 supplemental finding；三个最终文档与需求、路线图和两阶段结果一致，执行状态为 `completed` |

依赖顺序：`P-002-T-001 -> P-002-T-002`。每次 `$implement-planned-feature` 仍只执行或恢复 P-002；它可以在同一阶段内按检查点推进两个任务，但不得越过授权、干净提交、配置或外部安全门禁。

如果第一次部署命令直接返回 no-op，它不能单独证明本阶段的正常发布。只有在存在同一 SHA 由本自动化完成正常发布的耐久、脱敏证据时才可接受；否则保持 P-002 未完成，等待下一次真实、合法的已提交变更，不为制造新 SHA 创建空提交或虚假证据。

## 3. 实机验证、证据与完成判定

### 3.1 验证门禁

| 门禁 | 层级 | 必须观察的证据 |
| --- | --- | --- |
| G-P2-001 来源、配置与授权 | hard gate | 工作区完全干净；full SHA 已记录；实际配置被忽略且未泄露；目录不重叠；执行者和本次真实操作授权明确 |
| G-P2-002 构建期间可用性 | core | 部署前旧服务 healthy；从上传/构建开始至脚本进入 stop 前的有界健康观察无失败；阶段日志显示 build 完成后才 stop |
| G-P2-003 正常发布与健康 | core | 命令退出 0；运行镜像为 full SHA；恰好一个 `home-table` 服务容器且 Docker health 为 healthy；对外 `/healthz` 成功 |
| G-P2-004 数据、卷与空间上界 | data hard gate | 固定卷名和挂载点未变；停服后才冷备份；备份目录只有一个有效固定备份且无临时文件；只有一个正式发布目录，无 incoming/previous/failed/token/锁/回滚标签 |
| G-P2-005 重复 no-op | core | 相同本地 full SHA、匹配镜像和 healthy 状态下第二次命令退出 0 并明确报告 no-op；未进入上传、build、stop、backup、switch 或 up |
| G-P2-006 no-op 状态恒等 | data hard gate | 第二次运行前后容器 ID、镜像、固定卷、备份哈希/时间、正式目录状态均一致；在安静窗口取得的稳定数据库/业务状态指纹未重置或丢失 |
| G-P2-007 最终证据完整性 | hard gate | P-001 冻结证据仍匹配；P-002 只保留脱敏命令结论；FR/NFR/AC 映射无缺口；没有半完成远端状态或未解释失败 |
| AC-014 实机阶段日志 | supplemental | 实机日志能区分 preflight、upload、build、stop、backup、switch、health、cleanup/no-op，且无敏感信息 |

健康观察应有明确超时，不使用无限等待。数据库/业务状态比较不得把玩家名、账户、牌局内容或数据库文件复制进工作流目录；优先记录哈希、计数或“相同/不同”结论。如果运行期间存在正常业务写入导致原始数据库哈希变化，应在维护安静窗口重做比较，或改用不会暴露业务数据的稳定逻辑指纹，不能把含糊结果记为通过。

### 3.2 失败、恢复与暂停规则

- 激活门禁失败：不连接或不改变服务器，记录缺失项和精确恢复步骤。
- 上传或构建失败：确认旧服务仍 healthy，P-002 保持未完成，不继续 no-op 或最终化。
- stop/备份/切换/health 失败但自动回滚成功：确认旧服务恢复 healthy、卷和恢复资产存在；保留非敏感退出信息，P-002 保持未完成并暂停诊断。
- 自动回滚失败或服务状态不明：立即停止额外变更，不手工清理卷、固定备份、旧镜像、恢复目录或锁；按脚本输出和 `deploy/README.md` 执行由用户明确授权的最小恢复，确认服务状态后再重新规划。
- 正常发布成功但 no-op 不恒等：保留当前 healthy 服务和比较证据，不重复尝试或人工覆盖备份；P-002 保持未完成。
- 实机发现生产实现缺陷：不得在本阶段临时修改脚本后继续；保存检查点，回到 `$plan-feature-implementation` 修订初始路线图/阶段计划，再实施修复和重做受影响验证。

所有失败均不得通过删除固定卷、`down -v`、取消主机密钥校验、保存密码或伪造通过证据恢复。

### 3.3 最终完成判定

只有以下条件全部成立，才可写入 P-002 结果和 initial 最终文档：

- P-002-T-001 与 P-002-T-002 完成，G-P2-001–G-P2-007 全部通过。
- 正常发布和 no-op 来自同一个干净提交 SHA，并有不敏感、可复核的真实 iStoreOS 证据。
- FR-001–FR-013、NFR-001–NFR-010、AC-001–AC-013、AC-015 的 P-001 本地证据与 P-002 外部证据合并后全部通过。
- AC-014 通过时结论为 `passed`；若只有 AC-014 存在已证明不影响交付的异常，则从 `FND-I-001` 起写完整 finding，结论可为 `passed_with_findings`。
- 任何 core/hard gate 失败、授权/凭据边界不清、远端状态未知或证据缺失时都不得完成运行。
- `phase-002-result.md` 先冻结实际任务和验证；随后创建 `change-0.md` 与 `effective-requirements.md`，最后把执行状态更新为 `completed`。

## 4. 检查点、恢复与修订记录

### 4.1 执行检查点

执行 P-002 时必须在以下边界更新 `execution-state.md`：

1. 激活 P-002 与 P-002-T-001，但在任何 SSH/SCP 前记录门禁结果。
2. 正常发布命令前，记录发布 SHA、脱敏基线、授权来源和恢复入口。
3. 正常发布结束后，记录退出码、服务/卷/目录/备份最终状态和是否允许进入 T-002。
4. no-op 命令前，记录相同 SHA 与用于恒等比较的脱敏快照。
5. no-op 后，记录退出码、阶段缺席和状态比较。
6. 最终化前，重新核对 P-001 关键哈希、需求/路线图指纹、finding 和远端无半完成状态。

中断恢复时从最后一个已写检查点继续，先做只读状态核对，不盲目重跑部署命令。若无法证明前一次是否已切换，不得把下一次调用当作普通重试。

### 4.2 当前精确恢复入口

下一次执行必须由用户调用 `$implement-planned-feature`：

1. 读取本计划、`execution-state.md`、路线图和 P-001 不可变结果。
2. 先完成 2.1 激活门禁。当前已知待办是整理并提交工作区、创建 Git 忽略的真实配置，以及选择用户执行或对该次任务明确授权 Codex 执行。
3. 未满足上述门禁时，在服务器副作用前暂停并报告；满足后只执行 P-002-T-001 的正常部署。
4. 正常部署通过后，才能执行 P-002-T-002 的相同 SHA no-op 和最终化。

本规划调用结束后不得自动连接服务器、运行部署或生成完成记录。

### 4.3 修订记录

| 修订 | 日期 | 结论与原因 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-28 | 首次创建 expanded P-002；正常发布与 no-op 分为两个有序任务，真实操作前设置干净提交、忽略配置、环境、授权和脱敏基线硬门禁 | 保留路线图修订 1；支持用户交证据或未来明确授权 Codex 连续执行，当前规划不产生服务器副作用 |
| 2 | 2026-07-28 | 用户授权提交当前全部非敏感改动、已创建真实忽略配置并要求继续实机测试；为避免执行状态检查点使发布源变脏，两个命令固定从同一提交 SHA 的 clean detached worktree 执行 | 不改变需求、路线图、部署脚本或服务器语义；只明确 P-002 的本地 writer 协调与清理边界 |
