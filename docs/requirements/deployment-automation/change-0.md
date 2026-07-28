# 家庭聚会游戏平台：部署自动化修改记录 0

- 修改编号：`0`
- 修改类型：`首次实现`
- 原始需求：[requirements.md](requirements.md)
- 初始路线图：[implementation-plan.md](implementation-plan.md)
- 完成执行状态：[execution/initial/execution-state.md](execution/initial/execution-state.md)
- 阶段计划：[phase-001](execution/initial/phase-001-plan.md)、[phase-002](execution/initial/phase-002-plan.md)、[phase-003](execution/initial/phase-003-plan.md)
- 阶段结果：[phase-001](execution/initial/phase-001-result.md)、[phase-002](execution/initial/phase-002-result.md)、[phase-003](execution/initial/phase-003-result.md)
- 完成基线：main `b9490b7f8137af2982bf494b1bc1c0005089f656` 加本次工作流收口文件；iStoreOS 当前运行 b949 healthy
- 完成日期：`2026-07-28`

## 1. 实现概述

首次实现交付了从 Windows PowerShell 5.1 到 x86-64 iStoreOS 的单命令发布自动化。入口只接受干净且已提交的 Git `HEAD`，使用系统 OpenSSH 上传经过哈希校验的 Git 归档，在远端 POSIX 状态机中完成互斥、SHA 镜像构建、冷备份、原子目录切换、Docker health、幂等 no-op、失败恢复和有界清理。

配置文件被 Git/Docker 忽略且不保存密码；固定卷 `home-party-game-platform-data` 永不删除，数据库备份目录只保留一个原子覆盖文件。已有受管版本失败时，旧应用和部署前 SQLite 数据库一体自动恢复；首次接管无旧版本时恢复数据库、停止失败服务并保留可诊断现场。配置目录之外的旧 Docker/旧目录保持维护者所有。

P-001 完成本地实现和确定性假远端故障矩阵；P-002 完成真实首次接管、Windows/OpenSSH no-op 边界与 Node 本地头文件纠正、受管更新和零上传 no-op；P-003 完成真实健康失败自动回滚。最终服务为 b949 running/healthy、非 root、外部 `/healthz` 200，固定卷、单目录、单备份和无临时状态全部通过。

## 2. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `deploy/deploy.ps1` | add | PowerShell 5.1 配置、预检、no-op、Git归档、SSH/SCP编排和退出码 |
| `deploy/remote-deploy.sh` | add | POSIX锁、构建、冷备份、切换、健康、回滚、中断/遗留恢复和清理 |
| `deploy/deploy.config.example.psd1` | add | 八个允许字段且无密码的配置示例 |
| `deploy/compose.yml` | modify | SHA镜像插值并保持服务、端口、healthcheck和固定卷 |
| `.gitignore`、`.dockerignore` | modify | 排除真实配置、部署标记和本地临时诊断 |
| `tests/deployment-automation.test.ts` | add | 真实生产脚本加受限假SSH/Docker的19场景矩阵 |
| `tests/fixtures/deployment-automation/**` | add | 捕获外部边界、模拟Compose/镜像/卷/数据库和故障 |
| `package.json` | modify | 增加有界分组`test:deploy`入口 |
| `deploy/README.md`、`README.md` | modify | 配置、认证、单备份、幂等、回滚、人工恢复与Git历史发布 |
| `Dockerfile` | modify | 原生依赖使用官方镜像内置Node头文件，避免额外下载 |
| `requirements.md`、`workflow-contract.md`、`implementation-plan.md` | add/modify | 保存schema3.2需求与六次路线图修订 |
| `execution/initial/**` | add | 保存三阶段计划、冻结结果、授权、失败和恢复证据 |
| `change-0.md`、`effective-requirements.md` | add | 冻结首次实现并生成当前需求权威快照 |

一次性 detached 故障候选 `02066597...` 只修改 Compose healthcheck，用于实机回滚验收；它没有进入 main、产品文件清单或最终服务器。

## 3. 需求、阶段与任务完成情况

- FR-001–FR-013、NFR-001–NFR-010 全部生效并满足。
- AC-001–AC-013、AC-015 共14项 core全部通过；AC-014 supplemental通过。
- 交付与验证策略为`relaxed`，最终结论为`passed`，无`FND-I-*`。
- P-001完成实现、本地故障矩阵与文档；P-002完成真实首次接管、纠正更新和零上传no-op；P-003完成真实自动回滚和工作流收口。
- 完成证据以三个不可变phase result为准；当前权威行为以[effective-requirements.md](effective-requirements.md)为准。

## 4. 测试与验证

- `npm run test:deploy`最终通过19/19；生产PowerShell/POSIX脚本在受限假外部边界中覆盖正常、no-op、并发、完整性、备份、健康、回滚、中断、强杀和首次接管。
- P-001阶段的lint、typecheck、生产build、PowerShell AST、POSIX `sh -n`、安全扫描和`git diff --check`通过。
- P-002在真实iStoreOS完成首次接管与新SHA受管更新；Docker build无`gyp http GET`，同SHA第二次命令在本地fast path零归档、零SCP、零远端状态机。
- P-003最终候选由入口自身health gate确定失败，部署非0自动恢复b949和部署前数据库；外部health、非root、固定卷、单备份、单目录和清理状态通过。
- 数据库与最终固定备份SHA-256均为`e805c4d2f9b6a3716f9760129c3cc33144023f108a11243460f9dcb036b7b88a`。

## 5. 与路线图及阶段计划的偏差

- 首次接管前两次构建受Docker Hub令牌EOF和Node头文件下载中止影响，均在备份/切换前安全恢复；Dockerfile后续改用基础镜像内置头文件。
- 原no-op探测在Windows PowerShell 5.1/OpenSSH参数封送中把`NOOP\n`变为`NOOPn`；修复为无引号/换行固定token并增加原生进程边界回归。
- P-003两次外部stop都与部署成功提交发生竞态；失败与服务恢复完整保留。最终改为detached确定失败healthcheck，由生产状态机自身同步检测并自动回滚。
- 验证封装曾出现BOM、iStoreOS不支持小数sleep、外层文案/正则误判和stdin服务参数问题；均由独立状态证据分类，没有把未知影响或失败core降级为finding。

## 6. 遗留事项

无开放`FND-I-*`、未决问题、半完成远端状态或交付阻塞。initial运行已冻结；后续需求使用新的`change-N`运行。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | 后续需求通过change run处理 |
