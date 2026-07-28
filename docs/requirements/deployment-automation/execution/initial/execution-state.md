# deployment-automation / initial 执行状态

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：`../../change-0.md`
- 运行状态：`in_progress`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`
- 当前路线图修订：`4`
- 需求指纹：`sha256:b63b2a82a7fa098d45a4354c3844071c2e1d53c4925f7026984e4791ca1a6ec3`
- 路线图或变更计划指纹：`sha256:edefef4f3522f0d465be165b33568cca8a626a10264af1bada7c3370caa45118`
- 当前阶段：`P-003`
- 当前任务：`P-003-T-001`
- 项目基线：本地 Git `1d049a55ad3432bb1260fe2ddd1ac5f3ca85d6ea`；服务器由该 SHA 的唯一受管 `home-table` healthy 服务提供，固定卷与唯一备份有效且无部署临时状态；P-001/P-002 已冻结，主工作区只含 P-002 结果、本状态、路线图修订 4、P-003 计划和用户未跟踪 `AGENTS.md`，真实配置继续被 Git 忽略
- 最后更新时间：`2026-07-28`

## 1. 运行目标或待生效变更

从 Windows 本地交付单命令、部署状态幂等的 iStoreOS 发布自动化：只发布干净已提交的 Git `HEAD`，切换前对 SQLite 做单文件冷备份；已有自动化旧版本时失败自动恢复旧镜像和数据库，首次接管无旧版本时停止新服务并恢复数据库；自动化管理范围只保留一个正式发布目录和一个固定备份。

本运行采用三阶段路线图：

- P-001：完成全部本地实现、状态化假远端故障验证、文档与实机交接清单。
- P-002：在新的配置目录完成真实 iStoreOS 首次自动化接管与重复 no-op；旧 Docker/旧目录保持用户所有，阶段完成后进入 `awaiting_next_phase`。
- P-003：维护者完成下一项功能后，再滚动规划受控实机回滚验收并完成 `change-0.md` 和有效需求快照。

## 2. 阶段状态

| 阶段 | 状态 | 计划 | 结果 |
| --- | --- | --- | --- |
| P-001 | completed | [phase-001-plan.md](phase-001-plan.md) | [phase-001-result.md](phase-001-result.md) |
| P-002 | completed | [phase-002-plan.md](phase-002-plan.md) | [phase-002-result.md](phase-002-result.md) |
| P-003 | ready | [phase-003-plan.md](phase-003-plan.md) | 尚未创建 |

P-001/P-002 已冻结为 `completed / passed`。用户在 Q-011 明确选择 A，确认当前维护窗口并授权只停止一次精确候选容器；严格只读服务器门禁未发现漂移。路线图修订 4 与 P-003 计划修订 1 已创建，下一次只允许执行 P-003 的文档候选、单次受控停止、自动回滚和 initial finalization。

## 3. 当前检查点

- `workflow-contract.md` 为 schema `3.2`，路径与 frontmatter 声明一致。
- 需求审计通过：13 个规定章节、FR-001–FR-013、NFR-001–NFR-010、AC-001–AC-015 和决策记录齐全；无未决问题或占位符。
- 用户明确选择 `relaxed`；AC-001–AC-013、AC-015 为 core，AC-014 为 supplemental。
- P-003 滚动规划重新核对：requirements 指纹仍为 `sha256:b63b2a82a7fa098d45a4354c3844071c2e1d53c4925f7026984e4791ca1a6ec3`；P-001/P-002 不可变结果哈希分别为 `sha256:d832bd43219ca7d43c40c43dd3947b6d0d6b3d00e8eb052988f577ff83e89959` 与 `sha256:763f48298ee98545cfaa80db5894c3c6f7f9fb2a2bd450d867357df5446e748c`；`change-0.md`、`effective-requirements.md` 和 `phase-003-result.md` 均尚未创建。
- 用户对 Q-011 明确回复 A：当前维护窗口有效，允许未来 P-003 实现调用在全部门禁通过后只停止一次镜像 full SHA、Compose 服务标签和配置 working-dir 三重匹配的候选容器；不授权停止旧 SHA、重复注入、手工写数据库、清理失败现场或操作旧 Docker/旧目录。
- P-003 规划的第一次只读 SSH 封装因 Windows PowerShell 5.1 在标准输入首行加入 UTF-8 BOM，使首行 `set -eu` 未生效；其余显式断言虽通过但未作为严格门禁。随后以远端 `tail -c +4` 剥离 BOM 后重跑，严格错误退出门禁返回 0。
- P-003 严格只读实机门禁通过：当前标记/镜像为 `1d049a55...`，唯一受管 `home-table` running/healthy、非 root且外部 health通过；固定卷只有该服务一名写入者，数据库 SQLite 头与大小有效；备份目录只有一个文件，哈希 `sha256:e805c4d2f9b6a3716f9760129c3cc33144023f108a11243460f9dcb036b7b88a`、mtime `1785180699` 秒，与 P-002 冻结值一致；无锁、发布/备份临时项或 rollback 标签。
- 路线图已升为修订 4，指纹 `sha256:edefef4f3522f0d465be165b33568cca8a626a10264af1bada7c3370caa45118`；[phase-003-plan.md](phase-003-plan.md) 修订 1 已创建，指纹 `sha256:87035b9db74c7bd573be31810db571da2b4ec3d3649a1382c4e085471a0fee7f`，采用 `expanded / relaxed`，含三个有序任务和 G-P3-001–G-P3-006。规划调用未提交、上传、构建、停止容器或回滚。
- 本次 `$implement-planned-feature` 已按计划激活 P-003-T-001。激活时 Git 仍为分支 `main` 的 `1d049a55ad3432bb1260fe2ddd1ac5f3ca85d6ea`，比 `origin/main` 领先 2 个提交；已知工作区范围精确为路线图、执行状态、冻结 P-002 结果、P-003 计划及用户未跟踪 `AGENTS.md`。
- 激活指纹核对通过：requirements、路线图、P-001 结果、P-002 结果和 P-003 计划分别保持计划声明的 SHA-256；真实配置存在、允许必填字段齐全、被 Git 忽略且未跟踪，私钥已配置在仓库外。本地受限文件沙箱不能直接读取该私钥元数据，下一原子步骤以不输出敏感值的非交互 OpenSSH 握手和严格只读服务器门禁证明其可用性。
- P-003-T-001 当前影响范围为四份计划内工作流文件、候选 Git 提交、临时 clean detached worktree、只读服务器基线和 fail-closed 监视器 probe。完成条件为 G-P3-001：候选只含四文件、生产构建输入不变、配置/私钥/`AGENTS.md` 排除、worktree clean且旧服务不匹配候选监视器。
- T-001 候选提交前的非交互 SSH 与严格只读生产门禁通过：当前正式标记/镜像仍为 `1d049a55...`，唯一受管服务 running/healthy、非 root且外部 health返回 200；固定卷只有该服务一名写入者，数据库大小 `475136`，数据库与固定备份 SHA-256均为 `e805c4d2...`，备份 mtime仍为 `1785180699` 秒；无锁、发布/备份临时项或 rollback 标签。第一次封装把 Compose 短容器 ID 与 Docker 完整 ID直接比较而 fail closed；规范化为 inspect 完整 ID后重跑通过，两次均为只读且没有服务器副作用。
- 候选暂存门禁通过：index 精确包含路线图、执行状态、冻结 P-002 结果和 P-003 计划四文件；P-002 结果与 P-003 计划哈希不变；相对 `1d049a55...` 的生产/非本功能路径差异为 0，`.dockerignore` 继续排除 `docs`，`git diff --cached --check` 通过，真实主机/私钥/非示例路径和私钥标记均未进入差异，真实配置与 `AGENTS.md` 均未跟踪、未暂存。下一原子操作为重新暂存本检查点并创建四文件文档候选提交。
- 路线图修订 2 采用 `phased` + `expanded`：首次接管与用户延后的实机回滚形成两个独立外部交接阶段，数据库/目录回滚和中断恢复保持 expanded 风险。
- P-001 详细计划修订 1 已创建，包含三个有序任务；P-001-T-001 与 P-001-T-002 已完成。
- 当前本机可用 Windows PowerShell 5.1、Git、系统 OpenSSH、Node/npm 和 Git for Windows POSIX shell；Docker、`pwsh` 不可用。
- P-001 明确禁止真实 SSH/SCP 和 Docker，验证必须用临时 Git 仓库与假外部命令。
- 部署相关预期文件当前没有既存差异。
- P-001-T-001 已完成：PowerShell/POSIX 脚本、示例配置、兼容 Compose 镜像接口和忽略规则已实现；配置和清理作用域受限，静态门禁通过，未调用真实 SSH、SCP 或 Docker。
- P-001-T-002 已完成：真实生产脚本在临时 Git 仓库与假 SSH/SCP/Docker 中通过 17 个成功、完整性、no-op、非 no-op、并发、备份、健康、回滚、中断、强杀恢复与首次部署边界场景；任何真实命令逃逸都会使测试失败。
- 任务前基线：`tests/deployment-automation.test.ts` 与夹具目录不存在；`package.json` 为 `sha256:ef9f9b71e2c9777659d3159dbe35df966ce47f2f1e4728c582f2e51b216d5cb3`。
- 任务前基线：`.gitignore` `ee8959789d1dbf88c03a703e217893aaf51381c0467c04a1ef483cc316555b43`；`.dockerignore` `2504dab2dd0dd521a288039798827e2743fca14eca36442af4141cce03ca8db4`；`deploy/compose.yml` `4f9b55698cf3d146b9727b46d2101760fd75b36ad6172c78c969236aa1a7b5ab`；三个新增脚本/配置文件均不存在。
- P-001-T-002 任务后哈希：`package.json` `sha256:2cd37d86187531992360c53770c5d550a66164f9df24a86c38388e064b32d2a2`；`tests/deployment-automation.test.ts` `sha256:2dc54a8af22dac280bd31c05becc1005b76fb6d39db83c6b577e03e5265d5284`；`fake-open-ssh.mjs` `sha256:d8721846bf616949197589f43f7680c50d76d4cef9f955d2f36ab18cbaf9982c`；`fake-docker.mjs` `sha256:c573b5792979196a7a19e896142c84c34456418aa521c2d1521594cd127de30f`；包含锁前清理修复的 `remote-deploy.sh` `sha256:aff3eb6f081b2297159125e8c549cd0619a8ec106acabb4b9158f04bc97a5265`。
- P-001-T-003 已开始，影响范围为 `deploy/README.md`、根 `README.md`、本执行状态与阶段结果；任务前 `README.md` 为 `sha256:5d38927462fb129561203e52b6830257d9677ec5c1d61a11e9f55aa6ccd8d95e`，`deploy/README.md` 为 `sha256:6a6566b4fde4aae3b970f9ab5b3f618230a75c9396fc2df48603d9c8481df480`。
- T3 完成条件：运维文档覆盖配置、认证、幂等、单备份、自动/人工恢复和 Git 历史发布；`npm run test:deploy`、lint、typecheck、生产 build 与 diff check 全部通过；Docker 与真实服务器操作保持未运行。
- P-001-T-003 已完成：两份 README 覆盖全部运维责任，最终部署定向测试、lint、typecheck、生产 build、脚本语法、安全扫描和 diff check 全部通过。
- P-001 的三个任务、全部本地 core/hard gate 与 AC-014 supplemental 均通过；[phase-001-result.md](phase-001-result.md) 已冻结，验证结论为 `passed`，无开放 finding。
- P-002 详细计划修订 3 已创建，保留 `expanded` 风险级别；任务为 P-002-T-001 新目录首次接管和 P-002-T-002 相同 SHA no-op/阶段冻结。
- P-001 结果记录的六个关键文件 SHA-256 已于 `2026-07-28` 重新核对，全部一致；需求和路线图指纹保持不变。
- 当前工作区有 24 条 porcelain 状态记录，`deploy/deploy.config.psd1` 尚不存在；两项都由 P-002 激活门禁处理，任何真实 SSH/SCP 前必须先满足。
- 用户确认未来开发中的生产环境测试可在技术条件满足时由 Codex 连续完成；本次回复仅规划 P-002，不构成真实服务器操作授权。Codex 执行路径要求独立私钥或 SSH agent 等非交互认证，交互密码仍由用户在自己的终端输入。
- `2026-07-28` 本次 `$implement-planned-feature` 已恢复 schema 3.2 契约、完整状态、路线图、P-002 计划、相关需求和 P-001 冻结结果；需求/路线图指纹在四份执行权威中一致，P-001 六个关键文件 SHA-256 全部匹配。
- P-002-T-001 激活基线：Git `HEAD` 仍为 `f671f71c24a9f12473e58da13c01cc9e2002d8b7`；`git status --porcelain=v1 --untracked-files=all` 有 35 条，UTF-8 行清单指纹为 `sha256:83c2bac98abd3b4b0c1504996f9da5af8263d763eba74fb846536849f86aae26`。差异同时包含部署自动化、既存牌局 change-2 和 poker-room workflow，不能由 P-002 擅自合并、提交或丢弃。
- 真实 `deploy/deploy.config.psd1` 不存在；`.gitignore` 规则已能忽略该路径。`powershell.exe`、`git.exe`、`ssh.exe`、`scp.exe` 均可用，但由于前两项 hard gate 未通过，没有探测服务器能力、卷、目录、Docker、health 或维护窗口。
- 本次用户调用 `$implement-planned-feature` 视为对计划内 P-002 正常发布和紧随其后的同 SHA no-op 的执行授权；授权不包含代替用户决定提交边界、创建未知服务器配置、破坏性回滚演练或卷/备份清理。
- P-002-T-001 当前影响范围仍限于忽略配置、干净 Git `HEAD`、真实 iStoreOS 和本执行状态；计划验证为 G-P2-001–G-P2-004，完成条件仍为正常发布退出 0、SHA 镜像 healthy、固定卷不变、一个正式目录、一个固定备份且无部署临时项。
- 本次未运行 `deploy/deploy.ps1`、SSH、SCP、Docker 或服务器 healthcheck，未创建本地归档，未发生服务器读写、停服、备份或切换。
- 用户明确要求把敏感信息加入忽略范围、提交到 Git 并继续测试；按上下文解释为授权 Codex 将当前全部 35 条非忽略项目改动作为一个提交，真实配置与私钥除外，并允许当前维护窗口内执行计划内正常发布和 no-op。该授权不包含 GitHub push 或破坏性回滚演练。
- 配置安全门禁通过：`deploy/deploy.config.psd1` 已存在、只含八个允许键、必填值齐全、两个远端目录分离、被 Git 忽略且未被跟踪；私钥已配置、文件存在且位于仓库外。`.gitignore` 和 `.dockerignore` 已精确包含实际配置路径，无需添加更宽泛的密钥通配规则。
- 提交候选安全扫描通过：没有 OpenSSH 私钥标记、私钥文件名、实际主机或 IdentityFile 值；唯一两个配置值匹配来自公开 example 中相同的通用发布/备份目录，不构成新增敏感信息。任何配置值和私钥路径均未写入工作流证据。
- P-002 计划修订为 `2`：提交后以该 full SHA 创建短期 clean detached worktree，两个部署命令都从该 worktree 运行并显式引用主工作区被忽略的配置；这样执行状态可持续写检查点，同时部署源保持完全干净和同 SHA。
- 当前提交前基线仍为 Git `f671f71c24a9f12473e58da13c01cc9e2002d8b7`，分支 `main`；下一原子步骤是暂存全部非忽略改动、复核 staged 清单无配置/私钥后创建一个提交。
- 已创建提交 `f049a7c6e2524ffa9da670ab6629ad2f9e7fd466`（`feat: upgrade poker room and automate deployment`）：35 个文件、5506 additions、77 deletions。提交后主工作区 `git status --porcelain=v1 --untracked-files=all` 为空；真实配置仍被忽略且不在 `HEAD`；未执行 GitHub push。
- P-002-T-001 的待发布 SHA 固定为 `f049a7c6e2524ffa9da670ab6629ad2f9e7fd466`。本检查点写入后主工作区仅允许出现本执行状态的后续差异；服务器命令必须从该 SHA 的 clean detached worktree 执行。
- 已创建 detached worktree `C:\tmp\home-table-p2-f049a7c6`：`HEAD` 精确为待发布 SHA，porcelain 状态为 0，真实配置不存在于该 worktree，部署脚本存在。下一步是使用主工作区配置执行有界、非交互、只读 SSH 和 iStoreOS 基线检查。
- 非交互 SSH key 验证通过：`BatchMode=yes`、`IdentitiesOnly=yes` 登录返回固定哨兵且退出 0；未记录 SSH 原始输出、主机、用户、端口或私钥路径。
- 第一次只读基线封装因远端 ash 报告未闭合引号而在检查脚本解析前失败；没有执行基线主体或任何写操作。改为通过标准输入调用 `sh -s` 后，只读检查成功执行。
- 配置路径只读基线：所需命令、Docker Engine、Docker Compose、固定卷、发布/备份父路径写权限、外部 health endpoint、无临时发布目录、无部署锁和无 rollback 镜像标签均通过；配置的正式发布目录与 `deploy` 子目录不存在，因此不能从该位置识别旧服务、固定卷挂载或数据库指纹。配置备份目录当前无固定备份或其他条目，符合首次自动备份前状态。
- 全局只读服务发现：恰好一个 `home-table` 容器，状态 `healthy`，挂载固定卷且可取得数据库 SHA-256；Compose working-dir 标签存在、是安全绝对路径并以 `deploy` 结尾，其上级仓库根存在、可写且包含 `deploy/compose.yml`。该实际仓库根与配置的 `RemoteReleaseDir` 不一致；只记录比较结论和路径指纹可用性，未记录实际路径。
- 由于生产脚本只从配置 `RemoteReleaseDir/deploy` 识别 `OLD_CONTAINER` 和 `OLD_IMAGE`，当前配置下继续会把已有服务当成“无旧容器”的首次部署，无法满足旧应用与数据库一体自动回滚门禁。该恢复安全差异阻塞 P-002-T-001；未运行部署入口、SCP、构建、停服、备份或切换。
- 用户明确选择保留当前指向新目录的配置并按首次部署处理：旧目录不修改，必要时使用旧目录人工回滚，本次跳过回滚演练；用户随后明确授权正式部署时先停止旧服务。停止旧服务可恢复数据库冷备份前提，但不会让现有首次部署分支自动取得旧镜像/旧 Compose 身份，因此不能单独关闭自动回滚 hard gate。
- 上述回答属于全局发布/恢复契约变化。依据执行技能规则，本次只记录检查点并保持 `paused`；未提前停止旧服务，以免在重规划期间造成无期限生产停机。现有 clean detached worktree 不得用于真实发布，直至修订后的计划重新确认其适用性。
- 用户随后确认旧 Docker 已由其手动停止，要求自动化不再管理旧 Docker、直接尝试首次部署，并保留一个之后与新功能一起执行的实机回滚待测项。该决定记为 Q-009；规划不把用户的手动停服伪装成自动化证据。
- `$plan-feature-implementation` 已完成修订：需求明确首次接管例外，路线图修订 2 新增 P-003，P-002 计划修订 3 只执行首次接管/no-op 并冻结阶段。P-001 生产实现已经覆盖无旧镜像时的数据库恢复与人工恢复状态，因此未修改 P-001 结果或生产文件。
- P-002 激活时必须重新只读确认没有运行中的容器挂载固定卷；该检查只证明数据库已停写，不识别旧 Compose 路径。若仍有写入者，Codex 不代替用户停止它。
- 本次 `$implement-planned-feature` 已激活 P-002-T-001。任务影响范围为忽略配置、固定 SHA 的 clean detached worktree、配置指向的 iStoreOS 新发布/备份状态和本执行状态；完成条件为 G-P2-001–G-P2-004 全部通过、首次部署退出 0、新 SHA 服务 healthy、固定卷与单备份保持且旧目录未进入操作范围。
- 任务本地基线通过：待发布 SHA 与 detached worktree 精确匹配、worktree porcelain 为空、真实配置不在发布 tree 且继续被 Git 忽略、需求/路线图指纹一致、P-001 六个冻结文件哈希一致。首次检查仓库外 `IdentityFile` 时受到本地沙箱拒绝，获准读取路径元数据后复核通过；未输出配置值或私钥路径。
- 根目录出现用户持有的未跟踪 `AGENTS.md`；内容与当前 P-002 恢复边界一致。它不在固定提交或 detached 发布 tree 中，本阶段保留且不归属、不提交、不发布。
- 只读服务器门禁最终通过：非交互 SSH、Docker Engine/Compose、所需远端命令、固定卷、配置发布/备份父路径权限、数据库存在性和哈希能力均可用；配置正式目录尚不存在，无部署锁、发布临时项或备份临时项；运行中挂载固定卷的容器数为 0。检查未进入旧 Compose 目录，也未输出旧 Docker/旧目录身份。
- 前两次只读脚本封装受到 Windows PowerShell 标准输入 BOM 影响：第一次在首行即退出，第二次全部显式检查通过但严格 `set -eu` 首行未生效；两次均无服务器写入。第三次先丢弃 BOM 行后以严格错误退出重新完成相同检查并干净返回 0，其结果作为 G-P2-001/G-P2-002 的有效门禁证据。
- P-002-T-001 已到首次服务器写入前检查点。授权来源为用户本次调用 `$implement-planned-feature`；下一原子操作仅为从固定 detached worktree 运行受支持的 `deploy/deploy.ps1`。若命令失败，不启动 P-002-T-002，先按首次接管恢复规则做只读状态核对并暂停。
- 唯一一次首次部署命令已执行并返回 1。源码上传、哈希校验和解包通过；远端 Compose build 在解析 `node:24.18.0-bookworm-slim` 元数据时，Docker Hub 匿名令牌请求返回 EOF。失败发生在冷备份、正式目录交换和新服务启动之前，生产状态机从 `verified` 阶段清理并报告恢复先前安全状态。
- 失败后只读核对通过：配置正式目录未创建，固定数据库备份未创建或覆盖，新 SHA 镜像标签不存在，没有新服务启动，没有部署锁、upload/incoming/previous/failed 临时目录或备份临时文件；固定卷数据库仍存在且无运行中写入者。检查未进入或修改旧 Docker/旧目录。
- 该失败是目标 iStoreOS 到 Docker Hub 的外部构建依赖阻塞，不是已证明的生产脚本缺陷，也不是 relaxed 可放行 finding。依据阶段计划，本次不自动重试、不执行 P-002-T-002/no-op、不创建阶段结果。
- 维护者在 iStoreOS 上成功执行 `docker pull node:24.18.0-bookworm-slim` 并要求继续；恢复调用重新读取 schema 3.2 契约、P-002 计划修订 3、路线图修订 2、相关需求与 P-001 冻结结果，需求/路线图指纹和 P-001 六个关键文件哈希仍完全匹配。
- 恢复本地门禁通过：detached worktree 仍 clean 且精确位于 Git `f049a7c6e2524ffa9da670ab6629ad2f9e7fd466`；真实配置继续被忽略且未跟踪，允许键、目录分离和仓库外私钥存在性通过；根目录用户持有的未跟踪 `AGENTS.md` 保持未修改、未提交、未发布。
- 恢复远端门禁通过：非交互 SSH、Docker Engine/Compose、`node:24.18.0-bookworm-slim` 本地镜像、固定卷、SQLite 只读头校验、发布/备份父目录权限均可用；无运行中卷写入者，配置正式目录、新 SHA 镜像、锁、发布临时项、固定备份和备份临时项均不存在，数据库基线指纹为 `sha256:e805c4d2f9b6a3716f9760129c3cc33144023f108a11243460f9dcb036b7b88a`。
- 第一次恢复检查因 iStoreOS 不提供 `od` 而在只读 SQLite 头校验处返回非 0；检查未产生远端写入。随后改用已预拉取的 Node 镜像只读挂载固定卷完成等价校验，完整门禁干净返回 0；该环境兼容性调整仅属于验证封装，不修改生产脚本或部署状态。
- P-002-T-001 已从外部依赖阻塞恢复为 `in_progress`。下一原子操作仍只允许从固定 detached worktree 重试一次受支持的 `deploy/deploy.ps1`；失败时先只读核对并暂停，成功时先完成 G-P2-003/G-P2-004 后置门禁再激活 P-002-T-002。
- 恢复后的唯一一次部署重试返回 1：基础镜像元数据从本地立即命中，构建上下文和前置层成功；`npm ci` 安装 `better-sqlite3@11.10.0` 时没有适配 Node `24.18.0` 的预编译二进制，`node-gyp` 转而从 `nodejs.org` 下载同版本头文件，HTTP 200 后 TLS 流被终止。远端状态机在 `verified` 阶段恢复并清理。
- 第二次失败后只读安全核对通过：配置正式目录与固定备份仍不存在，新 SHA 镜像和新服务不存在，无部署锁、upload/incoming/previous/failed 或备份临时项；固定卷数据库 SHA-256 仍精确等于部署前 `e805c4d2f9b6a3716f9760129c3cc33144023f108a11243460f9dcb036b7b88a`，无运行中卷写入者。检查未进入或修改旧 Docker/旧目录。
- 诊断性无网络容器检查确认 `node:24.18.0-bookworm-slim` 已包含 `/usr/local/include/node/node.h`、`common.gypi` 和 `config.gypi`。最小候选修复是在构建阶段让 `node-gyp` 使用 `/usr/local` 本地头文件而非联网下载，但 `Dockerfile` 不在 P-002 计划文件范围内，且修改会产生不同于固定 SHA 的发布来源；当前实施调用不得越权修改、提交或重跑。
- 进一步网络诊断确认 Docker Hub 认证端点连续成功，`nodejs.org` 只解析 IPv4、HEAD 和 1 KiB Range 成功，但完整 `9,951,449` 字节响应在约 `82,430` 字节后以 `UND_ERR_SOCKET / other side closed` 中止；Docker daemon 未配置显式 HTTP/HTTPS 代理。该结果把问题限定为 Docker 出站路径到该大响应的可重复中断，不涉及 SSH 入站链路。
- 维护者在了解上述原因和推荐修复后明确要求“再尝试部署”。该回答记为 Q-010；P-002 计划升为修订 4，仅允许重新完成全部只读门禁后的这一轮受支持入口重试，不修改固定提交或生产文件，不构成构建门禁豁免。
- P-002-T-001 已恢复为 `in_progress`。下一原子操作先重新核对本地/远端安全基线；通过后运行一个部署进程。成功才进入后置健康/数据门禁；失败则只读核对、恢复 `blocked` 并停止。
- 修订 4 重试前门禁通过：需求与路线图指纹、P-001 六个关键文件哈希、固定 SHA 和 clean detached worktree均匹配；真实配置继续被忽略且未跟踪，阶段计划修订 4 指纹为 `sha256:5c3f658b00514ca5673a28bfc27d56a6727b00a71f2327cd9fbbf31080821cc2`。远端非交互 SSH、Docker/Compose、精确基础镜像、固定卷和 SQLite 有效；数据库指纹仍等于原安全基线，无运行写入者、配置正式目录、固定备份、新 SHA 镜像、锁或临时项。下一原子操作只运行一个受支持部署进程。
- 修订 4 的唯一部署重试返回 0，约 121 秒：基础镜像命中，`npm ci` 本次完成原生依赖安装，Web/Server 生产构建和生产依赖裁剪成功；随后执行首次无旧容器分支、固定卷冷备份、正式目录切换、新 SHA 服务启动、Docker health 和清理。命令日志覆盖 preflight、upload、build、stop、backup、switch、health、cleanup，未进入旧 Docker/旧目录。
- 独立部署后门禁通过：发布标记和运行镜像均为固定 full SHA；新 Compose 范围恰好一个 `home-table` 服务且 Docker health 为 healthy，对外 `/healthz` 成功；容器在 `/data` 挂载原固定卷；备份目录恰好一个非空且 SQLite 头有效的固定备份；正式目录存在且没有锁、upload/incoming/previous/failed、标记临时文件、备份临时文件或 rollback 标签。
- P-002-T-001 后置结构指纹为 `sha256:ded9c172dfc6a2a777870f9c183f2a9236631ad3f529aec95237b7421005d2dd`，数据库指纹为 `sha256:e805c4d2f9b6a3716f9760129c3cc33144023f108a11243460f9dcb036b7b88a`。G-P2-001–G-P2-004 全部通过，P-002-T-001 完成；下一原子任务为 P-002-T-002 的相同 SHA no-op。
- P-002-T-002 已激活。no-op 前重新只读确认发布标记、运行镜像、healthy、固定卷、固定备份和无临时项；结构指纹仍为 `sha256:ded9c172dfc6a2a777870f9c183f2a9236631ad3f529aec95237b7421005d2dd`，数据库指纹仍为 `sha256:e805c4d2f9b6a3716f9760129c3cc33144023f108a11243460f9dcb036b7b88a`。下一原子操作只从同一 clean detached worktree运行相同单命令，预期明确 no-op。
- P-002-T-002 的第二次同 SHA 命令返回 0，远端状态机明确报告 healthy-SHA no-op，没有 build、stop、backup、switch 或 `compose up`；但本地快速探测没有识别 no-op，日志先出现本地归档、上传准备和远端状态机调用。远端权威复核拒绝应用已上传内容并安全清理。
- no-op 后独立比较通过：结构指纹与数据库指纹逐字等于前置快照；发布标记、运行镜像、容器、health、固定卷、固定备份哈希/时间和正式目录均未变化，无锁或发布/备份临时项。该证据证明远端权威 no-op 的数据安全，但不能证明 AC-015 所要求的零上传。
- 默认和显式 `PARTY_IMAGE`/`PARTY_PORT` 的 `docker compose ps -q home-table` 均能找到同一服务，排除 Compose 环境变量导致的误判。使用与生产入口相同的 Windows PowerShell 5.1 原生命令调用路径，远端 `printf "NOOP\n"` 返回 UTF-8 十六进制 `4E4F4F506E`（`NOOPn`），而 `printf NOOP` 返回 `4E4F4F50`（`NOOP`）；生产解析只接受精确 `NOOP`。根因已确定为内嵌双引号在 `ssh.exe` 参数封送中丢失后，远端 shell 把未引用的反斜杠吞掉。
- 该问题是 AC-015/core 与 G-P2-005 的生产实现缺陷，不是 supplemental finding。P-002-T-002 保持未完成，未创建 P-002 结果。当前配置正式目录已经存在且由自动化管理，后续修复会产生新 Git SHA，因此原“首次目录不存在、正常发布与 no-op 同一 SHA”的阶段事实也必须由规划修订后重新映射。
- `$plan-feature-implementation` 修订审计通过：requirements/schema 3.2/`relaxed`/AC 层级均无变更；P-001 六个关键文件哈希继续匹配，首次接管与失败 no-op 证据可恢复，当前没有未决产品问题。路线图升为修订 3，指纹为 `sha256:fe86edbd0e8a56f9d62cc6e87bd005b4229934afaccada49e9e77d8b670aa6b8`。
- P-002 计划升为修订 5，指纹为 `sha256:bb8964788658fbb2169fcd9f236a4eac2a4578adfe02d2aa1cb62a9597bb047c`：保留已完成的 T-001；T-002 纠正短探测 token、Dockerfile 本地 Node 头文件与回归并创建新提交；T-003 从新 clean detached worktree完成受管更新、零上传 no-op和阶段冻结。
- 路线图修订 3 采用“首次接管旧 SHA + 纠正后新 SHA 正常更新/no-op”的组合证据，不删除当前正式目录或重造首次状态。P-003 的受控实机回滚和 finalization 保持未执行；本规划调用没有修改生产文件、运行测试、创建提交或连接服务器。
- 本次 `$implement-planned-feature` 已按修订 5 激活 P-002-T-002；schema 3.2、需求/路线图/阶段计划指纹、P-001 不可变结果和六个关键文件 SHA-256 均重新核对并匹配，`phase-002-result.md`、`change-0.md` 与 `effective-requirements.md` 均尚未创建。
- T-002 任务前基线：Git `HEAD` 为 `f049a7c6e2524ffa9da670ab6629ad2f9e7fd466`；porcelain 共 5 条，只有四份 deployment-automation 规划/状态文档和用户未跟踪 `AGENTS.md`，UTF-8 清单指纹为 `sha256:16218e1b3af5cdca58a254887965b5a50a7a8998b3eb10f1f5b39a8f49a7e75f`。真实配置继续被 Git 忽略且未跟踪，当前无 Bash 进程。
- T-002 生产文件基线：`deploy/deploy.ps1` `sha256:b6ec293536f9782ae6c3b956137678e18f6072157c8af49af87fdb70978f79fd`；`Dockerfile` `sha256:652adc498231f2bbbf61c380481664db2f4db7ff65f0b697e8b543329879ce04`；`tests/deployment-automation.test.ts` `sha256:c34e386463f2cd5543e22a02c406954eb0cf62ad1ec92192feff1fa6bc958ce2`；`fake-open-ssh.mjs` `sha256:d8721846bf616949197589f43f7680c50d76d4cef9f955d2f36ab18cbaf9982c`。
- T-002 影响范围固定为上述四个实现/测试文件和本执行状态；完成条件为短 token 真实进程边界、Node 本地头文件配置、既存 17 场景、新增回归、AST/POSIX 语法、lint、typecheck、build、安全扫描和 diff check 全部通过，再创建只含计划内非敏感 tracked 文件的新提交与 clean detached worktree。本任务本地验证期间不连接服务器。
- T-002 实际实现只修改 `deploy/deploy.ps1`、`Dockerfile` 与 `tests/deployment-automation.test.ts`：短探测改用无引号、无转义换行的固定 token；构建阶段设置 `npm_config_nodedir=/usr/local`；测试增加运行时编译的原生 `ssh.exe` 参数捕获回归和 Dockerfile 顺序断言。`fake-open-ssh.mjs` 最终字节保持 P-001 哈希不变，未连接服务器。
- T-002 本地门禁全部通过：新增原生边界回归、完整 `npm run test:deploy` 19/19、PowerShell AST、POSIX `sh -n`、lint、typecheck、生产 build、敏感/危险命令与忽略配置扫描、`git diff --check` 和 Bash 进程收敛均返回 0。实现后哈希为 `deploy/deploy.ps1` `sha256:1faf83b47baa5968af2f306376fe7347369bae1c6dc40586839a9bf0c80f4ec0`、`Dockerfile` `sha256:2e800cb858d252b681f5d618f9fb553d23d5f34c40aaad52d0fe86fb351b103f`、`tests/deployment-automation.test.ts` `sha256:353c491e6e73dea55a6dc65a158ad4aacf8648685df65b6d337297db88639b96`。
- 新增回归的第一次夹具实现沿用 `.cmd` 包装层，只能观察多行命令的首行 `set -eu`，因此定向测试失败且未触及生产；改为运行时编译原生 `.exe` 后，首次日志读取又暴露 .NET UTF-8 BOM，改用无 BOM 编码后定向和完整回归均通过。这两个已修复的验证夹具问题没有交付影响，不分配 finding。下一原子步骤是暂存全部计划内 tracked 差异，复核 staged 清单与敏感扫描后创建新提交和 clean detached worktree。
- T-002 提交检查点通过：提交 `1d049a55ad3432bb1260fe2ddd1ac5f3ca85d6ea`（`fix: harden deployment no-op and native builds`）只含 `Dockerfile`、`deploy/deploy.ps1`、三份 pre-freeze 需求/规划文档、本执行状态和部署测试，共 7 个计划内 tracked 文件；staged 清单、敏感标记、配置忽略与 diff check 均通过，未包含 `AGENTS.md`、真实配置或私钥。
- 新发布工作树 `C:\tmp\home-table-p2-1d049a55` 已创建：detached `HEAD` 精确为新 full SHA，porcelain 为空，真实配置和 `AGENTS.md` 均不存在；三个改动文件哈希与提交前验证完全一致。旧 `C:\tmp\home-table-p2-f049a7c6` 继续只作历史证据，不再作为发布来源。
- P-002-T-002 已完成并激活 P-002-T-003。下一原子操作先通过只读 SSH 重新核对服务器仍是旧 SHA healthy、恰好一个受管服务、固定卷/唯一有效备份、无锁/临时项/rollback 标签，并记录脱敏结构与数据库基线；任何门禁失败都在调用部署入口前停止。
- T-003 本地与认证门禁通过：新 worktree仍 clean 且 full SHA/文件哈希匹配；主工作区配置只含允许键、远端路径安全分离、继续被 Git 忽略且未跟踪；仓库外私钥存在，系统 OpenSSH 以 `BatchMode=yes`、`IdentitiesOnly=yes` 返回固定只读哨兵。没有输出或记录主机、用户、路径或私钥值。
- T-003 服务器写入前只读门禁通过：配置正式目录仍标记并运行旧 SHA `f049a7c6e2524ffa9da670ab6629ad2f9e7fd466`，恰好一个受管 `home-table` running/healthy且为非 root，Compose working-dir精确属于配置正式目录，`/data` 使用固定卷；备份目录只有一个有效 `platform.sqlite.backup`，数据库与备份均通过 SQLite 头/大小校验；无锁、upload/incoming/previous/failed、备份临时项或 rollback 标签，未进入旧 Docker/旧目录。
- 写入前脱敏基线：结构指纹 `sha256:300f73757017af25a202426b9c2291d9a65e96da4e34bd0d94e6cb2a039f5ebb`；数据库 `sha256:e805c4d2f9b6a3716f9760129c3cc33144023f108a11243460f9dcb036b7b88a`；固定备份 `sha256:e805c4d2f9b6a3716f9760129c3cc33144023f108a11243460f9dcb036b7b88a`，mtime `1785178233365` ms；本机外部 `/healthz` 返回 200。下一原子操作只从新 worktree显式引用主工作区忽略配置运行一次受支持部署入口。
- 新 SHA 正常更新已完成：受支持入口依次记录本地 preflight/upload/build、远端 preflight/upload/build/stop/backup/switch/health/cleanup和本地 cleanup，最终明确报告 `1d049a55...` 部署成功且 healthy。完整构建日志没有 `gyp http GET`；Docker 事件独立证明新镜像创建完成 11,316 ms 后才停止旧容器，新容器在旧容器 stop 后 1,577 ms 启动。
- 外层构建期监控器因匹配了不存在的固定文案 `Building image`（真实文案为 `Building <image>`），且 `Start-Process` 的 ExitCode 读取为空，把已成功的子部署误报为 wrapper 退出 1；它没有改变部署入口或服务器状态。生产子进程只有在远端返回 0 后才可能输出最终本地 `[CLEANUP] ... completed successfully`，独立 post-gate 也证明部署完整成功；未重跑正常更新。该已解释验证封装偏差不影响交付，不分配 finding。
- 新 SHA 独立后置门禁通过：发布标记和运行镜像均为新 full SHA；恰好一个受管服务 running/healthy且非 root，对外 `/healthz` 返回 200，固定卷与 Compose 归属不变；唯一备份有效，无锁、upload/incoming/previous/failed、备份临时项或 rollback 标签。数据库与备份 SHA-256 仍精确为 `e805c4d2f9b6a3716f9760129c3cc33144023f108a11243460f9dcb036b7b88a`，证明正常更新未改变业务数据；备份 mtime 更新为 `1785180699343` ms。
- no-op 前脱敏快照已固定：结构指纹 `sha256:01e14242e7ec6c1c3866c23a8eea1b22c251fb0a874ac42648c7113d9c97afa6`；数据库/备份指纹均为 `sha256:e805c4d2f9b6a3716f9760129c3cc33144023f108a11243460f9dcb036b7b88a`，备份 mtime `1785180699343` ms。下一原子操作从同一 clean worktree运行同一 SHA，要求本地三行 preflight/health、退出 0且无 upload/build/远端状态机。
- 同一新 SHA 的实际 no-op 已通过：受支持入口返回 0，输出精确为两行本地 `[PREFLIGHT]` 和一行本地 `[HEALTH] ... deployment is a no-op.`；逐行数量/内容断言先通过，因此确定没有 upload、build、stop、backup、switch、cleanup或小写远端状态机输出，也没有归档/SCP路径。
- no-op 外层断言随后因正则使用 `(?i)`，把合法大写 `[PREFLIGHT]` 误匹配为禁止的小写 `[preflight]`，故 wrapper 返回 1；该错误发生在实际命令退出码和精确三行断言已经通过之后，未触发第二次发布或任何恢复动作。依据计划“不盲目第三次尝试”，没有重跑同一命令；该已解释验证封装偏差不影响 AC-015，不分配 finding。
- no-op 后独立状态相等门禁通过：结构指纹仍为 `sha256:01e14242e7ec6c1c3866c23a8eea1b22c251fb0a874ac42648c7113d9c97afa6`；数据库/备份指纹仍为 `sha256:e805c4d2f9b6a3716f9760129c3cc33144023f108a11243460f9dcb036b7b88a`，备份 mtime仍为 `1785180699343` ms；当前新 SHA 服务 healthy、固定卷/单备份/单正式目录和无临时项全部保持，对外 `/healthz` 返回 200。
- P-002-T-003 已完成；G-P2-001–G-P2-007 与 AC-014 全部获得通过证据，无开放 finding。下一原子步骤是复核指纹、P-001 哈希、工作区/发布 worktree和远端最终安全状态，然后创建不可变 `phase-002-result.md` 并把 initial 运行置为 `awaiting_next_phase`；P-003 保持未执行。
- P-002 冻结前复核通过：需求、路线图与阶段计划指纹精确匹配；P-001 结果文件未改，四个未纠正的关键文件保持 P-001 哈希，两个计划纠正文件匹配 T-002 新哈希；新 detached worktree clean且位于正确 SHA，主工作区只有本状态、阶段结果和用户 `AGENTS.md`；`git diff --check`、Bash/监控临时日志收敛和远端最终安全状态均通过。
- [phase-002-result.md](phase-002-result.md) 已创建并冻结，结论为 `completed / passed`，无 `FND-I-*`。initial 运行已进入 `awaiting_next_phase`；P-003 仍为 planned，未创建计划、未执行回滚，也未生成 `change-0.md` 或 `effective-requirements.md`。

以下应用与牌局文件已包含在待发布提交中，不属于本次 P-002 文档修订；实施时不得再编辑、还原或重新归属：

- `apps/server/src/app.ts`
- `apps/web/src/locales.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `packages/contracts/src/index.ts`
- `packages/domain/src/index.ts`
- `tests/e2e/core.spec.ts`
- `tests/server.test.ts`
- `docs/requirements/home-party-game-platform/effective-requirements.md`
- `docs/requirements/home-party-game-platform/change-2.md`
- `docs/requirements/home-party-game-platform/execution/change-2/`

