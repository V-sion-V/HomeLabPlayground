# P-003 阶段结果：实机自动回滚与 initial 收口

- 运行编号：`initial`
- 阶段编号：`P-003`
- 阶段计划：[phase-003-plan.md](phase-003-plan.md)
- 阶段计划修订：`5`
- 父路线图修订：`6`
- 需求指纹：`sha256:b63b2a82a7fa098d45a4354c3844071c2e1d53c4925f7026984e4791ca1a6ec3`
- 路线图指纹：`sha256:d6f5468e21d6a2eb4bb89817c15a6192aa6080c8252f786e52300da26fed58e2`
- 阶段计划指纹：`sha256:8565143ee898c207df940655e000f88ab7ffefed987d0be0f1fea518b981e0df`
- 开始基线：Git `1d049a55ad3432bb1260fe2ddd1ac5f3ca85d6ea`；P-002 的唯一受管服务 healthy，固定卷、唯一备份与正式目录安全
- 完成基线：Git main `b9490b7f8137af2982bf494b1bc1c0005089f656`；一次性故障候选 `02066597ee5824eb161d0cb4f89cc0689ba94023` 已自动回滚且未进入 main；服务器恢复 b949 healthy
- 完成日期：`2026-07-28`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 阶段目标与结果

P-003 已完成真实 iStoreOS 的已有版本自动回滚验收，并合并 P-001/P-002 证据完成 initial 收口。

两次外部 watcher 演练都透明保留为 failed core gate：第一次因每轮重新建立 SSH 而迟于候选提交；第二次即使使用持久 SSH、部署锁阶段和两次 `health=starting` 复核，仍在复核与实际 stop 之间发生部署成功提交竞态。两次均未被改写为通过，停止后的服务分别按 Q-012 与 Q-015 授权恢复。

最终纠正不再依赖外部 stop。独立 detached 候选只把 `home-table` 的 Compose healthcheck 改为确定失败，未进入 main。受支持部署入口完成构建、冷备份、目录切换和候选启动后，在自己的 health gate 内确定失败，进入 rollback，以非 0结束并明确报告旧安全状态已恢复。独立后置门禁确认：

- 正式标记、运行镜像和唯一服务恢复 `b9490b7...`；
- 服务 running/healthy、非 root，外部 `/healthz` 返回 200；
- 数据库与本次唯一备份 SHA-256 均为 `e805c4d2f9b6a3716f9760129c3cc33144023f108a11243460f9dcb036b7b88a`；
- 固定备份 mtime 为 `1785223256` 秒，目录仍只有一个备份；
- 固定卷只有恢复服务一名写入者；
- 故障候选镜像/容器、临时 rollback 标签、锁、upload/incoming/previous/failed 和备份临时项均不存在。

## 2. 任务、需求与验收覆盖

| 任务 | 完成结果 | 主要证据 |
| --- | --- | --- |
| P-003-T-001 | completed | 创建原文档候选与严格三重匹配轮询 watcher；候选发布成功后 watcher 才停止服务，保留为失败证据 |
| P-003-T-002 | failed core gate / superseded | 原 watcher 未触发 rollback；数据安全，Q-012 最小启动恢复服务 |
| P-003-T-003 | superseded before activation | 原 finalization 未激活 |
| P-003-T-004 | completed | 创建 b949 文档候选和持久 SSH watcher；AST、POSIX、唯一 stop、双重锁/health 复核与零匹配 Probe 通过 |
| P-003-T-005 | failed core gate / superseded | 持久 watcher 的唯一 stop 仍与部署成功提交竞态；数据安全，Q-015 授权恢复 |
| P-003-T-006 | superseded before activation | 第二版 finalization 未激活 |
| P-003-T-007 | completed | 无 stdin 服务参数的直接 Compose start 恢复 b949；Docker/外部 health 和数据不变通过 |
| P-003-T-008 | completed | detached 候选 `02066597...` 只修改 Compose healthcheck 一行；worktree clean，main 未移动 |
| P-003-T-009 | completed | 候选确定健康失败；部署非 0自动恢复 b949 与部署前数据库，全部运行/数据/清理门禁通过 |
| P-003-T-010 | completed | 生成本结果、change-0、有效需求快照并完成 initial |

