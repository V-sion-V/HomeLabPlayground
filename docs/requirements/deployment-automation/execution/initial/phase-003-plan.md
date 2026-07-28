# initial / P-003 阶段计划

- 运行编号：`initial`
- 阶段编号：`P-003`
- 计划修订：`3`
- 父路线图修订：`5`
- 需求指纹：`sha256:b63b2a82a7fa098d45a4354c3844071c2e1d53c4925f7026984e4791ca1a6ec3`
- 路线图指纹：`sha256:bce74ce1a27dc5ecb772a10214c955707f49f30b717a46a3afb28e5a8c7e5eed`
- 继承基线：P-001/P-002 已分别冻结为 `completed / passed`；P-003 第一次实机演练失败证据和 Q-012 可用性恢复已持久化，当前安全受管版本为 Git `9405972dcfbb8bb5bdc4a6970317e60ed3fb1cef`
- 当前 Git 基线：分支 `main` 的 `HEAD` 为第一次文档候选 `9405972dcfbb8bb5bdc4a6970317e60ed3fb1cef`；主工作区只含路线图修订 5、本执行状态、阶段计划修订 3 和用户未跟踪 `AGENTS.md`，真实配置与诊断文件被 Git 忽略，原候选 detached worktree仍保持 clean
- 当前实机基线：原单次演练中候选先通过 health/cleanup并使部署入口返回 0，重复 SSH轮询 watcher随后才停止候选一次；Q-012 授权的一次 Compose start已恢复服务。当前 `.release-sha`、唯一受管非 root容器与保留镜像均为 `9405972...`，容器 running/healthy且外部 health返回 200；固定卷只有该服务一名写入者，数据库与本次唯一备份 SHA-256均为 `e805c4d2...`，备份 mtime为 `1785212293` 秒；无部署锁、临时目录、备份临时项、rollback标签或遗留 watcher/部署进程
- 创建日期：`2026-07-28`
- 详细程度：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

P-003 使用只含非敏感工作流收口文件、且生产 Docker 构建输入与当前安全版本相同的不同合法 Git SHA，执行受控实机失败并完成 initial 收口。第一次演练已证明“每 750 ms重新建立 SSH连接”的轮询 watcher会因握手延迟错过 pre-health窗口：候选已成功 health/cleanup、部署入口返回 0后才被停止，因而不构成自动回滚证据；该失败不得改写。

修订 3 使用一个新的纯文档候选和单个持久 SSH会话。watcher在服务器本地有界循环，只在候选部署锁的 SHA匹配、阶段仍为 `new_starting` 或 `new_started`，且镜像 full SHA、Compose服务标签、配置 working-dir、running状态和 Docker health=`starting` 全部匹配时执行一次 `docker stop`，随后立即退出。锁已进入 `healthy`/消失、health不是 `starting`、候选不唯一或会话异常时必须不停止并失败关闭。受支持部署入口必须检测新服务无法健康、自动恢复 `9405972...` 的正式目录/镜像和部署前数据库、重新启动旧服务并以非 0返回。

本阶段覆盖 FR-009、FR-012、FR-013，NFR-001、NFR-003、NFR-006、NFR-007，以及 AC-006、AC-007、AC-010、AC-012、AC-014。AC-006、AC-007、AC-010、AC-012、数据恢复、固定卷、旧版本健康、工作区所有权、凭据安全和恢复现场均为 core/hard gate；AC-014 是唯一 supplemental 项。`relaxed` 不要求 red-first，也不重复 P-001 的完整本地故障矩阵；任何 core、数据、运行、恢复、凭据或未知影响异常仍阻塞。

第一次停止的授权来自 Q-011，已在失败演练中消费。用户在被明确告知下一步必须独立纠正规划后回复“继续目标，不要停，除非有你解决不了的问题”，记为 Q-013：允许纠正计划在所有门禁通过后再停止一次新的精确候选容器，以完成同一 P-003 回滚验收。该授权不允许停止当前 `9405972...`、执行第三次注入、修改或损坏业务数据、缩短恢复共用的 health timeout、清理未知恢复现场、删除卷/备份、操作首次接管前的旧 Docker/旧目录，或把普通部署/回滚失败解释为通过。