## 4. 已完成任务

| 任务 | 状态 | 当前结果 |
| --- | --- | --- |
| P-001-T-001 | completed | 新增本地 PowerShell 编排器、远端 POSIX 部署/回滚状态机和示例配置；Compose 增加保留旧默认值的 `PARTY_IMAGE`；Git/Docker 忽略实际配置和部署标记 |
| P-001-T-002 | completed | 状态化假 OpenSSH/Docker 边界覆盖 17 个计划场景；完整 `npm run test:deploy` 返回 0，五个测试组均低于 Vitest worker RPC 时限且运行后无 Bash 残留 |
| P-001-T-003 | completed | 两份 README 已覆盖配置、认证、幂等、单备份、恢复、Git 历史和外部边界；最终本地硬门禁全部通过 |
| P-002-T-001 | completed | 固定 SHA 的真实 iStoreOS 首次接管退出 0；SHA 镜像、外部/容器健康、固定卷、单一有效备份、唯一受管目录和无临时状态的独立门禁通过 |
| P-002-T-002 | completed | 修复 Windows/OpenSSH 短 token 与 Node 本地头文件构建；19/19 部署场景和全部本地 hard gate通过；创建新提交与 clean detached worktree |
| P-002-T-003 | completed | 新 SHA 受管更新完成，构建使用本地 Node 头文件且 build-before-stop；同 SHA 第二次命令在本地三行 fast path退出，前后结构/数据库/备份完全相等 |

