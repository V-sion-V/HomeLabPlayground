# P-002 阶段结果：真实接管、边界纠正与零上传 no-op

- 运行编号：`initial`
- 阶段编号：`P-002`
- 阶段计划：[phase-002-plan.md](phase-002-plan.md)
- 阶段计划修订：`5`
- 父路线图修订：`3`
- 需求指纹：`sha256:b63b2a82a7fa098d45a4354c3844071c2e1d53c4925f7026984e4791ca1a6ec3`
- 路线图指纹：`sha256:fe86edbd0e8a56f9d62cc6e87bd005b4229934afaccada49e9e77d8b670aa6b8`
- 开始基线：Git `f049a7c6e2524ffa9da670ab6629ad2f9e7fd466`；配置正式目录尚未由自动化接管，固定卷停写，旧 Docker/旧目录由用户持有且不在操作范围
- 完成基线：Git `1d049a55ad3432bb1260fe2ddd1ac5f3ca85d6ea`；配置正式目录中的唯一受管服务 healthy，固定卷、唯一有效备份、唯一正式目录和无临时状态均通过独立核对
- 完成日期：`2026-07-28`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 阶段目标与结果

P-002 已完成真实 iStoreOS 外部交接，并保留三段可追踪证据：

1. `f049a7c6...` 从新的配置发布目录首次接管固定数据卷，完成远端构建、冷备份、正式目录创建、SHA 镜像启动、Docker health和清理；旧 Docker/旧目录始终未被识别或修改。
2. 首次接管后的同 SHA 命令暴露真实 Windows PowerShell 5.1/OpenSSH 参数封送问题：`printf "NOOP\n"` 到达远端后表现为 `NOOPn`，本地误入归档/上传，但远端权威 no-op 保持服务器状态完全不变。该 core 缺陷没有被当作通过或 report-only finding。
3. `1d049a55...` 修复短 token，并让 Docker build 使用官方 Node 镜像内置 `/usr/local/include/node`；新 SHA 受管更新成功，紧随其后的同 SHA 命令由本地快速探测直接以精确三行 preflight/health 返回 0，零归档、零 SCP、零远端状态机，前后容器、镜像、卷、备份、正式目录与数据库状态完全相等。

当前服务运行新 full SHA 对应镜像，恰好一个 `home-table` 服务 running/healthy且为非 root，对外 `/healthz` 返回 200，`/data` 仍挂载 `home-party-game-platform-data`。自动化范围只有一个正式目录和一个有效固定备份，无锁、upload/incoming/previous/failed、备份临时项或 rollback 标签。

本阶段没有执行破坏性健康失败、数据库损坏或实机回滚演练。P-003 按用户决定继续保留该独立外部验收，并负责 initial 最终化。

## 2. 任务、需求与验收覆盖

| 任务 | 完成结果 | 主要证据 |
| --- | --- | --- |
| P-002-T-001 | completed | 旧 SHA 首次接管成功；SHA 镜像、固定卷、冷备份、单目录、容器/外部 health和无临时项均通过；旧 Docker/旧目录隔离 |
| P-002-T-002 | completed | 短 token 与 Node 本地头文件修复；新增原生 Windows `.exe` 参数边界回归；`test:deploy` 19/19及全部本地 hard gate通过；形成新提交与 clean detached worktree |
| P-002-T-003 | completed | 新 SHA build-before-stop、冷备份、切换和 health通过；构建无 `gyp http GET`；同 SHA 第二次命令本地零上传 no-op，前后状态相等 |

| 门禁/验收 | 层级 | P-002 通过证据 |
| --- | --- | --- |
| G-P2-001 来源、配置与授权 | hard gate | 新提交只含 7 个计划内非敏感 tracked 文件；detached worktree clean；真实配置忽略未跟踪；非交互 SSH、需求/路线图指纹和授权有效 |
| G-P2-002 首次接管隔离 | data hard gate | 首次接管时固定卷无写入者，配置正式目录不存在；旧 Docker/旧目录未进入检查或操作范围；失败尝试均在备份/切换前安全恢复 |
| G-P2-003 纠正实现与本地回归 | build/compatibility hard gate | PowerShell 5.1 原生 `.exe` 边界保留精确 `NOOP`/`DEPLOY`；Dockerfile 在 `npm ci` 前设置本地头文件；19/19部署场景和全部静态/构建门禁通过 |
| G-P2-004 新 SHA 正常更新与健康 | core | 生产入口完整成功日志；Docker 事件证明新镜像创建完成后才停止旧服务；新 SHA 标记/镜像、唯一服务、Docker health和外部 200通过 |
| G-P2-005 数据、卷与空间上界 | data hard gate | 切换前冷备份有效；数据库与备份 SHA-256保持；固定卷和 `/data` 挂载不变；单备份、单目录、无锁/临时项/rollback标签 |
| G-P2-006 零上传 no-op 与状态相等 | core/data hard gate | 实际命令退出 0且只有两行本地 `[PREFLIGHT]` 和一行本地 `[HEALTH]`；没有归档、SCP、远端状态机或部署阶段；结构/数据库/备份指纹与 mtime逐字不变 |
| G-P2-007 阶段证据完整性 | hard gate | P-001 冻结结果未改；首次接管、失败恢复、根因、纠正提交、新 SHA 更新/no-op连续可追踪；无敏感证据、未知失败或半完成远端状态 |
| AC-014 阶段日志 | supplemental | 正常更新日志覆盖 preflight、upload、build、stop、backup、switch、health、cleanup；no-op 只显示本地 preflight/health；脱敏检查通过 |