本阶段明确不做：

- 不修改生产源码、测试、Dockerfile、Compose、部署脚本或数据库模式；不重跑与本阶段未改动生产输入无关的完整本地测试矩阵。
- 不改写 P-001/P-002 计划或结果；`phase-002-result.md` 只能按冻结字节进入候选提交。
- 不把真实配置、主机、用户、私钥路径、容器 ID、玩家/牌局数据或数据库内容写入 Git 和工作流证据。
- 不把用户 `AGENTS.md` 放入 P-003 候选提交或发布归档；该文件仅在 initial 完成后按最终事实更新。
- 原 watcher、原部署和原 stop不重试。修订 3只允许一次新的候选部署和一次 pre-health停止；候选未出现、部署先失败、注入不唯一、自动恢复失败或最终状态不确定时，记录现场并暂停，不执行第三次注入。

修订 2 只处理失败演练后的服务可用性恢复。用户在 Q-012 明确授权一次受管候选服务启动与 Docker/外部 health验证；该操作不重新部署、不重复 stop、不修改数据库/备份、不清理诊断现场，也不把 G-P3-003/G-P3-004 的失败改写为通过。服务恢复后，本阶段仍须暂停并交由独立 `$plan-feature-implementation` 规划纠正阶段或路线图修订。

修订 3 是该独立纠正规划：需求和 AC层级不变，不修改生产文件；路线图升为修订 5。原 T-002/G-P3-003/G-P3-004 失败保持历史，原未激活 T-003由新的纠正任务取代。新的候选、持久 watcher、一次纠正演练和 finalization分别使用 T-004–T-006及 G-P3-007–G-P3-012。

## 2. 任务、激活门禁与文件范围

### 2.1 阶段激活门禁

P-003 计划修订 1 为 `ready`。实施开始前及每个外部副作用边界必须满足：

1. workflow contract 仍为 schema 3.2，需求指纹、路线图修订 4/指纹和本计划指纹匹配；P-001/P-002 结果哈希分别保持 `d832bd43219ca7d43c40c43dd3947b6d0d6b3d00e8eb052988f577ff83e89959` 与 `763f48298ee98545cfaa80db5894c3c6f7f9fb2a2bd450d867357df5446e748c`。
2. Q-011 保持 `resolved / A`；真实配置只有允许键、被 Git 忽略且未跟踪，仓库外私钥存在，非交互 SSH 可用。任何配置值和私钥路径都不得输出。
3. 候选提交只包含 `implementation-plan.md`、`execution-state.md`、冻结的 `phase-002-result.md` 和本 `phase-003-plan.md`；与 `1d049a55...` 比较不得出现 `docs/requirements/deployment-automation/**` 之外的差异。`.dockerignore` 必须继续排除 `docs`，且所有生产文件哈希保持不变。
4. 候选提交创建后必须有一个精确 full SHA 的 clean detached worktree；发布入口显式引用主工作区被忽略的真实配置。主工作区中 `AGENTS.md` 保持未跟踪、未编辑、未暂存。
5. 写入前再次用剥离 PowerShell 5.1 BOM 后启用 `set -eu` 的只读 SSH 门禁确认：旧 SHA 标记/镜像、唯一服务、running/healthy/非 root、外部 health、固定卷单写入者、数据库有效、唯一备份有效且无锁/临时项/rollback 标签。候选镜像容器数必须为 0。
6. 受控监视器必须先以只读模式证明当前旧容器不满足候选 full SHA 三重匹配；随后在部署前启动并进入 bounded waiting 状态。监视器未就绪时不得调用部署入口。

上述 1–6 是修订 1 演练前门禁，已按状态中的 durable evidence执行；原演练不再重试。修订 2 的恢复门禁为：

