# initial / P-003 阶段计划

- 运行编号：`initial`
- 阶段编号：`P-003`
- 计划修订：`1`
- 父路线图修订：`4`
- 需求指纹：`sha256:b63b2a82a7fa098d45a4354c3844071c2e1d53c4925f7026984e4791ca1a6ec3`
- 路线图指纹：`sha256:edefef4f3522f0d465be165b33568cca8a626a10264af1bada7c3370caa45118`
- 继承基线：P-001/P-002 已分别冻结为 `completed / passed`；当前受管版本为 Git `1d049a55ad3432bb1260fe2ddd1ac5f3ca85d6ea`
- 当前 Git 基线：分支 `main` 的 `HEAD` 为 `1d049a55ad3432bb1260fe2ddd1ac5f3ca85d6ea`，比 `origin/main` 领先 2 个提交；主工作区只含本功能规划/收口文档和用户未跟踪 `AGENTS.md`，真实配置被 Git 忽略且私钥位于仓库外
- 当前实机基线：严格只读门禁确认 `.release-sha`、运行镜像和唯一受管 `home-table` 均为 `1d049a55...`；服务 running/healthy、非 root、对外 health 通过，固定卷只有该服务一名写入者，唯一备份哈希/mtime 与 P-002 冻结值相同，无部署锁、临时目录、备份临时项或 rollback 标签
- 创建日期：`2026-07-28`
- 详细程度：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

P-003 使用一个只含非敏感工作流收口文件、且生产 Docker 构建输入与 `1d049a55...` 相同的不同合法 Git SHA，执行一次受控实机失败。外部监视器必须先于部署启动，只在镜像 full SHA、Compose 服务标签和配置正式目录 working-dir 三重精确匹配候选容器时执行一次 `docker stop`，随后立即退出。受支持部署入口必须检测新服务无法健康、自动恢复旧正式目录/旧 SHA 镜像/部署前数据库、重新启动旧服务并以非 0 返回。

本阶段覆盖 FR-009、FR-012、FR-013，NFR-001、NFR-003、NFR-006、NFR-007，以及 AC-006、AC-007、AC-010、AC-012、AC-014。AC-006、AC-007、AC-010、AC-012、数据恢复、固定卷、旧版本健康、工作区所有权、凭据安全和恢复现场均为 core/hard gate；AC-014 是唯一 supplemental 项。`relaxed` 不要求 red-first，也不重复 P-001 的完整本地故障矩阵；任何 core、数据、运行、恢复、凭据或未知影响异常仍阻塞。

授权边界来自 Q-011 的用户明确回答 A：当前维护窗口有效，允许在所有门禁通过后停止一次精确候选容器。该授权不允许停止当前旧 SHA 容器、重复故障注入、修改或损坏业务数据、缩短恢复共用的 health timeout、清理失败恢复现场、删除卷/备份、操作首次接管前的旧 Docker/旧目录，或把普通部署/回滚失败解释为通过。

本阶段明确不做：

- 不修改生产源码、测试、Dockerfile、Compose、部署脚本或数据库模式；不重跑与本阶段未改动生产输入无关的完整本地测试矩阵。
- 不改写 P-001/P-002 计划或结果；`phase-002-result.md` 只能按冻结字节进入候选提交。
- 不把真实配置、主机、用户、私钥路径、容器 ID、玩家/牌局数据或数据库内容写入 Git 和工作流证据。
- 不把用户 `AGENTS.md` 放入 P-003 候选提交或发布归档；该文件仅在 initial 完成后按最终事实更新。
- 不创建第二次自动重试。候选未出现、部署先失败、注入不唯一、自动恢复失败或最终状态不确定时，记录现场并暂停。

## 2. 任务、激活门禁与文件范围

### 2.1 阶段激活门禁

P-003 计划修订 1 为 `ready`。实施开始前及每个外部副作用边界必须满足：

1. workflow contract 仍为 schema 3.2，需求指纹、路线图修订 4/指纹和本计划指纹匹配；P-001/P-002 结果哈希分别保持 `d832bd43219ca7d43c40c43dd3947b6d0d6b3d00e8eb052988f577ff83e89959` 与 `763f48298ee98545cfaa80db5894c3c6f7f9fb2a2bd450d867357df5446e748c`。
2. Q-011 保持 `resolved / A`；真实配置只有允许键、被 Git 忽略且未跟踪，仓库外私钥存在，非交互 SSH 可用。任何配置值和私钥路径都不得输出。
3. 候选提交只包含 `implementation-plan.md`、`execution-state.md`、冻结的 `phase-002-result.md` 和本 `phase-003-plan.md`；与 `1d049a55...` 比较不得出现 `docs/requirements/deployment-automation/**` 之外的差异。`.dockerignore` 必须继续排除 `docs`，且所有生产文件哈希保持不变。
4. 候选提交创建后必须有一个精确 full SHA 的 clean detached worktree；发布入口显式引用主工作区被忽略的真实配置。主工作区中 `AGENTS.md` 保持未跟踪、未编辑、未暂存。
5. 写入前再次用剥离 PowerShell 5.1 BOM 后启用 `set -eu` 的只读 SSH 门禁确认：旧 SHA 标记/镜像、唯一服务、running/healthy/非 root、外部 health、固定卷单写入者、数据库有效、唯一备份有效且无锁/临时项/rollback 标签。候选镜像容器数必须为 0。
6. 受控监视器必须先以只读模式证明当前旧容器不满足候选 full SHA 三重匹配；随后在部署前启动并进入 bounded waiting 状态。监视器未就绪时不得调用部署入口。

