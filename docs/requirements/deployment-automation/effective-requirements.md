# 家庭聚会游戏平台：部署自动化当前有效需求

- 派生状态：可重新生成
- 原始需求：[requirements.md](requirements.md)
- 已应用至修改记录：[change-0.md](change-0.md)
- 生成日期：`2026-07-28`

## 1. 当前目标与范围

维护者可从Windows工作站以一个PowerShell命令，把干净且已提交的Git `HEAD`发布到家庭LAN中的x86-64 iStoreOS。流程使用系统OpenSSH，远端构建SHA镜像，停止受管服务后冷备份SQLite，原子切换唯一正式目录，等待Docker health，并在已有受管旧版本时把应用和部署前数据库一体自动恢复。

当前范围包含本地/远端预检、互斥、Git归档与哈希、远端构建、固定单备份、固定命名卷、幂等no-op、健康检查、自动/人工恢复、诊断和文档。首次接管前由维护者保留的旧Docker/旧目录不在自动化管理范围。

当前不包含CI/CD、registry、云构建、多服务器、零停机、长期发布历史、多备份、自动创建SSH身份、修改防火墙/路由、升级宿主软件或数据库模式向下兼容推断。

## 2. 当前生效需求

| 当前编号 | 当前生效内容 | 验收与层级 | 来源 |
| --- | --- | --- | --- |
| FR-001–FR-003 | 提供Windows PowerShell单命令入口；配置主机、用户、SSH端口、可选私钥、正式目录、备份目录、服务端口和健康超时，密码不是字段；只发布干净已提交HEAD，归档不含Git、配置、依赖、构建和未提交文件。 | AC-001–AC-003、AC-008 core | `requirements.md`→`change-0.md` |
| FR-004 | 远端预检Docker/Compose、路径、固定卷和受管状态；部署互斥。SHA、标记、镜像和healthy一致时本地fast path成功no-op，零上传/构建/停服/备份/重建。 | AC-002、AC-009、AC-015 core | `requirements.md`→`change-0.md` |
| FR-005 | 归档在临时位置校验/解包，镜像使用完整SHA标签；已有受管版本时构建期间旧服务保持运行，构建失败不改备份/正式目录。 | AC-001、AC-003、AC-005 core | `requirements.md`→`change-0.md` |
| FR-006 | 切换前停止受管写入并冷备份`/data/platform.sqlite`；临时文件验证后原子覆盖唯一固定备份，失败重启旧服务且不破坏上一备份。 | AC-004、AC-011 core | `requirements.md`→`change-0.md` |
| FR-007–FR-008 | 保存旧镜像临时引用，原子切换唯一正式目录，以新SHA重建同一`home-table`并复用端口/固定卷；等待有界Docker health，成功后清理临时状态。 | AC-005、AC-007、AC-010 core；AC-014 supplemental | `requirements.md`→`change-0.md` |
| FR-009 | 已有受管旧版本时，新服务启动/健康/切换失败必须停止新服务，恢复旧应用、部署前数据库并清理WAL/SHM，旧服务healthy后以非0报告已恢复失败；恢复失败保留现场和人工步骤。首次接管无旧版本时恢复数据库、停止新服务并保留诊断。 | AC-006、AC-007、AC-012 core | `requirements.md`→`change-0.md` |
| FR-010 | 正常或已恢复失败后，自动化范围永久只有一个正式目录、一个固定备份和当前镜像，无锁、临时目录或rollback标签；历史源码来自Git。 | AC-010 core | `requirements.md`→`change-0.md` |
| FR-011 | 使用系统OpenSSH，兼容私钥和终端交互密码；不得保存/回显密码、读取私钥内容、引入sshpass或禁用主机密钥校验。 | AC-008 core | `requirements.md`→`change-0.md` |
| FR-012–FR-013 | 输出preflight/upload/build/stop/backup/switch/health/rollback/cleanup阶段和安全恢复建议；文档覆盖配置、认证、命令、单备份、自动/人工恢复与Git历史重发。 | AC-012–AC-014 core/supplemental | `requirements.md`→`change-0.md` |

## 3. 当前流程

1. 维护者提交变更、保持工作区干净并准备Git忽略的本地配置。
2. 部署入口校验本地工具、配置和HEAD，再以安全SSH短探测判断healthy-SHA no-op。
3. 非no-op只归档HEAD，上传后校验；远端取得互斥锁，在临时目录构建SHA镜像。
4. 构建成功后停止可识别受管服务，生成并原子覆盖唯一SQLite冷备份。
5. 保存旧镜像临时引用，交换唯一正式目录，以相同Compose项目/服务/卷启动新镜像。
6. 新服务healthy则写发布标记并清理；失败则恢复旧目录/镜像和部署前数据库，重启旧服务后以非0结束。
7. 首次接管无旧版本时不探测外部旧Docker；失败只恢复数据库、停止新服务并保留诊断。
8. 历史版本通过检出目标Git提交后再次运行同一入口发布。

## 4. 当前数据、接口与状态