7. Q-012 必须保持 `resolved / A`；只读复核正式标记、唯一受管容器与镜像均为候选，容器 stopped/unhealthy，固定卷写入者为 0，数据库/固定备份仍为 `e805c4d2...`，备份仍唯一且 mtime为 `1785212293` 秒，无锁、临时项、rollback标签、watcher或部署进程。
8. 唯一写操作只允许从配置正式目录以候选 `PARTY_IMAGE`、配置端口和现有 Compose项目执行一次 `docker compose start home-table`；不得调用部署入口、`up`、`stop`、`rm`、镜像/卷/备份/数据库操作或配置目录之外的旧 Docker。
9. 启动后必须有界等待同一候选容器 running/healthy、非 root、固定卷唯一写入者和外部 `/healthz` 200；固定备份 SHA/mtime与单文件上界保持。失败时不做第二次启动或其他恢复，保存现场并暂停。

上述 7–9 已完成并形成当前安全基线。修订 3 的激活门禁为：

10. schema、需求指纹、路线图修订 5/指纹、本计划修订 3/指纹和 P-001/P-002 冻结结果哈希必须匹配；Q-013保持 resolved。主工作区只允许三份本功能规划/状态差异与用户未跟踪 `AGENTS.md`，真实配置和诊断文件继续被忽略。
11. 严格只读服务器门禁必须重新确认 `9405972...` 是唯一 running/healthy非 root受管服务，固定卷只有该服务一名写入者，数据库与唯一备份均为 `e805c4d2...`、备份 mtime为 `1785212293` 秒，且无锁、临时项、rollback标签或遗留 watcher/部署进程。
12. 新候选提交只能包含 `implementation-plan.md`、`execution-state.md` 和本计划；相对 `9405972...` 不得有工作流目录外差异，`.dockerignore` 继续排除 `docs`，生产构建输入不变。提交后创建精确 full SHA 的 clean detached worktree。
13. 持久 watcher必须只有一个 SSH会话、远端不后台化且不写文件；进入 waiting前先证明新候选容器为 0、没有候选部署锁。源码静态门禁必须证明只有一个精确 `docker stop` 站点、停止前二次复核、无 `rm`/Compose down/卷/数据库写操作和有界退出。
14. watcher远端本地循环只接受锁 state中的 `SHA=<new-candidate>` 与 `STAGE=new_starting|new_started`，并同时匹配候选镜像、`home-table`、配置 working-dir、唯一 full container ID、running=true、health=starting。任一条件漂移、锁进入 `healthy`/消失或连接异常都必须在 stop前失败关闭。
15. watcher明确输出远端 `WATCHER_WAITING=1` 后才可从新 clean worktree运行唯一一次部署入口；运行期间不得启动第二个 watcher、第二个部署或任何手工恢复。
16. 注入后必须取得 `INJECTION_COUNT=1`、候选 SHA及本次固定备份 SHA/mtime；部署入口必须非 0并自行恢复 `9405972...` 和部署前数据库。独立后置门禁完成前不得 finalization。

### 2.2 文件与外部状态所有权

| 文件或状态 | 本阶段允许操作 | 禁止事项 |
| --- | --- | --- |
| `implementation-plan.md` | 提交本次纠正规划产生的修订 5 | P-003 实施时继续改写设计或历史修订 |
| `execution/initial/execution-state.md` | 按任务开始/结束、外部边界、失败和 finalization 持续写 durable checkpoint | 删除既存问答、失败证据、finding 编号或 P-001/P-002 历史 |
| `execution/initial/phase-002-result.md` | 以冻结哈希原样纳入候选提交 | 任何内容修改 |
| `execution/initial/phase-003-plan.md` | 以修订 3 纳入新候选提交；结果存在后冻结 | 实施中静默扩权、降低门禁或改写授权 |
| `execution/initial/phase-003-result.md` | 仅在全部 P-003 core/hard gate 通过后创建 | 在注入未发生、恢复失败或状态未知时创建 |
| `change-0.md`、`effective-requirements.md` | 仅在 P-003 结果通过后生成并与 requirements/三个阶段一致 | 提前生成、掩盖失败或改变原始需求 |
| `AGENTS.md` | P-003 完成后由用户目标要求的独立收尾步骤更新 | 进入候选提交、部署归档或阶段验收 |
| Git 新候选提交与 detached worktree | 只含路线图、状态和本计划三份非敏感工作流文件；作为唯一纠正候选发布来源 | 暂存配置、私钥、诊断文件、AGENTS、产品源码或未知差异 |
| 当前受管 `9405972...` 服务 | 部署状态机正常停止/备份并在回滚中恢复；watcher只读观察 | 由 watcher或手工命令停止、删除或改标签 |
| 精确新候选容器 | 持久 watcher在锁阶段与 health门禁同时匹配后执行一次 `docker stop` | health已为 healthy、锁已提交/消失、匹配不唯一时停止；多次停止、`rm`、卷操作或手工恢复 |
| 固定卷与唯一备份 | 部署脚本按现有实现创建部署前备份并自动恢复；验证只读比较 | 手工写数据库、创建标记数据、删除卷/备份或覆盖第二份备份 |
| 配置目录之外的旧 Docker/旧目录 | 无 | 探测、停止、启动、删除、移动或清理 |