## 5. 运行累计文件变化

| 文件 | 模式 | 状态 |
| --- | --- | --- |
| `requirements.md` | modify | 修订 1：补充新目录首次接管、旧 Docker 外部边界和延后实机回滚决定 |
| `workflow-contract.md` | existing input | 澄清阶段已创建；schema 3.2 不可变契约 |
| `implementation-plan.md` | add | 路线图修订 3：保留首次接管，P-002 追加真实边界纠正和新 SHA 更新/no-op，P-003 回滚验收不变 |
| `execution/initial/phase-001-plan.md` | add | 已完成 P-001 的详细计划修订 1 |
| `execution/initial/execution-state.md` | add | 当前协调权威 |
| `deploy/deploy.ps1` | add | PowerShell 5.1 本地预检、no-op、Git HEAD 归档、SSH/SCP 编排与退出码 |
| `deploy/remote-deploy.sh` | add | POSIX 锁、构建、单备份、切换、健康、回滚、中断/遗留恢复和清理 |
| `deploy/deploy.config.example.psd1` | add | 无密码字段的本地配置示例 |
| `deploy/compose.yml` | modify | 镜像改为带 `0.1.0` 默认值的 `PARTY_IMAGE` 插值 |
| `.gitignore` | modify | 忽略实际部署配置与本地部署临时项 |
| `.dockerignore` | modify | 排除实际配置、发布标记和部署临时项 |
| `tests/deployment-automation.test.ts` | add | 临时 Git 仓库、受限假外部边界、原生 Windows 参数捕获与 19 场景成功/故障矩阵 |
| `tests/fixtures/deployment-automation/fake-open-ssh.mjs` | add | 捕获 SSH/SCP 参数和上传物，不建立网络连接 |
| `tests/fixtures/deployment-automation/fake-docker.mjs` | add | 状态化 Compose/镜像/卷/数据库与故障注入 |
| `package.json` | modify | 增加分组且有界的 `test:deploy` 命令，避免长测试文件触发 worker RPC 超时 |
| `deploy/README.md` | modify | 自动部署配置、认证、单备份、幂等、自动/人工恢复、Git 历史与实机边界 |
| `README.md` | modify | 增加 Windows 单命令部署入口和本地/实机验收边界 |
| `execution/initial/phase-001-result.md` | add | 冻结 P-001 任务、文件、验证、恢复记录和 P-002 进入条件 |
| `execution/initial/phase-002-plan.md` | add | P-002 计划修订 5：T-001 已完成，T-002 纠正/新提交，T-003 新 SHA 更新、零上传 no-op和阶段冻结 |
| `execution/initial/phase-002-result.md` | add | 冻结首次接管、真实边界纠正、新 SHA 更新、零上传 no-op和 P-003 进入条件 |