- 本地配置：八个允许字段，文件被Git与Docker构建上下文忽略。
- 发布来源：干净HEAD归档、归档SHA-256、完整Git SHA和对应镜像标签。
- 正式状态：唯一正式目录、`.release-sha`、Compose `home-table`、固定卷`home-party-game-platform-data`。
- 数据保护：卷内`platform.sqlite`与备份目录内唯一`platform.sqlite.backup`；备份临时文件验证后原子替换。
- 恢复状态：token化锁、阶段、incoming/previous/failed目录和临时rollback镜像，仅在部署期间存在。
- 接口：本地PowerShell调用Git/SSH/SCP；远端POSIX shell调用Docker、Compose和文件系统；不新增业务API或数据库表。

## 5. 当前异常、安全与恢复

- 脏工作区、无效配置、工具/认证/主机密钥/远端预检失败在业务变更前拒绝。
- 上传、校验或构建失败时旧服务和固定备份不变；停服后备份失败时重启旧服务。
- 有效锁拒绝并发；遗留锁只能在PID/启动标识失效且按记录阶段安全恢复后接管。
- 相同SHA但镜像、标记或health不匹配时不得no-op。
- 新健康失败恢复旧镜像、正式目录、部署前数据库并删除不一致WAL/SHM；旧健康恢复失败时停止自动修改并保留卷、备份、锁/目录和人工步骤。
- 正常和已恢复失败都不得删除、重建、重命名或匿名替换固定卷，不得执行`docker compose down -v`。
- 配置目录之外的旧Docker/旧目录、其他容器和宿主网络/路由/系统服务不在管理范围。
- 日志不得包含密码、私钥、数据库内容或其他敏感信息。

## 6. 当前非功能要求

- **NFR-001 数据安全**：任何自动路径不删除卷；切换前有本次有效冷备份。
- **NFR-002 凭据安全**：不保存密码/私钥内容，保留SSH主机密钥校验。
- **NFR-003 可恢复性**：受管旧版本下应用与部署前数据库一体恢复；首次接管无旧版本时恢复数据库并进入可诊断人工状态。
- **NFR-004 可追踪性**：镜像、标记和发布映射唯一完整Git SHA。
- **NFR-005 幂等与并发**：healthy-SHA重复命令成功且零上传/构建/备份/重启；部署互斥且不重置动态业务数据。
- **NFR-006 空间上界**：正常/已恢复失败只留单正式目录、单备份和当前镜像。
- **NFR-007 可观察性**：阶段、结果、health和恢复建议清晰且脱敏。
- **NFR-008 兼容性**：本地兼容Windows PowerShell 5.1；远端只依赖POSIX shell、iStoreOS Docker与Compose。
- **NFR-009 停机时间**：已有受管版本时上传/构建期间旧服务运行，停机只覆盖冷备份与切换。
- **NFR-010 离线边界**：目标应用运行不依赖公网；部署不要求registry。

## 7. 当前验收要求

| 验收 | 层级 | 当前可观察结果 |
| --- | --- | --- |
| AC-001 | core | 一个PowerShell命令发布干净HEAD，远端构建、备份、切换和health成功后退出0。 |
| AC-002 | core | 脏工作区、无效配置或依赖缺失在停服/备份前非0拒绝。 |
| AC-003 | core | 上传/构建失败不改变旧服务、正式目录或唯一备份；首次接管不碰外部旧Docker。 |
| AC-004 | core | 每次切换前产生有效冷备份，验证后原子覆盖，目录永久只有一份。 |
| AC-005 | core | 成功版本使用SHA镜像、原端口和固定卷并healthy，只留一个正式目录。 |
| AC-006 | core | 新启动/健康失败自动恢复旧镜像和部署前数据库，旧服务healthy，命令明确非0。 |
| AC-007 | core | 正常与失败路径不删除/替换固定卷，不创建第二套服务或匿名卷。 |
| AC-008 | core | 私钥/交互密码可用，密码和私钥内容不进入配置/参数/日志，主机密钥校验保持。 |
| AC-009 | core | 并发锁拒绝有效部署；遗留锁有安全、可诊断恢复。 |
| AC-010 | core | 成功或已恢复失败只留单目录、单备份、当前镜像，无临时源码/目录/锁/标签。 |
| AC-011 | core | 冷备份失败时旧服务恢复healthy，上一备份不破坏且不切换。 |
| AC-012 | core | 自动回滚失败或首次无旧版本时停止继续修改，保留卷/备份并输出人工步骤。 |
| AC-013 | core | 文档足以配置认证、部署、理解单备份/自动恢复并从Git历史重发。 |
| AC-014 | supplemental | 阶段日志覆盖关键耗时和结果且无敏感内容。 |
| AC-015 | core | healthy-SHA重复运行本地fast path退出0，零上传/构建/停服/备份/覆盖/重建，业务数据不回退。 |

## 8. 当前验证与来源

- P-001：[phase-001-result.md](execution/initial/phase-001-result.md)——真实生产脚本加假外部边界的完整故障矩阵、静态/构建/文档门禁。
- P-002：[phase-002-result.md](execution/initial/phase-002-result.md)——真实首次接管、边界纠正、受管更新和零上传no-op。
- P-003：[phase-003-result.md](execution/initial/phase-003-result.md)——真实候选健康失败、应用/数据库自动回滚和最终清理。
- 当前没有开放finding或未决问题；后续变化必须通过新的`change-N`运行。