### 2.3 有序任务

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-003-T-001 | 形成合法候选 SHA、clean 发布 worktree和 fail-closed 单次监视器 | 四份计划内工作流文件、Git index/commit、临时 detached worktree、忽略配置、临时脱敏监视器输出 | 激活任务并记录基线；暂存精确四文件，执行敏感/范围/diff 检查后创建文档候选提交；创建 clean detached worktree；对监视器做静态参数复核和候选不存在的只读预检，确认三重匹配、停止前复核、唯一注入计数、有界退出和失败不动作 | G-P3-001；staged/commit 清单；`git diff 1d049a55...<candidate>`；生产文件哈希；`.dockerignore`；配置/私钥/AGENTS 排除；worktree porcelain；监视器 probe 结果 | 候选与旧 SHA 不同且只含四份工作流文件；镜像构建输入不变；发布 worktree clean；旧服务未改变；监视器不能命中旧容器 |
| P-003-T-002 | 原轮询演练及安全恢复（不再恢复） | 原 candidate worktree、迟到 watcher、部署入口、Q-012恢复、执行状态 | 已执行：注入计数为 1但发生在部署成功/cleanup之后，G-P3-003/G-P3-004失败；独立核对数据安全后，按 Q-012只启动候选恢复可用性 | 原失败日志、部署返回 0、无 rollback、恢复后 `9405972...` healthy和数据/备份一致 | 永久保留为 failed core gate证据；不改写为完成、不再次运行 |
| P-003-T-003 | 原 finalization（未激活，已由修订 3取代） | 无生产或最终化文件变化 | 因 T-002失败从未激活；不得创建原计划结果 | `phase-003-result.md`、`change-0.md`、`effective-requirements.md` 均不存在 | superseded before activation |
| P-003-T-004 | 形成新的纯文档候选和持久、pre-health、fail-closed watcher | 路线图/状态/本计划、Git index/commit、新 detached worktree、忽略诊断脚本与日志 | 激活任务并记录基线；暂存精确三文件，完成范围/敏感/diff检查后提交；创建 clean worktree；实现单个持久 SSH watcher，远端本地循环锁阶段和容器 health，静态证明唯一 stop、停止前二次复核、无数据/清理操作，再以 Probe证明当前 `9405972...`不能命中 | G-P3-007–G-P3-009；提交清单与生产 diff；worktree porcelain；PowerShell AST；远端 POSIX解析；单 SSH/单 stop/锁+health静态断言；`PROBE_MATCH_COUNT=0` | 新候选与 `9405972...`不同但生产输入相同；worktree clean；watcher不可能停止当前服务或晚到 healthy候选 |
| P-003-T-005 | 由持久 watcher在 pre-health阶段停止一次新候选，并由受支持入口自动恢复 `9405972...` 与部署前数据库 | 新 clean worktree、真实 iStoreOS、持久 watcher、唯一一次部署入口、执行状态 | 重跑写入前门禁；启动单个 watcher并取得远端 waiting；运行一次候选部署；watcher在锁 `new_starting/new_started`与 health `starting`同时成立时二次复核并停止一次，记录候选 SHA/唯一注入/本次备份 SHA/mtime；等待部署入口非 0自动回滚并独立核对 | G-P3-010–G-P3-011；`INJECTION_COUNT=1`；部署非 0和 rollback/恢复日志；`9405972...` 标记/镜像/healthy与外部 200；数据库等于本次备份；单服务/卷写入者/目录/备份；无 candidate image、rollback标签、锁/临时项或遗留进程 | pre-health故障真实且只有一次；自动化而非手工恢复当前旧应用与部署前数据库；数据/空间/诊断全部通过 |
| P-003-T-006 | 冻结 P-003 并完成 initial 工作流 | `phase-003-result.md`、`change-0.md`、`effective-requirements.md`、执行状态 | 合并 P-001确定性故障矩阵、P-002首次接管/纠正更新/no-op、P-003原失败与纠正实机回滚；按 relaxed分类 AC-014与 `FND-I-*`；创建阶段结果、change-0、自包含有效需求快照并把 initial置为 completed | G-P3-012；全部 FR/NFR/AC追踪；三个 phase result、change-0/effective/state一致；指纹、finding、敏感扫描、`git diff --check` | 全部 core/hard gate通过；原失败透明保留；AC-014通过或仅有合规 report-only finding；无未决问题/半完成远端状态；最终化文件一致 |