现有应用源码与应用测试未由本阶段修改。`docs/requirements/poker-room-experience-upgrade/` 及既存 change-2 文件也保持用户所有，不属于本功能清单。

## 6. 测试与验证证据

已完成的规划证据：

- 完整读取并审计需求与工作流契约。
- 确认所有 FR/AC/NFR 均映射到 P-001/P-002/P-003 和 V-001–V-009。
- 确认现有 Compose 服务为 `home-table`、数据库为 `/data/platform.sqlite`、固定卷为 `home-party-game-platform-data`、健康端点为 `/healthz`。
- 确认预期部署文件无既存差异，已有用户改动与本功能预期文件不重叠。
- 确认本地可使用 PowerShell 5.1 与 Git Bash 做脚本验证，且 Docker 不可用。
- `implementation-plan.md` 的八个必需章节存在；路线图创建后 `git diff --check` 通过。
- PowerShell AST 解析：通过。
- Git for Windows `sh -n deploy/remote-deploy.sh`：通过。
- `deploy.config.example.psd1` 导入：通过，只有计划声明的八个配置键。
- 敏感/危险命令扫描：未发现 `sshpass`、`StrictHostKeyChecking=no`、密码字段、`compose down`、`down -v` 或卷删除命令。
- 显式传入不存在的配置文件：在远端调用前退出 1。
- 初次完整运行暴露活动锁夹具的长驻 Bash 子进程回收缺陷并由用户中止；孤立 PID 38664 后由用户手动结束。夹具已改为同步前台自持锁，后续分段和完整运行均无 Bash 残留。
- 单文件 92 秒运行曾因 Vitest worker `onTaskUpdate` 约 60 秒超时而在 11 个场景全通过后返回 1；`test:deploy` 已按行为分为五个独立进程，每组低于 60 秒且失败短路。
- 故障矩阵发现锁前脚本哈希失败不会清理上传目录；生产脚本增加仅在安全路径完全验证后置位的 `PATHS_READY`，定向回归通过。
- 最终完整 `npm run test:deploy`：返回 0，17/17 计划场景通过；五组耗时约 9、38、36、45、21 秒，总耗时约 155 秒。
- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm run build`：通过；Web/Server 生产产物和无外链静态资源检查完成。
- PowerShell AST、`sh -n deploy/remote-deploy.sh`、最终 `git diff --check` 与安全扫描：通过。
- 完整测试结束后 `Get-Process -Name bash` 无结果；未留下测试 Bash 进程。
- 最终 Compose diff 只把镜像行改为 `${PARTY_IMAGE:-home-party-game-platform:0.1.0}`；服务名、平台、构建、端口、healthcheck 和固定卷未改。
- AC-014 阶段日志静态核对通过：预检、上传、构建、停止、备份、切换、健康、回滚和清理均有明确日志点。

已完成无网络、无 Docker 的部署状态化测试；未运行 Docker、真实 SSH/SCP、服务器 healthcheck 或 iStoreOS 操作。P-001 验证结论为 `passed`。

P-002 本次实机证据：

- 本地发布门禁：通过；固定 SHA、clean detached worktree、忽略配置、非交互私钥、需求/路线图指纹和 P-001 冻结哈希均匹配。
- 只读 iStoreOS 门禁：通过；固定卷与数据库可用，无运行中卷写入者，配置正式目录处于首次部署状态，无锁或临时项。
- 首次部署命令：返回 1；上传与校验通过，Compose build 因 Docker Hub 匿名令牌请求 EOF 失败，未进入备份、切换或健康阶段。
- 失败后安全状态：通过；无正式发布、无固定备份变化、无新服务/新 SHA 镜像、无锁或部署临时项，数据库与固定卷保持。
- 外部依赖恢复：维护者成功预拉取精确 Node 基础镜像；Codex 独立只读复核镜像可解析、固定卷 SQLite 有效、数据库基线不变、无卷写入者、无正式发布/备份/锁/临时项。
- 首次部署重试：返回 1；基础镜像命中，但 `better-sqlite3` 触发 `node-gyp` 下载 Node 头文件并在 TLS 流中止后失败，未进入备份、切换或健康阶段。
- 第二次失败后安全状态：通过；正式目录、固定备份、新 SHA 镜像/服务、锁和临时项均不存在，数据库指纹精确不变。
- 构建诊断：通过；基础镜像已内置完整 `/usr/local/include/node` 头文件，具备规划一个不依赖该下载的最小 Dockerfile 修复的事实依据。
- 修订 4 重试前本地/远端门禁：通过；固定提交、冻结证据、数据库基线和切换前空状态均未漂移。
- 修订 4 首次接管重试：返回 0；构建、冷备份、切换、启动、健康和清理全部完成。
- G-P2-003/G-P2-004：通过；固定 SHA 镜像和唯一新服务 healthy，对外健康成功，固定卷不变，备份目录只有一个有效文件，受管范围无锁、临时目录/文件或 rollback 标签。
- P-002-T-001 完成；P-002-T-002 第二次命令返回 0且远端状态恒等，但本地快速探测误入归档/上传，G-P2-005 与 AC-015 未通过。
- no-op 后状态恒等：通过；结构和数据库指纹逐字不变，容器、镜像、卷、正式目录、备份哈希/时间、health 和无临时项均保持。
- no-op 误判根因复现：通过；Windows PowerShell 5.1 经 `ssh.exe` 传递带内嵌引号的 `printf "NOOP\n"` 实际输出 `NOOPn`，无引号控制 token 输出正确 `NOOP`。
- P-002-T-002 未完成；未创建 `phase-002-result.md`。
- 规划修订验证：schema 3.2、需求指纹、P-001 六个关键哈希、路线图八节/追踪和 phase-002-plan 修订链核对通过；`git diff --check` 通过。本次只规划，未运行实现测试或服务器命令。
- P-002-T-002 实现验证：`npm run test:deploy` 返回 0，五组共 19/19 场景通过，总耗时约 159 秒；新增原生 `.exe` 边界证明 PowerShell 5.1 传入的探测脚本包含 `printf NOOP`/`printf DEPLOY` 且不含 `NOOP\n`/`DEPLOY\n`，本地 no-op 仅一次 SSH、无 SCP或归档。
- Dockerfile 本地头文件验证：`ENV npm_config_nodedir=/usr/local` 位于 `RUN npm ci` 前；`npm run build` 返回 0。Dockerfile 的真实构建、非 root、health和卷复用仍由 T-003 iStoreOS 门禁证明，本机未运行 Docker或 `test:docker-smoke`。
- 项目与静态门禁：`npm run lint`、`npm run typecheck`、PowerShell AST、Git Bash `sh -n deploy/remote-deploy.sh`、安全/忽略配置扫描和 `git diff --check` 全部返回 0；测试后无 Bash 残留。npm 仍打印已知的用户级日志目录 `EPERM` warning，但命令、断言、项目文件和退出码不受影响。
- 新 SHA 正常更新：生产子进程记录完整成功阶段并只在远端返回 0 后输出最终本地 cleanup；构建日志无 `gyp http GET`。Docker 事件证明镜像创建在旧服务 stop 前 11,316 ms，新服务 start在旧 stop后 1,577 ms；独立 post-gate证明新 SHA、非 root、healthy、外部 200、固定卷、单备份、单目录和无临时项。
- 新 SHA 零上传 no-op：实际部署入口退出码 0且只有精确三行本地 preflight/health；没有本地归档、SCP或远端状态机阶段。前后结构、容器、镜像、卷、备份 SHA/mtime、正式目录、数据库和外部 health完全相等。

## 7. 决策、待确认问题与回答

| ID | 阶段/任务 | 问题 | 已确认事实 | 可选方案与影响 | 需要确认 | 状态 | 用户回答及来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q-001 | 规划 | 初始运行交付策略 | schema 3.2 要求明确 strict/relaxed | strict 或 relaxed | 选择策略 | resolved | 用户明确回复 `relaxed` |
| Q-002 | 规划/P-002 | 本地 Docker 与真实服务器验证边界 | 本机无 Docker，真实发布有外部副作用 | 本地尽量完成后交接，或提前连服务器 | 是否允许规划时/本地实现时连接 | resolved | 用户明确要求不要尝试 Docker；部署测试若需要则停下交给用户 |
| Q-003 | 规划 | 数据库备份与远端保留 | 数据库不能从 Git 恢复，源码可以从 GitHub 恢复 | 多份历史或单份原子覆盖 | 保留策略 | resolved | 用户明确要求永久只保留一个可配置目录中的备份和一个正式发布目录 |
| Q-004 | 规划 | 同 SHA 重复发布语义 | 服务器运行期间业务数据会继续变化 | 重做部署或成功 no-op | 是否要求无副作用 | resolved | 用户明确确认同 SHA 已健康运行时重复发布结果一致；需求进一步限定为不重置业务数据的成功 no-op |
| Q-005 | P-002 规划/执行 | 后续生产测试是否可由 Codex 连续执行 | 脚本支持系统 OpenSSH；真实发布会停服并原子覆盖唯一备份 | 用户提供证据，或未来任务逐次明确授权 Codex 执行 | 确认技术路径与授权边界 | resolved | 用户确认技术上可行即可；随后调用 `$implement-planned-feature`，授权本次在其余门禁通过后执行计划内正常发布和 no-op。交互密码仍不交给 Codex |
| Q-006 | P-002-T-001 | 当前部署自动化、牌局 change-2 与其他 workflow 共存于未提交工作区，如何形成待发布的干净提交 | 35 条逐文件状态同时包含本功能和用户所有改动；部署入口要求全部 tracked/untracked 状态为空；技能禁止未获授权的 commit/stash/reset/discard | 用户自行整理并提交；或明确指定由 Codex 提交的文件范围、是否包含全部当前改动和提交信息。任一路径都必须保留用户工作 | 请选择并完成/授权一种提交方式，使 `git status --porcelain` 为空 | resolved | 用户要求“把敏感信息加到 gitignore，然后提交到 git，然后继续测试”；结合前一轮二选一问题，明确授权提交当前全部非忽略改动 |
| Q-007 | P-002-T-001 | 真实部署配置和维护窗口尚未就绪 | `deploy/deploy.config.psd1` 不存在但已被忽略；主机、用户、两个远端目录、端口、非交互认证及真实环境当前无法核对 | 用户按 example 自行创建配置并确认维护窗口；或提供非密码配置值并明确要求 Codex 创建忽略文件。Codex 路径还需可用私钥/SSH agent | 请准备配置，并确认当前允许计划内短暂停服；不要发送密码或私钥内容 | resolved | 用户明确表示配置已填写并要求继续测试；本地无敏感输出核对确认配置、私钥和忽略门禁通过，当前任务视为允许计划内短暂停服 |
| Q-008 | P-002-T-001 | 配置的正式发布目录与当前健康服务的 Compose 仓库根不一致，如何修正 | 只读发现证明当前服务目录标签安全、实际仓库根存在/可写且含 compose；配置目录不存在。继续会失去旧容器/旧镜像自动回滚识别 | 原方案为复用实际仓库根；用户改选新目录首次部署、保留旧目录人工回滚，并授权正式部署时先停止旧服务。该方案需要修订需求与恢复设计 | 是否接受由新目录接管服务、旧目录仅作人工回滚来源，并在切换前停止旧服务 | resolved | 用户明确要求“使用首次部署，旧的目录不动，这次先不测回滚”，随后补充“把旧的服务停下来”；停服授权限定在修订计划后的正式部署时执行 |
| Q-009 | P-002/P-003 | 旧服务当前状态和实机回滚何时验收 | 首次部署分支无需旧镜像即可备份固定卷并启动新服务；失败会恢复数据库但不会启动旧服务 | 用户可先自行停服并授权首次接管，把实机回滚保留为后续阶段；或继续等待自动化接管旧版本 | 是否确认旧服务已停并接受本次无旧版本自动恢复的首次部署风险；回滚是否延后 | resolved | 用户明确确认旧 Docker 已手动关停，要求不再管理旧 Docker、现在直接尝试部署，并保留待测回滚，等下一项功能完成后一起测试 |
| Q-010 | P-002-T-001 | 已复现 `nodejs.org` 完整响应中止后是否仍对同一提交再试一次 | 两次部署失败均在备份/切换前安全恢复；精确基础镜像和本地头文件存在，但当前提交仍会触发公网头文件下载 | 先修订并实施 Dockerfile 离线头文件修复；或由维护者明确要求在安全门禁后承担一次同样失败风险的重试 | 是否明确要求不改代码再运行一次受支持入口 | resolved | 用户在网络原因说明后明确回复“好的，你再尝试部署”；阶段计划修订 4 限定为单次重试，失败后不再自动重复 |
| Q-011 | P-003 规划 | 是否已进入回滚维护窗口，并授权受控实机故障注入与自动回滚验收 | 服务器当前运行已通过 P-002 的 `1d049a55...`；P-003 必须使用不同的合法干净提交。最小有界方案是在 P-003 执行时先形成只含非敏感收口文档/状态的候选提交，正常部署该候选，并由外部监视器只停止一次精确匹配候选镜像的 `home-table` 容器，使生产状态机进入既有 new-health 失败路径；随后应自动恢复 `1d049a55...`、部署前数据库、单目录/单备份和 healthy 服务，并以非零退出证明发生了已恢复失败。不能用极短 health timeout 代替，因为恢复旧服务复用同一 timeout；本地确定性测试已证明数据库发生候选写入时的恢复和回滚失败保留现场 | A：现在授权，接受短暂服务中断并允许未来 P-003 实现调用在重新门禁后只停止一次精确候选容器（推荐）；B：尚未进入窗口，继续暂停且不创建 P-003 计划 | 是否确认下一项功能/候选提交可开始、当前已进入维护窗口，并明确授权上述受控破坏性回滚演练 | resolved | 用户明确回复 `A`；授权当前维护窗口内在全部门禁通过后只停止一次三重精确匹配的候选容器，不扩展为旧 SHA停止、重复注入、数据库人工写入、失败现场清理或旧目录操作 |

当前没有未决用户问题；P-003 规划门禁已关闭并进入 `ready`。

## 8. 发现项、偏差、风险与阻塞

- 当前无开放 `FND-I-*` 或计划偏差；下一个 finding ID 为 `FND-I-001`。
- P-001 的数据库备份/恢复、半交换目录、遗留锁、Compose 项目身份、命令注入和真实命令逃逸风险均已通过本地 hard gate。
- 初次长驻 Bash 夹具风险已通过同步前台夹具、子进程硬超时和五个短于 worker RPC 时限的测试组消除；最终两次完整运行都无 Bash 残留。
- 待发布应用与自动化已形成新提交 `1d049a55...` 和 clean detached worktree；主工作区只含本执行状态差异与用户 `AGENTS.md`，真实配置已通过忽略、键、路径和私钥存在性门禁。
- P-001 假外部边界不能证明特定 iStoreOS 的 Docker、SSH、文件系统、权限和现有数据状态；该风险已由 P-002 正常发布与重复 no-op 外部交接关闭，P-003 只补真实自动回滚证据。
- Q-006、Q-007、Q-008 已解决；只读探测没有改变服务器。提交候选或 clean detached worktree 若出现敏感文件、未知差异或 SHA 不一致，必须在 SSH 前重新暂停。
- 首次接管时没有自动化可识别旧版本，用户已明确接受该历史边界；P-002 随后形成可识别的受管旧版本。P-003 现以 `1d049a55...` 为旧安全状态验收应用与部署前数据库一体自动回滚。
- 已关闭的构建阻塞：生产 `Dockerfile` 的 `npm ci` 会让 `node-gyp` 从 `nodejs.org` 下载同版本头文件，该路径曾复现完整响应中止；维护者明确授权的修订 4 单次重试最终成功，构建及全部首次接管 core/data 门禁通过。该偶发外部网络依赖仍是后续部署风险，但不再阻塞本次已取得的正常发布证据。
- 已关闭的 core 缺陷：`deploy.ps1` 的短 token 已改为不依赖引号/换行，原生 `.exe` 回归和 P-002 新 SHA 第二次命令共同证明本地零归档/零 SCP；AC-015 已通过。
- 已关闭的构建风险：Dockerfile 已让 `node-gyp` 使用基础镜像内置 `/usr/local/include/node`；P-002 新 SHA 实机构建无 `gyp http GET`，buildability hard gate 已通过。
- P-003 外部授权阻塞已由 Q-011 的用户回答 A 解除；路线图修订 4 与阶段计划修订 1 把授权限定为三重精确匹配后的单次候选停止。候选未出现、匹配不唯一、自动恢复失败或状态未知时仍必须 fail closed，不得重试或清理现场。
- 用户新增收尾要求已登记为 initial 工作流完成后的独立仓库操作：按届时真实工作区装填更新根 `AGENTS.md`，复核无敏感信息后提交并推送 GitHub。该授权不改变 schema-v3 验收范围，也不代替 Q-011 的生产回滚授权。只读审计确认 `AGENTS.md` 当前未跟踪且未被忽略，`sha256:2e4f339036aa4dbae7bdcadb8dd0a296c3efcfadddb77f926461582b7dcdeff8`；其中 Git SHA、P-002 状态、部署测试场景数和真实部署恢复说明均仍是 P-002 执行前快照。P-003 完成后应以最终 Git/工作流/服务器事实一次性纠正这些段落，再将该文件纳入用户要求的最终提交。

## 9. 精确恢复步骤

P-003 计划修订 1 为 `ready`，当前任务为空。精确恢复步骤：

1. 下一次只调用 `$implement-planned-feature`，完整读取 [phase-003-plan.md](phase-003-plan.md) 修订 1、路线图修订 4、本状态、requirements、P-001/P-002 不可变结果和 `AGENTS.md` 所有权边界；确认指纹及 Q-011 的 A 授权。
2. 激活 P-003-T-001，在任何提交或外部副作用前重验当前 Git/status、冻结结果、配置忽略/私钥存在性和严格只读服务器门禁。
3. 只暂存路线图、状态、冻结 P-002 结果和 P-003 计划四份工作流文件，创建文档候选 SHA和 clean detached worktree；验证相对 `1d049a55...` 的生产构建输入不变，并完成监视器 fail-closed probe。
4. 激活 P-003-T-002，按阶段计划的 durable checkpoints 启动三重匹配监视器，再运行唯一一次候选部署；只允许一次候选 `docker stop`，等待受支持入口自动恢复旧 SHA与部署前数据库并非 0退出。
5. 只有 G-P3-001–G-P3-005 和独立后置门禁通过后才激活 T-003，创建 `phase-003-result.md`、`change-0.md`、`effective-requirements.md` 并把 initial 置为 `completed`。
6. 实现技能退出后，按用户新增目标更新 `AGENTS.md`、复核最终工作区、创建最终提交并推送 GitHub。

不得修改本阶段结果，不得删除、还原或归属任何既存 change-2 与 `poker-room-experience-upgrade` 文件。

## 10. 最终完成门禁

- P-001 三个任务全部完成，所有本地 core 和 hard gate 通过，phase result 已冻结。
- P-002 按 [phase-002-plan.md](phase-002-plan.md) 保留首次接管、完成真实边界纠正、新 SHA 受管更新和零上传 no-op，冻结阶段结果并进入 `awaiting_next_phase`。
- P-003 在下一项合法功能提交和回滚维护窗口就绪后滚动规划并完成实机回滚验收。
- 所有 AC-001–AC-013、AC-015 通过；AC-014 通过或形成证明无交付影响的合规 `FND-I-*`。
- 无未决问题、半完成远端状态、未知用户文件、凭据泄露或无法解释的验证失败。
- `change-0.md` 与 `effective-requirements.md` 只在 P-003 最终门禁通过后生成并与所有阶段证据一致。
