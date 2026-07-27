# deployment-automation / initial 执行状态

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：`../../change-0.md`
- 运行状态：`in_progress`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`
- 当前路线图修订：`1`
- 需求指纹：`sha256:c775428ce2b0f419fcc098995591d4bbe84fb0a6a4b9b6e7372f6cb1fb511ae3`
- 路线图或变更计划指纹：`sha256:992accdfc4dc4ee9faee11dbbaa4f40400a16fc386910f7af403069dbdcd4ddd`
- 当前阶段：`P-002`
- 当前任务：`P-002-T-001`
- 项目基线：Git `f671f71c24a9f12473e58da13c01cc9e2002d8b7`；部署生产文件无既存差异，工作区含需保留的既存德州扑克 change-2 改动
- 最后更新时间：`2026-07-28`

## 1. 运行目标或待生效变更

从 Windows 本地交付单命令、部署状态幂等的 iStoreOS 发布自动化：只发布干净已提交的 Git `HEAD`，远端构建期间旧服务运行，切换前对 SQLite 做单文件冷备份，新版本失败自动恢复旧镜像和部署前数据库，成功或已恢复失败后只保留一个正式发布目录和一个固定备份。

本运行采用两阶段路线图：

- P-001：完成全部本地实现、状态化假远端故障验证、文档与实机交接清单。
- P-002：P-001 完成后，由用户执行或另行授权真实 iStoreOS 的正常部署与重复 no-op 验收，再完成 `change-0.md` 和有效需求快照。

## 2. 阶段状态

| 阶段 | 状态 | 计划 | 结果 |
| --- | --- | --- | --- |
| P-001 | completed | [phase-001-plan.md](phase-001-plan.md) | [phase-001-result.md](phase-001-result.md) |
| P-002 | in_progress | [phase-002-plan.md](phase-002-plan.md) | 尚未创建 |

P-001 已冻结完成；Q-006、Q-007 已由用户明确回答，P-002-T-001 已恢复为 `in_progress`。当前仍处于首次 SSH/SCP 前：先提交全部非敏感改动并建立同 SHA clean detached worktree，再完成只读实机基线和正常部署。

## 3. 当前检查点

- `workflow-contract.md` 为 schema `3.2`，路径与 frontmatter 声明一致。
- 需求审计通过：13 个规定章节、FR-001–FR-013、NFR-001–NFR-010、AC-001–AC-015 和决策记录齐全；无未决问题或占位符。
- 用户明确选择 `relaxed`；AC-001–AC-013、AC-015 为 core，AC-014 为 supplemental。
- 路线图修订 1 已创建，采用 `phased` + `expanded`：外部服务器授权边界形成独立 P-002，数据库/目录回滚和中断恢复形成 expanded 风险。
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
- P-002 详细计划修订 1 已创建，保留 `expanded` 风险级别；任务为 P-002-T-001 真实正常发布和 P-002-T-002 相同 SHA no-op/最终化。
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

当前工作区还有以下不属于本功能的既存改动，实施时必须保留：

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

## 5. 运行累计文件变化

| 文件 | 模式 | 状态 |
| --- | --- | --- |
| `requirements.md` | existing input | 澄清阶段已创建；当前需求权威 |
| `workflow-contract.md` | existing input | 澄清阶段已创建；schema 3.2 不可变契约 |
| `implementation-plan.md` | add | 路线图修订 1 |
| `execution/initial/phase-001-plan.md` | add | 已完成 P-001 的详细计划修订 1 |
| `execution/initial/execution-state.md` | add | 当前协调权威 |
| `deploy/deploy.ps1` | add | PowerShell 5.1 本地预检、no-op、Git HEAD 归档、SSH/SCP 编排与退出码 |
| `deploy/remote-deploy.sh` | add | POSIX 锁、构建、单备份、切换、健康、回滚、中断/遗留恢复和清理 |
| `deploy/deploy.config.example.psd1` | add | 无密码字段的本地配置示例 |
| `deploy/compose.yml` | modify | 镜像改为带 `0.1.0` 默认值的 `PARTY_IMAGE` 插值 |
| `.gitignore` | modify | 忽略实际部署配置与本地部署临时项 |
| `.dockerignore` | modify | 排除实际配置、发布标记和部署临时项 |
| `tests/deployment-automation.test.ts` | add | 临时 Git 仓库、受限假外部边界与 17 场景成功/故障矩阵 |
| `tests/fixtures/deployment-automation/fake-open-ssh.mjs` | add | 捕获 SSH/SCP 参数和上传物，不建立网络连接 |
| `tests/fixtures/deployment-automation/fake-docker.mjs` | add | 状态化 Compose/镜像/卷/数据库与故障注入 |
| `package.json` | modify | 增加分组且有界的 `test:deploy` 命令，避免长测试文件触发 worker RPC 超时 |
| `deploy/README.md` | modify | 自动部署配置、认证、单备份、幂等、自动/人工恢复、Git 历史与实机边界 |
| `README.md` | modify | 增加 Windows 单命令部署入口和本地/实机验收边界 |
| `execution/initial/phase-001-result.md` | add | 冻结 P-001 任务、文件、验证、恢复记录和 P-002 进入条件 |
| `execution/initial/phase-002-plan.md` | add | P-002 真实正常发布、相同 SHA no-op、外部授权、脱敏证据和最终化计划修订 1 |

现有应用源码与应用测试未由本阶段修改。`docs/requirements/poker-room-experience-upgrade/` 及既存 change-2 文件也保持用户所有，不属于本功能清单。

## 6. 测试与验证证据

已完成的规划证据：

- 完整读取并审计需求与工作流契约。
- 确认所有 FR/AC/NFR 均映射到 P-001/P-002 和 V-001–V-008。
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

当前无未决问题。

## 8. 发现项、偏差、风险与阻塞

- 当前无开放 `FND-I-*` 或计划偏差；下一个 finding ID 为 `FND-I-001`。
- P-001 的数据库备份/恢复、半交换目录、遗留锁、Compose 项目身份、命令注入和真实命令逃逸风险均已通过本地 hard gate。
- 初次长驻 Bash 夹具风险已通过同步前台夹具、子进程硬超时和五个短于 worker RPC 时限的测试组消除；最终两次完整运行都无 Bash 残留。
- 当前工作区尚未提交，但用户已授权把全部非忽略改动提交；真实配置已创建并通过忽略、键、路径和私钥存在性门禁。
- 剩余风险仅为假外部边界不能证明特定 iStoreOS 的 Docker、SSH、文件系统、权限和现有数据状态；该风险由 P-002 正常发布与重复 no-op 外部交接关闭。
- Q-006、Q-007 已解决；P-002-T-001 已恢复，仍未探测或改变服务器。提交候选或 clean detached worktree 若出现敏感文件、未知差异或 SHA 不一致，必须在 SSH 前重新暂停。

## 9. 精确恢复步骤

当前 P-002-T-001 在首次服务器副作用前 `in_progress`。中断恢复步骤：

1. 读取本状态和修订 2 的 [phase-002-plan.md](phase-002-plan.md)，确认 Q-006/Q-007 仍为 resolved，配置仍被忽略且不在 staged/committed 清单。
2. 若尚未提交，暂存全部非忽略改动，复核 staged 文件和敏感扫描后提交；不得 stash、reset、discard、push 或加入真实配置/私钥。
3. 记录新 full SHA，在本机临时目录创建该 SHA 的 clean detached worktree；主工作区允许仅有 P-002 后续检查点差异。
4. 先从 detached worktree 以 `BatchMode=yes` 等价只读方式验证 SSH 认证，再核对 iStoreOS 固定卷、目录、Docker/Compose、现有服务和脱敏基线；任一失败时在服务器写入前保存状态。
5. 全部门禁通过后，从同一 clean detached worktree执行 P-002-T-001 的一次正常部署；正常部署通过后才开始 P-002-T-002 的相同 SHA healthy no-op 和最终化。

不得修改本阶段结果，不得删除、还原或归属任何既存 change-2 与 `poker-room-experience-upgrade` 文件。

## 10. 最终完成门禁

- P-001 三个任务全部完成，所有本地 core 和 hard gate 通过，phase result 已冻结。
- P-002 按 [phase-002-plan.md](phase-002-plan.md) 完成真实正常发布和同 SHA no-op 交接；没有授权时不得连接服务器或伪造证据。
- 所有 AC-001–AC-013、AC-015 通过；AC-014 通过或形成证明无交付影响的合规 `FND-I-*`。
- 无未决问题、半完成远端状态、未知用户文件、凭据泄露或无法解释的验证失败。
- `change-0.md` 与 `effective-requirements.md` 只在 P-002 最终门禁通过后生成并与所有阶段证据一致。