历史顺序为 P-003-T-001 → P-003-T-002（core失败）→ Q-012恢复；P-003-T-003从未激活并由修订 3取代。当前可执行顺序固定为 P-003-T-004 → P-003-T-005 → P-003-T-006。任何当前任务未完成时不得激活下一任务。

## 3. 验证与完成条件

### 3.1 门禁

- **G-P3-001 — 来源、所有权、凭据与候选完整性（hard gate）**
  - schema/需求/路线图/计划/冻结结果指纹匹配，Q-011 为明确 A；主工作区只含已知文件。
  - 候选提交精确四文件、无敏感值、无 `AGENTS.md`/真实配置/私钥；生产文件与 Docker 构建输入相对 `1d049a55...` 不变；detached worktree clean。
  - 监视器只对候选 full SHA + `home-table` + 配置 working-dir 的唯一容器生效，停止前二次复核，最多执行一次。

- **G-P3-002 — 写入前实机安全基线（data/recovery hard gate）**
  - 当前发布标记/镜像仍为 `1d049a55...`，恰好一个受管服务 running/healthy/非 root且外部 health通过。
  - 固定卷存在且只有当前服务一名写入者；数据库有效；备份目录只有既有有效固定备份；无锁、upload/incoming/previous/failed、备份临时项、候选容器或 rollback 标签。
  - 监视器 waiting 后才能运行唯一一次部署入口；任何漂移在上传、停服或注入前暂停。

- **G-P3-003 — 受控故障真实性（core）**
  - 候选部署通过正常上传、构建、停服、冷备份、目录交换和候选启动边界；监视器只在候选容器出现后执行一次停止并退出。
  - 注入证据记录精确候选 SHA、`INJECTION_COUNT=1` 和本次部署备份 SHA/mtime；不记录容器 ID、路径或业务数据。
  - 部署入口不得返回 0；普通构建/网络失败、监视器未触发、候选已成功提交或注入结果不确定都不是回滚通过。

- **G-P3-004 — 应用与数据库一体自动恢复（core/data hard gate）**
  - 日志进入 new-health/rollback 路径并明确旧安全状态已恢复；没有 `Automatic recovery failed`。
  - 最终正式目录标记、运行镜像和唯一服务恢复 `1d049a55...`，旧服务 running/healthy、非 root且外部 health通过。
  - 最终 `/data/platform.sqlite` SHA-256 等于监视器捕获的本次部署备份 SHA；固定备份保持同一 SHA/mtime。P-001 的确定性 mutated-database/WAL/SHM 场景继续证明恢复实现的写入覆盖与 sidecar 清理，P-003 不人为修改业务数据库。

- **G-P3-005 — 卷、空间、退出与诊断（hard gate；AC-014 supplemental）**
  - 固定卷未删除、重命名或匿名替换，只有恢复后的服务一名写入者；没有第二套 Compose 服务。
  - 自动化范围只有一个正式目录和一个固定备份；candidate image、rollback 标签、锁、upload/incoming/previous/failed及备份临时项均不存在。
  - 部署进程非 0；日志覆盖 preflight/upload/build/stop/backup/switch/health/rollback/cleanup或恢复等实际阶段且无敏感内容。AC-014 的非关键日志深度异常只有在独立证明不影响 core 后才可分配 `FND-I-001` 起的稳定 ID。