### 2.2 文件与外部状态所有权

| 文件或状态 | 本阶段允许操作 | 禁止事项 |
| --- | --- | --- |
| `implementation-plan.md` | 只提交本次规划产生的修订 4 | P-003 实施时继续改写设计或历史修订 |
| `execution/initial/execution-state.md` | 按任务开始/结束、外部边界、失败和 finalization 持续写 durable checkpoint | 删除既存问答、失败证据、finding 编号或 P-001/P-002 历史 |
| `execution/initial/phase-002-result.md` | 以冻结哈希原样纳入候选提交 | 任何内容修改 |
| `execution/initial/phase-003-plan.md` | 以修订 1 纳入候选提交；结果存在后冻结 | 实施中静默扩权、降低门禁或改写授权 |
| `execution/initial/phase-003-result.md` | 仅在全部 P-003 core/hard gate 通过后创建 | 在注入未发生、恢复失败或状态未知时创建 |
| `change-0.md`、`effective-requirements.md` | 仅在 P-003 结果通过后生成并与 requirements/三个阶段一致 | 提前生成、掩盖失败或改变原始需求 |
| `AGENTS.md` | P-003 完成后由用户目标要求的独立收尾步骤更新 | 进入候选提交、部署归档或阶段验收 |
| Git 候选提交与 detached worktree | 只含上述计划内非敏感工作流文件；作为唯一候选发布来源 | 暂存配置、私钥、AGENTS、产品源码或未知差异 |
| 当前受管 `1d049a55...` 服务 | 部署状态机正常停止/备份并在回滚中恢复；监视器只读观察 | 由监视器或手工命令停止、删除或改标签 |
| 精确候选容器 | 监视器三重匹配后执行一次 `docker stop` | 多次停止、匹配不唯一时停止、`rm`、卷操作或手工恢复 |
| 固定卷与唯一备份 | 部署脚本按现有实现创建部署前备份并自动恢复；验证只读比较 | 手工写数据库、创建标记数据、删除卷/备份或覆盖第二份备份 |
| 配置目录之外的旧 Docker/旧目录 | 无 | 探测、停止、启动、删除、移动或清理 |

### 2.3 有序任务

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-003-T-001 | 形成合法候选 SHA、clean 发布 worktree和 fail-closed 单次监视器 | 四份计划内工作流文件、Git index/commit、临时 detached worktree、忽略配置、临时脱敏监视器输出 | 激活任务并记录基线；暂存精确四文件，执行敏感/范围/diff 检查后创建文档候选提交；创建 clean detached worktree；对监视器做静态参数复核和候选不存在的只读预检，确认三重匹配、停止前复核、唯一注入计数、有界退出和失败不动作 | G-P3-001；staged/commit 清单；`git diff 1d049a55...<candidate>`；生产文件哈希；`.dockerignore`；配置/私钥/AGENTS 排除；worktree porcelain；监视器 probe 结果 | 候选与旧 SHA 不同且只含四份工作流文件；镜像构建输入不变；发布 worktree clean；旧服务未改变；监视器不能命中旧容器 |
| P-003-T-002 | 注入一次候选停止并由受支持入口自动恢复旧应用与部署前数据库 | clean candidate worktree、真实 iStoreOS、精确监视器、部署入口、执行状态 | 重新完成 G-P3-001/G-P3-002；启动监视器并确认 waiting；运行一次候选部署；监视器发现唯一候选容器后复核并停止一次，记录候选 SHA、唯一注入标记及本次固定备份 SHA/mtime；等待部署入口进入 new-health 回滚。命令必须非 0且明确先前安全状态已恢复；随后独立只读核对旧 SHA、数据库/备份、health、卷和清理上界 | G-P3-002–G-P3-005；监视器 `INJECTION_COUNT=1`；部署非 0和 rollback/恢复日志；旧 SHA 标记/镜像/healthy与外部 200；当前数据库 SHA等于监视器捕获的本次备份 SHA；固定备份 SHA/mtime保持；单服务/单卷写入者/单目录/单备份；无 candidate image、rollback 标签、锁或临时项 | 故障确实发生在精确候选且只有一次；自动化而非手工恢复 `1d049a55...` 和部署前数据库；旧服务 healthy；数据/空间/诊断全部通过。任一条件失败则不进入 T-003 |
| P-003-T-003 | 冻结 P-003 并完成 initial 工作流 | `phase-003-result.md`、`change-0.md`、`effective-requirements.md`、执行状态 | 合并 P-001 确定性故障矩阵、P-002 首次接管/纠正更新/no-op和 P-003 实机回滚证据；按 relaxed 分类 AC-014 与 `FND-I-*`；创建阶段结果、change-0、自包含有效需求快照，并把 initial 状态置为 `completed` | G-P3-006；全部 FR/NFR/AC 追踪；三个 phase plan/result 与 change-0/effective/state 一致；需求/路线图/阶段指纹；finding 合并；敏感扫描；`git diff --check` | 全部 core/hard gate通过；AC-014通过或仅有合规 report-only finding；无未决问题/半完成远端状态；`change-0.md`、有效快照和 completed state一致 |

