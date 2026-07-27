# P-001 阶段结果：本地部署自动化与确定性恢复验证

- 运行编号：`initial`
- 阶段编号：`P-001`
- 阶段计划：[phase-001-plan.md](phase-001-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:c775428ce2b0f419fcc098995591d4bbe84fb0a6a4b9b6e7372f6cb1fb511ae3`
- 路线图指纹：`sha256:992accdfc4dc4ee9faee11dbbaa4f40400a16fc386910f7af403069dbdcd4ddd`
- 开始基线：Git `f671f71c24a9f12473e58da13c01cc9e2002d8b7`；部署生产文件无既存差异，工作区含需保留的用户牌局 change-2 改动
- 完成基线：仍基于 Git `f671f71c24a9f12473e58da13c01cc9e2002d8b7` 的未提交工作区；本阶段未提交、推送或操作外部服务器
- 完成日期：`2026-07-28`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 阶段目标与结果

P-001 已交付完整的本地部署实现和不接触真实服务器的确定性证据：Windows PowerShell 5.1 单命令入口只发布干净、已提交的 Git `HEAD`；系统 OpenSSH 负责交互密码或独立私钥参数；远端 POSIX 状态机负责互斥锁、双重 no-op、SHA 镜像构建、停写冷备份、单正式目录切换、Docker health、镜像/目录/数据库一体回滚、信号与遗留状态恢复和精确清理。

Compose 只增加带原默认值的 `PARTY_IMAGE` 接口，保留 `home-table`、`linux/amd64`、端口、healthcheck 和固定命名卷 `home-party-game-platform-data`。运维文档已说明配置、认证、单备份覆盖、幂等、自动/人工恢复、Git 历史重发和实机交接边界。

本阶段没有运行 Docker、真实 SSH/SCP、iStoreOS healthcheck 或任何真实停服/备份/切换。真实正常发布和重复 healthy-SHA no-op 仍属于 P-002 的独立外部交接，不能由本结果替代。

## 2. 任务、需求与验收覆盖

| 任务 | 完成结果 | 主要文件 | 主要证据 |
| --- | --- | --- | --- |
| P-001-T-001 | 完成 | `deploy/deploy.ps1`、`deploy/remote-deploy.sh`、示例配置、Compose 与忽略规则 | PowerShell AST、POSIX `sh -n`、配置导入和安全命令扫描通过；缺失配置在远端调用前失败 |
| P-001-T-002 | 完成 | 部署测试、假 OpenSSH/Docker、`test:deploy` | 17/17 场景通过；覆盖成功、完整性、no-op/非 no-op、并发、备份、健康、回滚、TERM、强杀遗留与首次部署 |
| P-001-T-003 | 完成 | 两份 README、执行状态与本结果 | 文档责任完成；lint、typecheck、生产 build、部署定向测试和 diff check 全部通过 |

| 验收 | 层级 | P-001 通过证据 |
| --- | --- | --- |
| AC-001–AC-003 | core | 临时干净 Git 仓库执行真实 PowerShell；脏工作区零远端调用；HEAD 归档与失败退出传播；正常构建和构建失败顺序 |
| AC-004–AC-007 | core | 停服后备份、SQLite header/非空验证、固定备份原子替换、SHA 镜像、固定卷、单服务、单目录与数据库/镜像一体回滚断言 |
| AC-008 | core | 无私钥时系统 OpenSSH 交互路径；有私钥时只以独立 `-i` 参数传递；无密码字段、私钥内容或主机密钥绕过 |
| AC-009 | core | 活动 PID/启动标识锁拒绝；模拟强杀的 `new_started` 遗留状态恢复；TERM 停服阶段恢复 |
| AC-010–AC-011 | core | 成功及已恢复失败无 token 临时项；备份失败重启旧服务且上一备份字节保持 |
| AC-012 | core | 新健康失败自动恢复；旧健康失败和首次无旧镜像保留卷、固定备份、恢复锁及可诊断命令/状态；运维文档提供可执行人工清单 |
| AC-013 | core | 配置、密码/密钥、单命令、单备份、自动/人工恢复和 Git 历史重发文档完成 |
| AC-014 | supplemental | `preflight`、`upload`、`build`、`stop`、`backup`、`switch`、`health`、`rollback`、`cleanup` 日志点完整且安全扫描无敏感内容 |
| AC-015 | core | 本地和远端双重 healthy-SHA no-op；无 SCP/build/stop/backup/up，数据库与备份字节保持；相同 SHA 但镜像不匹配或不健康时不走 no-op |

P-001 负责的 FR-001–FR-013、NFR-001–NFR-010 和 AC-001–AC-015 实现与本地证据均完成。P-002 仍需补充路线图明确要求的真实 iStoreOS 正常路径和重复 no-op 外部证据。

## 3. 文件修改

| 文件 | 模式 | 结果 |
| --- | --- | --- |
| `deploy/deploy.ps1` | add | PowerShell 5.1 配置、预检、远端 no-op 探测、HEAD 归档、哈希、SSH/SCP 编排与退出码 |
| `deploy/remote-deploy.sh` | add | POSIX 锁、构建、单备份、切换、健康、回滚、中断/遗留恢复和安全清理 |
| `deploy/deploy.config.example.psd1` | add | 八个允许字段的无凭据示例 |
| `deploy/compose.yml` | modify | 镜像改为 `${PARTY_IMAGE:-home-party-game-platform:0.1.0}`；其余 Compose 契约保持 |
| `.gitignore`、`.dockerignore` | modify | 排除实际部署配置、发布标记和部署临时项 |
| `tests/deployment-automation.test.ts` | add | 临时 Git、真实生产脚本与 17 场景断言 |
| `tests/fixtures/deployment-automation/fake-open-ssh.mjs` | add | 捕获 SSH/SCP 参数和上传物，阻止网络逃逸 |
| `tests/fixtures/deployment-automation/fake-docker.mjs` | add | 状态化 Compose/镜像/卷/数据库与故障注入 |
| `package.json` | modify | 增加五个有界分组组成的 `test:deploy` |
| `deploy/README.md`、`README.md` | modify | 完整运维手册、单命令入口和本地/实机边界 |
| `implementation-plan.md`、`execution/initial/phase-001-plan.md`、`execution/initial/execution-state.md`、`execution/initial/phase-001-result.md` | add | 保存路线图、阶段计划、恢复状态和本阶段不可变结果 |

最终关键文件 SHA-256：

- `deploy/deploy.ps1`：`b6ec293536f9782ae6c3b956137678e18f6072157c8af49af87fdb70978f79fd`
- `deploy/remote-deploy.sh`：`aff3eb6f081b2297159125e8c549cd0619a8ec106acabb4b9158f04bc97a5265`
- `tests/deployment-automation.test.ts`：`c34e386463f2cd5543e22a02c406954eb0cf62ad1ec92192feff1fa6bc958ce2`
- `tests/fixtures/deployment-automation/fake-open-ssh.mjs`：`d8721846bf616949197589f43f7680c50d76d4cef9f955d2f36ab18cbaf9982c`
- `tests/fixtures/deployment-automation/fake-docker.mjs`：`c573b5792979196a7a19e896142c84c34456418aa521c2d1521594cd127de30f`
- `deploy/README.md`：`860382ca9aac8993a863f1814a0cf641ab7ad5f34166cbdda3094d8661395173`

## 4. 测试与验证

| 验证 | 观察结果 |
| --- | --- |
| `npm run test:deploy` | 通过，17/17；五组约 9、38、36、45、21 秒，总计约 155 秒，返回 0 |
| `npm run lint` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run build` | 通过；Vite Web、tsup Server 和静态资源无外链检查完成 |
| PowerShell AST | `deploy/deploy.ps1` 解析通过 |
| Git Bash `sh -n` | `deploy/remote-deploy.sh` 解析通过 |
| 示例配置导入 | 通过；只有 `SshHost`、`SshUser`、`SshPort`、`IdentityFile`、`RemoteReleaseDir`、`RemoteBackupDir`、`PartyPort`、`HealthTimeoutSeconds` |
| 安全扫描 | 无 `sshpass`、`StrictHostKeyChecking=no`、密码配置字段、私钥标记、Compose/卷删除命令 |
| `git diff --check` | 通过 |
| 进程收敛 | 最终测试后没有 Bash 进程 |
| 外部边界 | 未运行 Docker、真实 SSH/SCP、服务器 healthcheck 或 iStoreOS 操作 |

npm 在当前受限环境中尝试清理用户级日志目录时打印 `EPERM` warning，但所有上述 npm 命令按其实际门禁结果返回 0；该 warning 不涉及项目文件、测试断言或交付运行时。

## 5. 发现项与处置

无开放 `FND-I-*`。验证结论为 `passed`，下一个可分配编号仍为 `FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 功能影响 | 处置 | 置信度 | 后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无报告项 | 无 | — | 高 | — |

## 6. 偏差、故障发现与恢复记录

- 首次完整测试中，活动锁夹具使用长驻 Git Bash 循环；Windows 只终止父进程后留下孤立 PID 38664，用户中止测试并最终手动结束该 PID。夹具已改为同步前台自持锁，后续分段与两次完整运行均无 Bash 残留。
- 11 场景单文件运行曾全部断言通过，但因单个 worker 约 92 秒未上报任务更新触发 Vitest RPC 超时并返回 1。`test:deploy` 按行为拆成五个失败短路的独立进程，每组低于 60 秒，最终 17 场景两次完整运行均返回 0。
- 新增完整性门禁发现远端脚本在取得锁前发生脚本哈希错误时不会清理上传目录。生产状态机增加 `PATHS_READY`：只有 token、路径和上传/脚本精确关系全部验证后，退出陷阱才可按 token 清理；定向和完整回归通过。
- TERM 最初由 Node 使用 Windows PID 发送，未映射到 Git Bash POSIX 父进程。夹具改为由同步 POSIX 假 Docker 包装层向精确 `$PPID` 发信号，真实远端 trap 返回 130 并恢复旧服务。
- 并行门禁首次只可靠返回 typecheck 错误；修复测试参数的严格类型保护后，lint、typecheck 和 build 分别独立重跑并通过，未把未观察结果误记为通过。
- 所有既存牌局 change-2 代码、测试与工作流文件保持用户所有；本阶段没有还原、覆盖或归属这些差异。

## 7. 遗留风险与 P-002 进入条件

P-001 没有本地阻塞、未决问题或开放 finding。保留的风险是本地假外部边界不能证明某台 iStoreOS 的 Docker、文件系统、SSH、权限和现有数据状态；路线图已将该差异限定为 P-002 外部交接。

进入 P-002 前必须：

1. 由用户整理并提交当前工作区，使待发布 `HEAD` 完全干净；当前既有牌局改动和本功能改动如何提交仍由用户决定。
2. 从示例创建 Git 忽略的 `deploy/deploy.config.psd1`，填写真实 LAN 主机、用户、分离的发布/备份目录、端口及可选私钥路径；不得把配置或凭据加入 Git。
3. 确认 iStoreOS 固定卷 `home-party-game-platform-data` 存在，两个目录的父目录可写，并准备维护窗口。
4. 由用户执行或另行明确授权一次真实正常发布，核对 SHA 镜像、healthy、固定卷、一个正式目录和一个固定备份。
5. 不修改本地工作区再次运行，核对返回 0 的 no-op，并比较容器 ID、备份时间/哈希与动态数据库内容均未被重置。
6. 只保存非敏感命令结果；不默认制造健康失败、数据库损坏或破坏性实机回滚。

下一步必须另行调用 `$plan-feature-implementation`，根据本结果只规划 P-002。不得在本次实现调用中创建 P-002 计划或执行服务器操作。