- **G-P3-006 — finalization 一致性（final hard gate）**
  - P-001/P-002/P-003 的全部 core 与 hard gate合并通过，无未决问题、未知用户文件或半完成远端状态。
  - `phase-003-result.md`、`change-0.md`、`effective-requirements.md` 和 `execution-state.md` 对策略、结论、文件、需求追踪、finding及生产最终状态一致；冻结历史未修改。
  - `git diff --check` 与非敏感扫描通过；最终用户要求的 `AGENTS.md` 更新、Git 提交和 GitHub push仍是 completed state之后的独立收尾，不作为本阶段通过的替代证据。

G-P3-001–G-P3-006 是修订 1原演练的门禁。G-P3-003/G-P3-004已失败且永久保留，不能通过后续证据改写；修订 3使用以下新的纠正门禁：

- **G-P3-007 — 纠正来源、授权与当前安全基线（hard gate）**
  - schema/需求/路线图修订 5/本计划修订 3/P-001与P-002冻结结果指纹匹配；Q-013为 resolved，真实配置继续被忽略且无敏感值进入证据。
  - 当前 `9405972...` 是唯一 running/healthy非 root受管服务，外部 health返回 200；固定卷只有该服务一名写入者，数据库与唯一备份均为 `e805c4d2...`、备份 mtime为 `1785212293` 秒，无锁、临时项、rollback标签或遗留部署/watcher进程。

- **G-P3-008 — 新候选完整性（hard gate）**
  - 新候选提交精确包含路线图、状态和本计划三文件；相对 `9405972...` 无工作流目录外差异，无 `AGENTS.md`、配置、私钥、诊断文件或敏感值。
  - `.dockerignore`继续排除 `docs`，生产构建输入不变；新 full SHA detached worktree clean且只从该 worktree运行部署入口。

- **G-P3-009 — 持久 watcher pre-health失败关闭（recovery hard gate）**
  - watcher只建立一个持久 SSH会话，远端脚本不后台化、不写文件、有界退出；启动前 Probe证明新候选容器为 0且不能匹配当前 `9405972...`。
  - 源码只有一个精确 `docker stop`站点；停止前两次核对候选 full SHA、`home-table`、配置 working-dir、唯一 full ID、running=true、health=starting，以及锁 state中的候选 SHA和 `new_starting|new_started`。
  - 锁进入 `healthy`/消失、health不是 `starting`、候选不唯一、连接中断或超时都输出安全失败且不执行 stop；远端 `WATCHER_WAITING=1`之前不得部署。

- **G-P3-010 — 纠正故障真实性（core）**
  - 唯一候选部署通过上传、构建、停服、冷备份、目录交换并进入候选启动边界；watcher在锁尚未提交 healthy且候选 health仍为 starting时执行一次停止并退出。
  - 注入证据只记录候选 SHA、`INJECTION_COUNT=1`和本次部署备份 SHA/mtime；不记录容器 ID、真实路径或业务数据。部署入口必须非 0；普通构建失败、watcher未触发/晚到或状态不明都不是通过。

- **G-P3-011 — 纠正自动恢复与最终服务器状态（core/data hard gate；AC-014 supplemental）**
  - 部署日志进入 rollback并明确旧安全状态已恢复，没有 `Automatic recovery failed`；最终标记、运行镜像与唯一服务恢复 `9405972...`，服务 running/healthy、非 root且外部 health返回 200。
  - 最终数据库 SHA等于 watcher捕获的本次备份 SHA，固定备份保持同一 SHA/mtime；固定卷只有恢复服务一名写入者，自动化范围只有一个正式目录和一个备份，无候选镜像、rollback标签、锁、发布/备份临时项或遗留进程。
  - 部署进程非 0，实际阶段日志完整且无敏感内容。AC-014只有在 core已由独立证据证明且仅日志深度异常时才可形成 `FND-I-*`。