依赖顺序：P-003-T-001 → P-003-T-002 → P-003-T-003。任何任务未完成时不得激活下一任务。

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

### 3.2 失败、恢复与暂停

1. 候选提交范围、敏感扫描、生产哈希或 detached worktree 不匹配：不连接服务器，保持 T-001 `in_progress` 并暂停。
2. 写入前实机门禁漂移、候选容器已存在或监视器不能证明 fail-closed：不运行部署入口，记录只读事实并暂停。
3. 部署在候选启动前因上传、构建、备份等普通原因失败：取消尚未触发的监视器，只读确认当前安全状态；不把它算作 P-003 回滚证据，不自动重试。
4. 监视器发现零个或多个候选、二次复核不一致或超时：不执行停止；若部署仍在运行，先维持监视器和部署状态的可观察性，不自行扩大故障操作。最终候选若正常部署，保持健康并暂停，不手工回退。
5. `INJECTION_COUNT=1` 后部署返回 0、候选仍运行、旧 SHA未恢复、数据库/备份不相等或恢复日志不明确：立即只读检查并暂停；不进行第二次停止或第二轮部署。
6. 自动恢复失败：服从生产脚本保留现场语义，不删除卷、备份、锁、目录或镜像；记录脱敏诊断和文档中的人工恢复入口，等待用户新的恢复授权。
7. 只有 G-P3-001–G-P3-006 全部通过才能创建阶段结果并完成 initial；任何 core/hard gate失败不能降级为 relaxed finding。

### 3.3 完成判定

P-003 只有在以下事实同时成立时为 `completed`：

1. 候选提交与 `1d049a55...` 不同但生产构建输入相同，clean detached worktree和敏感/所有权门禁通过。
2. 监视器仅停止一次精确候选容器，部署入口明确失败且由自身自动恢复旧应用与部署前数据库。
3. 最终服务器恢复 `1d049a55...` healthy 服务，固定卷、唯一备份、唯一正式目录和无临时状态全部通过，数据库等于本次部署备份。
4. P-001/P-002/P-003 的全部 core/hard gate合并通过；AC-014通过或形成合规 report-only finding。
5. P-003 结果、`change-0.md`、`effective-requirements.md` 和 completed execution state已生成且一致。

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

### 4.2 当前精确恢复入口

下一次只调用 `$implement-planned-feature` 并执行 P-003：

1. 完整读取本计划修订 1、路线图修订 4、当前执行状态、requirements、P-001/P-002 冻结结果和 `AGENTS.md` 所有权边界。
2. 先把运行/P-003/T-001 置为 `in_progress`，按 2.1 重验本地、配置和严格只读服务器门禁；不得从规划调用直接部署。
3. 只暂存四份候选工作流文件，创建不同合法提交和 clean detached worktree；完成监视器 fail-closed probe。
4. 激活 T-002，重跑写入前门禁并按 durable checkpoint 顺序执行唯一一次受控部署/单次停止/自动回滚。
5. 只有自动恢复与独立后置门禁通过后才执行 T-003 并最终化；随后退出实现技能，再按用户目标更新 `AGENTS.md`、复核、创建最终提交并推送 GitHub。

### 4.3 修订记录

| 修订 | 日期 | 原因 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-28 | P-002 已冻结通过；用户在 Q-011 明确选择 A，确认当前维护窗口并授权一次精确候选容器停止。严格只读门禁证明当前旧 SHA、服务、卷、唯一备份与无临时状态可作为安全基线；文档候选与三重匹配监视器是最小有界触发方式 | 创建 T-001 候选/监视器、T-002 实机回滚和 T-003 finalization 三个有序任务；保持 expanded 与 relaxed，新增 G-P3-001–G-P3-006，不改变 requirements 或 AC 层级 |