P-002 关联的 FR-001、FR-004–FR-008、FR-010–FR-013、NFR-001–NFR-010 与 AC-001、AC-004、AC-005、AC-007–AC-010、AC-012–AC-015 均获得本阶段要求的真实边界证据。FR-009/AC-006 的实机回滚证据仍由 P-003负责；P-001 的确定性故障矩阵继续作为当前自动恢复实现的阻塞证据。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `Dockerfile` | modify | 构建阶段设置 `npm_config_nodedir=/usr/local`，让原生依赖使用基础镜像内置 Node 头文件 |
| `deploy/deploy.ps1` | modify | 短探测使用无内嵌引号、无转义换行的固定 `NOOP`/`DEPLOY` 输出 |
| `tests/deployment-automation.test.ts` | modify | 增加原生 Windows 参数捕获回归和 Dockerfile 头文件顺序断言；完整矩阵扩展为 19 场景 |
| `requirements.md` | modify | pre-freeze 修订 1：明确新目录首次接管、旧 Docker 外部边界与延后实机回滚 |
| `implementation-plan.md` | add | 路线图修订 3：组合首次接管与纠正后新 SHA 更新/no-op证据，保留 P-003 |
| `execution/initial/phase-002-plan.md` | add | 修订 5：保留 T-001，增加 T-002 纠正/提交与 T-003 新 SHA 外部验证 |
| `execution/initial/execution-state.md` | add | 保存本地、提交、外部副作用、恢复、指纹和阶段关闭检查点 |
| `execution/initial/phase-002-result.md` | add | 冻结本阶段任务、门禁、验证、偏差和 P-003 进入条件 |

纠正后关键文件 SHA-256：

- `deploy/deploy.ps1`：`1faf83b47baa5968af2f306376fe7347369bae1c6dc40586839a9bf0c80f4ec0`
- `Dockerfile`：`2e800cb858d252b681f5d618f9fb553d23d5f34c40aaad52d0fe86fb351b103f`
- `tests/deployment-automation.test.ts`：`353c491e6e73dea55a6dc65a158ad4aacf8648685df65b6d337297db88639b96`
- 未改动的 `deploy/remote-deploy.sh`：`aff3eb6f081b2297159125e8c549cd0619a8ec106acabb4b9158f04bc97a5265`
- 未改动的 `fake-open-ssh.mjs`：`d8721846bf616949197589f43f7680c50d76d4cef9f955d2f36ab18cbaf9982c`
- 未改动的 `fake-docker.mjs`：`c573b5792979196a7a19e896142c84c34456418aa521c2d1521594cd127de30f`
- 未改动的 `deploy/README.md`：`860382ca9aac8993a863f1814a0cf641ab7ad5f34166cbdda3094d8661395173`

## 4. 测试与验证

| 验证 | 观察结果 |
| --- | --- |
| 原生 Windows token 回归 | 通过；PowerShell 5.1 调用运行时编译的真实 `.exe`，远端脚本参数包含 `printf NOOP`/`printf DEPLOY` 且不含转义换行；no-op仅一次 SSH、无 SCP |
| `npm run test:deploy` | 返回 0；五组共 19/19 场景通过，总耗时约 159 秒；测试后无 Bash 残留 |
| `npm run lint` | 返回 0 |
| `npm run typecheck` | 返回 0 |
| `npm run build` | 返回 0；Web/Server 生产构建及静态资源无公网引用检查通过 |
| PowerShell AST | `deploy/deploy.ps1` 解析通过 |
| Git Bash `sh -n` | `deploy/remote-deploy.sh` 解析通过 |
| 安全与来源检查 | 暂存范围精确；无私钥标记、密码字段、主机密钥绕过或卷删除；真实配置忽略未跟踪；`AGENTS.md` 未提交/发布 |
| `git diff --check` | 通过 |
| 新 SHA iStoreOS 构建 | 完整 build成功；日志无 `gyp http GET`；Docker 事件显示镜像创建在旧容器 stop前 11,316 ms |
| 新 SHA运行 | SHA 标记/镜像、唯一容器、非 root、Docker health、外部 `/healthz`、固定卷、唯一备份、单目录和清理状态通过 |
| 新 SHA no-op | 实际子命令退出 0并精确输出三行本地 fast path；无 upload/build/远端状态机；前后状态相等 |

