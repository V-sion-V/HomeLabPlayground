# initial / P-001 阶段计划

- 运行编号：`initial`
- 阶段编号：`P-001`
- 计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:c775428ce2b0f419fcc098995591d4bbe84fb0a6a4b9b6e7372f6cb1fb511ae3`
- 路线图指纹：`sha256:992accdfc4dc4ee9faee11dbbaa4f40400a16fc386910f7af403069dbdcd4ddd`
- 项目基线：Git `f671f71c24a9f12473e58da13c01cc9e2002d8b7`；部署生产文件无既存差异，牌局 change-2 改动为需保留的既存工作
- 创建日期：`2026-07-27`
- 详细程度：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

P-001 交付可提交的完整自动化部署实现：Windows PowerShell 5.1 单命令入口、忽略的本地配置、只发布 Git `HEAD`、远端 POSIX 状态机、SHA 镜像、构建期间旧服务在线、单文件冷备份、安全切换、健康检查、自动数据库与镜像回滚、同 SHA no-op、锁/中断恢复、文档与不接触真实服务器的确定性验证。

本阶段覆盖 FR-001–FR-013、NFR-001–NFR-010 和 AC-001–AC-015 的实现与本地证据。AC-001–AC-013、AC-015 以及凭据、数据、恢复、兼容、构建硬门禁全部阻塞；AC-014 是唯一 supplemental 项，只能在独立证明不影响交付行为时形成 `FND-I-*`。

本阶段明确不做：

- 不连接用户 iStoreOS，不调用真实 SSH/SCP 目标，不上传源码。
- 不运行 Docker 或 `test:docker-smoke`。
- 不执行真实停服、备份、目录切换或回滚。
- 不改动现有德州扑克 change-2 所有文件。
- 不生成 P-002 详细计划、`change-0.md` 或有效需求快照。

阶段结束时项目必须可构建，部署逻辑必须在状态化假外部边界中执行并通过全部 core 场景，同时形成足够明确的 P-002 实机正常发布/no-op 交接清单。

## 2. 任务与文件范围

### 2.1 前置条件与文件所有权

开始生产编辑前：

1. 重新读取本状态与当前计划，确认 P-001 仍为唯一 `ready` 阶段。
2. 检查 Git 基线和预期文件差异；若任何预期部署文件出现非本功能既存修改，暂停并记录重叠。
3. 把执行状态、P-001 和 `P-001-T-001` 标记为 `in_progress`，记录实际起始差异和完成条件。
4. 不运行部署入口连接任何真实主机；所有执行测试必须通过临时 PATH 和假 `ssh`/`scp` 的防逃逸保护。

| 文件或范围 | 模式 | 所有权与目的 |
| --- | --- | --- |
| `deploy/deploy.ps1` | add | 本地 PowerShell 5.1 编排器、配置/参数、本地预检、no-op 探测、Git 归档、SSH/SCP 调用、日志和退出码 |
| `deploy/remote-deploy.sh` | add | POSIX 远端锁、权威复核、构建、备份、切换、健康、回滚、遗留状态恢复与清理 |
| `deploy/deploy.config.example.psd1` | add | 不含真实地址、密码或私钥内容的配置模板 |
| `deploy/compose.yml` | modify | 仅增加带现有默认值的 `PARTY_IMAGE` 插值；保持服务、端口、构建、healthcheck 和卷 |
| `.gitignore` | modify | 忽略 `deploy/deploy.config.psd1` 及明确的本地部署临时输出 |
| `.dockerignore` | modify | 排除实际部署配置、发布标记和部署临时输出，避免进入构建上下文 |
| `tests/deployment-automation.test.ts` | add | 编排 PowerShell/Git Bash、临时 Git 仓库、假 SSH/SCP/Docker 和故障场景 |
| `tests/fixtures/deployment-automation/**` | add only if needed | 仅放不可合理内联的确定性假命令；不得含主机、凭据、数据库或真实路径 |
| `package.json` | modify | 增加独立 `test:deploy` 命令，不改变现有应用测试语义 |
| `deploy/README.md` | modify | 一键配置/部署、单备份、自动回滚、历史版本和人工恢复 |
| `README.md` | modify | 增加自动部署入口和真实服务器交接边界 |

不得修改 Dockerfile、应用源码、现有应用测试或 `docs/requirements/home-party-game-platform/**`。若实现事实证明必须扩大范围，先更新执行状态并暂停，不在本阶段自行扩张。

### 2.2 任务

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-001-T-001 | 生产部署状态机与兼容接口完成 | `deploy/deploy.ps1`、`deploy/remote-deploy.sh`、`deploy/deploy.config.example.psd1`、`deploy/compose.yml`、`.gitignore`、`.dockerignore` | 先实现 PowerShell 配置/HEAD/no-op/上传编排，再实现 POSIX 锁、阶段日志、构建、原子备份、目录交换、健康、回滚和信号/遗留恢复；Compose 只暴露 `PARTY_IMAGE` | PowerShell AST 解析、POSIX `sh -n`、示例配置可导入、静态检查无密码字段/禁用主机密钥/卷删除命令；不连接外部 | 接口可被假边界执行，所有路径和 token 清理都有精确作用域，现有 Compose 默认人工启动仍成立，未触碰用户牌局文件 |
| P-001-T-002 | 本地确定性成功与故障矩阵通过 | `tests/deployment-automation.test.ts`、可选 `tests/fixtures/deployment-automation/**`、`package.json` | 在临时干净 Git 仓库执行真实 PowerShell；用假 SSH/SCP 捕获零副作用和认证参数；用 Git Bash + 状态化假 Docker 执行真实远端脚本，覆盖正常、no-op、竞态锁、中断、备份/健康/回滚故障 | `npm run test:deploy`；失败时只运行对应定向用例诊断，不运行 Docker | 所有 core 场景断言退出码、调用顺序、镜像/目录/备份/数据库/卷/锁最终状态；真实 OpenSSH/Docker 防逃逸断言通过 |
| P-001-T-003 | 运维文档、本地硬门禁与实机交接包完成 | `deploy/README.md`、`README.md`、P-001 工作流状态/结果 | 写明配置、密码/密钥、命令、幂等、单备份覆盖、自动/人工恢复和 Git 历史发布；运行最晚一次本地验证并记录 P-002 交接输入/观察项 | `npm run test:deploy`、`npm run lint`、`npm run typecheck`、`npm run build`、`git diff --check`；明确记录 Docker/真实 SSH 未运行 | 全部 P-001 core 与硬门禁通过，AC-014 通过或形成合规 finding，工作区只有解释过的本功能与既存用户差异，P-001 结果可冻结 |

依赖顺序：`P-001-T-001 -> P-001-T-002 -> P-001-T-003`。`relaxed` 允许先实现再添加测试；任何任务结束前必须先更新执行状态、记录实际文件与验证，再选择下一任务。

### 2.3 生产接口与有序实现

本地配置字段固定为 `SshHost`、`SshUser`、`SshPort`、`IdentityFile`、`RemoteReleaseDir`、`RemoteBackupDir`、`PartyPort`、`HealthTimeoutSeconds`。显式 PowerShell 参数覆盖配置；密码不是字段。

本地编排顺序：

1. 解析/验证配置与原生命令。
2. 验证工作区完全干净并读取 full SHA。
3. 通过短远端锁探测 `.release-sha`、当前镜像和 health；完全匹配则 no-op 返回。
4. 用 `git archive HEAD` 和 `git show HEAD:deploy/remote-deploy.sh` 生成本地临时交付物与哈希。
5. 创建远端 token 临时上传目录，SCP 上传归档和来自 HEAD 的远端脚本。
6. SSH 执行上传脚本；由它获取长锁并权威复核 no-op 后继续。
7. 传播远端退出码并在 `finally` 清理本地临时项。

远端状态顺序：

`locked -> verified -> built -> stopped -> backed_up -> directories_swapped -> new_started -> healthy -> committed/cleaned`

失败恢复分支：

- `locked/verified/built`：清理当前 token 临时项，旧服务与备份不变。
- `stopped`：重新启动旧服务并验证健康。
- `backed_up/directories_swapped/new_started`：停止新服务，恢复 previous/旧镜像，使用固定备份恢复数据库并删除 WAL/SHM，启动旧服务并验证健康。
- 回滚健康失败：停止继续修改，保留卷、备份、旧镜像引用和必要目录/日志，输出精确人工恢复步骤并非 0 退出。

锁的阶段日志必须在每个外部副作用前后更新；自动清理遗留锁前必须用 PID 与进程启动标识证明原持有者已失效，并按已记录阶段先恢复安全状态。

## 3. 验证与完成条件

### 3.1 本地场景矩阵

| 门禁 | 层级 | 必须观察的证据 |
| --- | --- | --- |
| G-P1-001 本地零副作用预检 | hard gate | 脏工作区、未跟踪文件、无效配置或工具缺失在任何 SSH/SCP/远端写入前非 0 退出 |
| G-P1-002 凭据与命令安全 | hard gate | 私钥只以独立 `-i` 参数传递；无密钥时允许交互；不出现密码字段、`sshpass`、`StrictHostKeyChecking=no`、命令注入或敏感日志 |
| G-P1-003 源码完整性 | core | 归档和上传脚本都来自提交 `HEAD`；哈希错误不解包/构建；本地配置、`.git`、依赖和构建结果不进入归档 |
| G-P1-004 构建前可用性 | core | 假远端调用日志证明上传、校验和 build 完成前没有 stop、备份或正式目录替换；构建失败保持旧状态 |
| G-P1-005 单备份与停写 | data hard gate | stop 发生在复制前；临时备份非空且 SQLite header 合法后才原子覆盖；失败重启旧服务且上一备份哈希不变 |
| G-P1-006 切换与空间上界 | data hard gate | 只使用一个 Compose 服务/固定卷；成功后只有一个正式目录、固定备份和当前 SHA 镜像，无 token 目录/归档/锁/回滚标签 |
| G-P1-007 自动回滚 | recovery hard gate | 新健康失败恢复旧目录/镜像和部署前数据库，删除 WAL/SHM，旧服务 healthy，命令仍非 0；回滚失败保留恢复资产并打印人工命令 |
| G-P1-008 锁与中断 | recovery hard gate | 有效锁拒绝；失效锁按阶段安全接管；INT/TERM 与模拟强杀恢复或保留可诊断状态，不留下永久无主锁 |
| G-P1-009 幂等 no-op | core | 同 SHA + 匹配镜像 + healthy 返回 0；没有 archive/SCP/build/stop/backup/swap/up；容器、备份和业务数据库指纹保持 |
| G-P1-010 非 no-op 判定 | core | 相同 SHA 但镜像不匹配或不健康时不得快返回，必须进入正常部署/恢复分支 |
| G-P1-011 首次与人工恢复边界 | core | 无旧镜像时失败保留卷/备份并说明无法自动恢复；无有效数据库备份时拒绝切换 |
| G-P1-012 项目可交付性 | hard gate | 部署定向测试、lint、typecheck、生产 build 和 diff check 通过；不需要 Docker 或真实服务器 |
| AC-014 阶段日志 | supplemental | 日志可区分预检、上传、构建、停止、备份、切换、健康、回滚、清理且无敏感内容 |

### 3.2 完成判定

P-001 只有在以下条件全部满足时才可创建 `phase-001-result.md`：

- FR-001–FR-013 的代码或文档责任均有实际文件和验证证据。
- AC-001–AC-013、AC-015 及 G-P1-001–G-P1-012 全部通过。
- 没有真实 SSH/SCP/Docker 调用，没有服务器配置或凭据进入仓库/日志。
- `deploy/compose.yml` 的默认人工启动、服务名、端口、healthcheck 和固定卷未被破坏。
- 所有既存 change-2 文件保持用户所有且没有被恢复、覆盖或混入本功能结论。
- 若 AC-014 有异常，必须证明无交付影响并以 `FND-I-001` 起记录完整 finding；否则结论为 `passed`。
- 执行状态完整记录任务检查点、实际文件、命令与观察结果，然后设置 `awaiting_next_phase`；不得在同一实现调用中创建 P-002 计划。

## 4. 风险、恢复与修订记录

### 4.1 实施中恢复

- 任一任务开始前先写状态；中断时保持该任务 `in_progress`，记录最后完成的文件、最近验证和下一条命令。
- P-001 只产生本地可恢复文件。不得用 `git checkout`、`git reset` 或批量删除恢复；对本功能文件使用精确补丁，并保留所有既存用户差异。
- 临时测试仓库、假远端和假卷必须位于测试创建的唯一临时目录；测试 `finally` 只删除已解析且位于该目录下的路径。
- 假 SSH/SCP 必须写入哨兵日志；若真实命令路径被解析或出现网络提示，立即停止测试并把 P-001 保持 `in_progress`。
- 如果 PowerShell 5.1 原生参数传递无法安全支持某配置值，优先收紧并记录可测试的路径验证，不改为拼接 shell 或保存密码。
- 如果 POSIX 基本工具在 Git Bash 与 iStoreOS 能力不同，保持 POSIX 子集并把真实差异列入 P-002 观察项；影响 core 恢复语义时阻塞，不作为 supplemental 放行。

### 4.2 阶段退出后的恢复

P-001 结果冻结后，下一次 `$plan-feature-implementation` 必须读取该结果、当前差异和路线图，再仅创建 P-002 计划。P-002 没有用户提供的干净提交、配置或授权时保持未激活，不修改真实服务器。

### 4.3 修订记录

| 修订 | 日期 | 结论与原因 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-27 | 首次创建 expanded P-001；使用三个有序任务先实现、再故障模拟、最后文档与本地门禁 | 覆盖全部需求的本地实现与证据；真实正常/no-op 留给路线图 P-002 |