- **G-P3-012 — 纠正 finalization 一致性（final hard gate）**
  - P-001/P-002与P-003纠正演练的全部 core/hard gate合并通过；原 P-003失败与Q-012恢复透明保留，无未决问题、未知用户文件或半完成远端状态。
  - `phase-003-result.md`、`change-0.md`、`effective-requirements.md`和状态对策略、结论、文件、追踪、finding及生产最终状态一致，冻结历史未修改；`git diff --check`与非敏感扫描通过。

### 3.2 失败、恢复与暂停

1. 原 G-P3-003/G-P3-004失败与Q-012恢复保持冻结，不再运行原 watcher、原候选部署、原 stop或原 finalization任务。
2. 新候选提交范围、敏感扫描、生产哈希或 detached worktree不匹配：不连接服务器，保持 T-004 `in_progress`并暂停。
3. 写入前实机门禁漂移、新候选已存在、持久 SSH不能建立、watcher不能证明单连接/锁+health失败关闭：不运行部署入口，记录只读事实并暂停。
4. 部署在新候选启动前因上传、构建、备份等普通原因失败：watcher必须安全退出且未触发；只读确认当前状态，不把它算作回滚证据，不自动重试。
5. watcher观察到锁已 `healthy`/消失、health不是 `starting`、零个或多个候选、二次复核不一致、连接中断或超时：不执行停止。若候选正常部署，保持健康并暂停；不得迟到停止或手工回退。
6. `INJECTION_COUNT=1` 后部署返回 0、候选仍运行、`9405972...`未恢复、数据库/备份不相等或恢复日志不明确：立即只读检查并暂停；不执行第三次 stop、第二个纠正部署或手工恢复。
7. 自动恢复失败：服从生产脚本保留现场语义，不删除卷、备份、锁、目录或镜像；记录脱敏诊断和文档中的人工恢复入口，等待新的恢复授权。
8. 只有 G-P3-007–G-P3-012 全部通过才能创建阶段结果并完成 initial；任何 core/hard gate失败不能降级为 relaxed finding。原 G-P3-003/G-P3-004必须作为已纠正的计划偏差进入结果，而不是伪装成历史通过。

### 3.3 完成判定

P-003 只有在以下事实同时成立时为 `completed`：

1. 原轮询 watcher迟到失败与Q-012恢复透明保留；新的候选提交与 `9405972...`不同但生产构建输入相同，clean detached worktree和敏感/所有权门禁通过。
2. 单个持久 SSH watcher只在候选锁为 `new_starting/new_started`且 health仍为 `starting`时停止一次精确新候选；部署入口明确失败并由自身自动恢复旧应用与部署前数据库。
3. 最终服务器恢复 `9405972...` healthy服务，固定卷、唯一备份、唯一正式目录和无临时状态全部通过，数据库等于本次部署备份。
4. G-P3-007–G-P3-012及P-001/P-002/P-003关联的全部 core/hard gate合并通过；AC-014通过或形成合规 report-only finding。
5. P-003结果、`change-0.md`、`effective-requirements.md`和 completed execution state已生成且一致。

## 4. 风险、恢复与修订记录

### 4.1 Durable checkpoints

至少在以下边界先写执行状态，再跨越副作用：

1. T-001 开始前：记录当前 Git/status、冻结结果哈希、配置忽略/私钥存在性、Q-011 和严格只读服务器基线。
2. 创建候选提交前：记录 staged 精确清单、生产 diff为空、敏感扫描与候选提交预期。
3. 候选提交后：记录 full SHA、clean detached worktree、生产文件哈希和监视器 fail-closed probe。
4. T-002 写入前：重跑严格实机门禁，记录旧 SHA/服务/卷/备份/无临时项及候选容器不存在；标记下一原子操作为启动监视器。
5. 监视器 waiting 后：记录监视器已就绪，下一原子操作为唯一一次部署入口。
6. 监视器触发后：立即记录 `INJECTION_COUNT=1`、候选 SHA、本次备份 SHA/mtime和部署仍在运行；不得再次注入。
7. 部署退出后：记录非 0/恢复日志或失败分类，再执行独立后置门禁。
8. T-002 完成后：记录最终旧 SHA/health、数据库与备份、卷/目录/镜像/临时状态；只有全部通过才激活 T-003。
9. finalization 前后：记录全部阶段/验收/finding合并结果，最后把 initial 置为 `completed`。