正常更新后的 no-op 基线与完成快照：

- 结构指纹：`sha256:01e14242e7ec6c1c3866c23a8eea1b22c251fb0a874ac42648c7113d9c97afa6`
- 数据库指纹：`sha256:e805c4d2f9b6a3716f9760129c3cc33144023f108a11243460f9dcb036b7b88a`
- 固定备份指纹：`sha256:e805c4d2f9b6a3716f9760129c3cc33144023f108a11243460f9dcb036b7b88a`
- 固定备份 mtime：`1785180699343` ms

本机没有 Docker daemon，按计划没有运行 `test:docker-smoke`。真实 iStoreOS 的新 Dockerfile构建、非 root、health、固定卷复用和容器重建后数据保持提供了与本次改动直接相关的外部 core 证据；未把它描述为未运行的完整 smoke 套件。

## 5. 发现项与处置

无开放 `FND-I-*`。验证结论为 `passed`，下一个可分配编号仍为 `FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无报告项 | 无 | — | 高 | — |

## 6. 决策、计划偏差与恢复记录

- 首次接管前两次构建分别因 Docker Hub匿名令牌 EOF 和 `nodejs.org` 头文件响应中止失败；两次都发生在备份/切换前，正式目录、固定备份、新服务和数据库保持，锁与临时项被清理。用户了解诊断后授权的单次同 SHA重试成功完成 T-001。
- T-001 后的第二次同 SHA 命令由远端权威 no-op保护了状态，但本地仍归档/上传；真实根因为 Windows/OpenSSH 丢失内嵌引号后把 token变为 `NOOPn`。路线图修订 3和阶段计划修订 5在未冻结的 P-002 内纠正，没有改写 P-001结果或把失败证据伪装成通过。
- 原生 token回归第一次沿用 `.cmd` 包装层，只能看到多行命令首行；改为运行时编译 `.exe` 后，首次日志又带 .NET UTF-8 BOM。两项测试夹具问题均在本地修复并通过完整回归，没有服务器副作用。
- 正常更新的外层监控器使用了错误 build文案且未取得 `Start-Process` ExitCode，导致 wrapper在生产子进程成功后返回 1。生产最终 cleanup只可能在远端返回 0后输出；独立 SHA/health/卷/备份/数据/清理门禁和 Docker事件进一步证明完整成功，因此没有盲目重跑正常更新。
- no-op命令先通过退出 0、三行数量与逐行精确内容断言，随后额外大小写不敏感正则把合法 `[PREFLIGHT]` 误判为小写远端阶段，使 wrapper返回 1。状态相等检查通过，按计划没有第三次尝试。
- 所有上述验证封装偏差均已解释并有独立 core证据，不影响交付，也不符合 report-only finding条件。P-003破坏性实机回滚仍未授权或执行。

## 7. 遗留风险与下一阶段进入条件

P-002 没有开放 finding、未决问题、半完成远端状态或未知用户文件。真实配置和私钥未进入 Git、发布归档或工作流证据；用户 `AGENTS.md` 保持未跟踪、未编辑、未提交、未发布。

P-003 仍需另行调用 `$plan-feature-implementation` 滚动规划。进入条件为：

1. 维护者已形成下一项合法、干净且可发布的 Git提交。
2. 当前受管新 SHA 服务、固定卷、唯一备份和无临时状态仍通过只读门禁。
3. 维护者确认回滚维护窗口，并明确授权计划内受控实机失败/回滚演练。
4. P-003 合并 P-001 确定性故障矩阵、P-002 首次接管/更新/no-op和实机回滚证据；只有全部 core/hard gate通过后才创建 `change-0.md` 与 `effective-requirements.md`。

本结果创建后 P-002 计划与结果冻结；不得在 P-003 中改写。任何后续纠正应追加新的合法阶段或在 initial 完成后使用 change run。