| 门禁/验收 | 层级 | 通过证据 |
| --- | --- | --- |
| G-P3-013 可用性恢复 | recovery hard gate | b949 单次直接 start；同一容器 healthy、外部 200、数据库/备份不变 |
| G-P3-014 故障候选完整性 | hard gate | 候选相对 b949 只有 healthcheck 一行差异；detached/clean；main、配置与用户文件未进入 |
| G-P3-015 确定故障与自动恢复 | core/data hard gate | 入口自身 health 失败、rollback、非 0；b949、数据库、卷、单备份、单目录与清理状态全部恢复 |
| G-P3-016 最终一致性 | final hard gate | P-001/P-002 冻结证据未改；失败历史、恢复、最终实机回滚与收口文件连续一致 |
| AC-006、AC-007、AC-010、AC-012 | core | 旧镜像/数据库一体恢复、卷与空间上界、人工边界及退出语义通过 |
| AC-014 | supplemental | 实际日志覆盖 preflight、upload、build、stop、backup、switch、health、rollback，未发现敏感证据 |

P-003 负责的 FR-009、FR-012、FR-013，NFR-001、NFR-003、NFR-006、NFR-007 与全部关联验收均通过。结合 P-001/P-002，FR-001–FR-013、NFR-001–NFR-010、AC-001–AC-015 全部获得完成证据。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `implementation-plan.md` | modify | 路线图修订 4–6：保留失败、纠正外部竞态并采用确定健康失败候选 |
| `execution/initial/phase-003-plan.md` | add | 修订 1–5 的候选、恢复、失败、确定性回滚与 finalization 计划 |
| `execution/initial/execution-state.md` | modify | 保存所有授权、外部边界、失败、恢复和最终门禁 |
| `execution/initial/phase-003-result.md` | add | 冻结 P-003 完成证据 |
| `change-0.md`、`effective-requirements.md` | add | 冻结首次实现并生成当前需求权威快照 |
| detached `02066597...:deploy/compose.yml` | ephemeral test commit | 只把候选 healthcheck 改为确定失败；未进入 main 或最终服务器 |

生产部署脚本、Dockerfile、主分支 Compose、应用源码和业务数据库模式在 P-003 未修改。

## 4. 测试与验证

| 验证 | 观察结果 |
| --- | --- |
| 指纹与冻结结果 | requirements、路线图修订 6、阶段计划修订 5、P-001/P-002 结果哈希全部匹配 |
| 候选范围 | detached 候选相对 b949 只有 `deploy/compose.yml` 一行替换；`git diff --check`通过 |
| T-007 恢复 | 直接 Compose start退出0；b949 Docker health与外部200通过；数据库/备份SHA和mtime不变 |
| T-009 真实部署 | 候选构建、冷备份、切换后在health阶段失败；日志进入rollback，wrapper退出1 |
| 自动恢复 | 明确出现previous safe state restored；没有Automatic recovery failed |
| 最终实机门禁 | b949标记/镜像/唯一服务healthy、非root、外部200；数据库等于本次备份；卷/目录/镜像/锁/临时状态全部通过 |
| 凭据与范围 | 真实配置继续被忽略；证据不含主机、用户、私钥路径、容器ID或业务数据；未操作非home-table范围 |
| `git diff --check` | 通过 |

P-001 的正式本地证据为部署场景 17/17、lint、typecheck、build、PowerShell AST、POSIX解析和安全扫描；P-002 的后续纠正证据把部署矩阵扩展为 19/19，并完成真实首次接管、受管更新和零上传 no-op。P-003 没有伪称重跑这些未受本阶段修改影响的矩阵。

## 5. 发现项与处置

无开放 `FND-I-*`。验证结论为 `passed`，下一个可用初始 finding ID 仍为 `FND-I-001`，但 initial 冻结后不再分配。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无报告项 | 无 | — | 高 | 后续需求通过 change run 处理 |

## 6. 决策、计划偏差与恢复记录

- Q-011/Q-014 授权的两次精确候选 stop 均已消费；结果证明外部轮询或持久会话都不能把最后检查与 stop 同部署提交原子协调。两次失败是 core 计划偏差，不是 finding。
- Q-012 与 Q-015 只用于恢复可用性，不被当作自动回滚通过。Q-015 下第一个 stdin 封装 start 因服务参数解析失败且服务器零变化；独立规划后使用直接远端命令成功恢复。
- 用户扩大授权到 `home-table` 相关 Docker/数据，但同时禁止影响软路由和其他服务器内容。实施仍选择最小动作，没有破坏数据、删除卷、修改网络/路由/系统服务或重启主机。
- 最终故障候选是 detached 测试提交，不进入 main。它把故障放入受支持入口自身 health gate，消除了外部 stop 的竞态，同时直接验收 requirements 规定的“新健康失败自动回滚”。

## 7. 遗留风险与下一阶段进入条件

deployment-automation initial 无开放 finding、未决问题、半完成远端状态或未知用户文件。服务器当前为 b949 healthy 安全状态；真实配置和私钥未进入 Git 或发布归档。

本阶段结果与计划冻结。后续部署自动化需求必须使用新的 `change-N` 运行，不得改写 P-001/P-002/P-003 历史。