上述 1–9 是修订 1/2的历史检查点。修订 3继续使用：

10. T-004开始前：记录路线图/计划/冻结结果指纹、Q-013、当前 Git/status、配置忽略和 `9405972...`严格只读服务器基线。
11. 新候选提交前后：先记录 staged精确三文件、生产 diff/敏感扫描，再记录 full SHA、clean detached worktree和 watcher静态/Probe证据。
12. T-005写入前：重跑严格实机门禁，记录 `9405972...`、服务/卷/数据库/备份/无临时项与新候选不存在；标记下一原子操作只为启动持久 watcher。
13. 远端 watcher waiting后：记录单个持久 SSH会话已就绪、锁/候选初始为空，下一原子操作只为一次新候选部署入口。
14. watcher触发与部署退出：记录 `INJECTION_COUNT=1`、候选 SHA、备份 SHA/mtime、锁/health pre-health证据和部署非 0/rollback分类；不得再次注入。
15. T-005后置门禁和T-006 finalization前后：记录恢复的 `9405972...`、数据库/备份、卷/目录/镜像/进程/临时状态及全部验收/finding合并，最后把 initial置为 completed。

### 4.2 当前精确恢复入口

当前修订 3已规划完成，下一次实现只执行 P-003-T-004：

1. 完整读取本计划修订 3、路线图修订 5、当前状态、requirements、P-001/P-002冻结结果和Q-013。
2. 核对需求/路线图/计划/结果指纹，确认主工作区只有三份本功能规划/状态差异与用户 `AGENTS.md`，真实配置和诊断文件仍被忽略。
3. 重新执行 G-P3-007的本地、非交互 SSH和严格只读服务器门禁；任何漂移在 Git提交或服务器写入前停止。
4. 先执行 T-004：创建精确三文档候选提交和clean detached worktree，生成被忽略的持久 watcher并完成 AST/POSIX/唯一 stop/锁+health/Probe门禁；只有 G-P3-007–G-P3-009全部通过才可激活 T-005。
5. 同一 `$implement-planned-feature` 调用按 T-004 → T-005 → T-006继续执行整个 P-003；每个副作用边界先写 durable checkpoint。只有 hard gate失败、状态不明或不可安全恢复时才暂停，不为任务边界额外停下或重新规划。

### 4.3 修订记录

| 修订 | 日期 | 原因 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-28 | P-002 已冻结通过；用户在 Q-011 明确选择 A，确认当前维护窗口并授权一次精确候选容器停止。严格只读门禁证明当前旧 SHA、服务、卷、唯一备份与无临时状态可作为安全基线；文档候选与三重匹配监视器是最小有界触发方式 | 创建 T-001 候选/监视器、T-002 实机回滚和 T-003 finalization 三个有序任务；保持 expanded 与 relaxed，新增 G-P3-001–G-P3-006，不改变 requirements 或 AC 层级 |
| 2 | 2026-07-28 | 原 watcher在候选已通过 health/cleanup并使部署返回 0后才停止容器，自动回滚验收失败且服务停止；用户对 Q-012 明确回复“授权”，选择最小候选启动恢复 | 不改变需求、路线图、失败结论或验收层级；只授权一次 Compose start与健康验证，恢复后继续暂停并要求独立规划纠正阶段 |
| 3 | 2026-07-28 | 独立审计确认失败根因是 watcher每 750 ms重新建立 SSH连接，握手延迟超过候选 pre-health窗口；当前 `9405972...`已恢复 healthy，数据库/唯一备份一致且无临时状态。用户在获知必须纠正规划后要求继续目标且不要因可解决问题停止，记为 Q-013 | 路线图升为修订 5；原 T-002失败和未激活 T-003保持历史，新增 T-004–T-006与G-P3-007–G-P3-012。纠正 watcher改为单个持久 SSH会话中的服务器本地循环，并把候选部署锁阶段和health=starting作为stop硬门禁；需求与AC层级不变 |
