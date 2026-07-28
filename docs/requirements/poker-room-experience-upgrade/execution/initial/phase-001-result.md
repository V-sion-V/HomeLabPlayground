# P-001 阶段结果：房间权威能力、动态配置与完整 Web 体验

- 运行编号：`initial`
- 阶段编号：`P-001`
- 阶段计划：[phase-001-plan.md](phase-001-plan.md)
- 阶段计划修订：`4`
- 父路线图修订：`1`
- 开始基线：干净的 `main@b204ea246e4c0e9770893bc737c5c631838ff33f`
- 完成基线：`main@b204ea246e4c0e9770893bc737c5c631838ff33f` 加本结果第 3 节列出的未提交工作树差异
- 完成日期：`2026-07-28`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 阶段目标与结果

P-001 在一个展开阶段内完成了全部首次实现。房间现在以 `Room.seats` 保存全部带身份成员，以 `PokerState.players` 保存当前手参赛者；中途加入者先成为观众，使用与公共大屏相同的公开牌桌主体且不会获得私牌或行动能力。等待首局和完整结算都改为统一准备模型：房主自动参赛，至少一名在线、有筹码的非房主成员准备后，由房主显式开始；存在未准备成员时先二次确认，未准备成员保留买入并进入观众席。

房主可从成员头像菜单转让或确认踢出成员，也可在顶部确认退出；服务端在同一事务中处理强制弃牌、已投入筹码保留、剩余筹码兑换和随机在线继任者，没有候选时安全关闭并退款。退出和关闭入口已移动到返回大厅右侧。

全局扑克设置新增 1–16 个合法筹码面值并持久化到现有 SQLite JSON 快照；活动手牌保存不可变面值快照，完整结算后切换到最新全局值。共享产品配置集中定义 32 个可选头像、不可选回退头像、主界面/扑克界面各自的亮暗主题语义令牌、花色和筹码色板。设置窗口、可访问下拉、折叠卡片、数字输入、主题、交互反馈、操作区和有界筹码计数均已完成双语桌面/移动集成。

最终本地分层、生产浏览器、容量与静态门禁全部通过。由于工作站没有 Docker daemon，用户授权通过既有 SSH 配置连接 iStoreOS 的远程 Docker daemon；同一 `npm run test:docker-smoke` 在随机临时资源中完成 `linux/amd64` 冷构建、离线启动、非 root、健康、命名卷牌局/私牌恢复和重启归一化验证。正式服务和固定数据卷在前后只读检查中保持不变。

## 2. 任务、需求与验收覆盖

| 任务 | 完成结果 | 需求范围 | 主要证据 |
| --- | --- | --- | --- |
| P-001-T-001 | 完成 | FR-001–FR-011、FR-017–FR-020；资产、隐私、恢复与并发 NFR | typecheck；platform/server 20/20；poker 15/15；realtime 3/3 |
| P-001-T-002 | 完成 | FR-001–FR-021 的 Web、双语、响应式、主题、设置、观战和最终集成 | lint；生产 Chromium/WebKit 4/4；capacity 3/3；远端 Docker smoke；diff 门禁 |

| 验收 | 层级 | 通过证据 |
| --- | --- | --- |
| AC-001–AC-004 | core | server/platform 与生产 E2E 覆盖头像成员菜单、二次确认、在线牌中踢出、房主退出/随机转让及顶栏操作 |
| AC-005–AC-006 | core | domain/server/poker 覆盖面值校验、旧快照补齐、原子持久化和每手快照；E2E 覆盖设置编辑；Docker 覆盖重启恢复 |
| AC-007–AC-009 | core | server/realtime/E2E 覆盖活动牌局加入、公共大屏级观战、结算后准备、10 人统一名额和未参赛买入退回 |
| AC-010–AC-012 | core | server/E2E 覆盖方案 A、准备/取消、房主显式开始、未准备确认、版本重新校验和重启清除易失准备 |
| AC-013–AC-017 | core | Chromium/WebKit 覆盖固定设置外框、内部滚动、默认折叠、风格化 listbox、卡片、反馈及操作区布局 |
| AC-018–AC-021 | core | 共享配置与生产 E2E 覆盖设备主题持久化、主界面/扑克配色分离、32 个头像、回退修复、双语和键盘/触控 |
| AC-022–AC-023 | core | platform/server/poker/realtime、capacity、生产 build 和远端 Docker smoke 覆盖幂等、资产、私牌、恢复及发布硬门禁 |
| AC-024–AC-026 | supplemental | Chromium/WebKit、结构化拒绝日志、15 账户/两房间容量与有界面值投影通过；无保留异常 |

全部 `FR-001`–`FR-021`、`AC-001`–`AC-026` 与 `NFR-001`–`NFR-011` 已覆盖，没有验收降级、用户豁免或开放报告项。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/contracts/src/product-config.ts` | add | 集中定义并校验头像、回退头像、四套主题语义令牌、花色和筹码配置 |
| `packages/contracts/src/index.ts` | modify | 扩展全局面值、每手快照、waiting 准备、成员角色和 viewer 投影契约 |
| `packages/domain/src/index.ts` | modify | 实现旧状态归一化、面值校验、头像修复、活动加入、准备、成员生命周期、资产与角色投影 |
| `packages/poker/src/index.ts` | modify | 在活动扑克状态中保存独立的每手面值快照 |
| `apps/server/src/app.ts` | modify | 扩展命令 schema 与分发，实现显式开手、在线踢出、房主退出/随机转让及观众授权 |
| `apps/web/src/ui.tsx` | add | 提供主题切换、可访问 listbox、折叠卡片与确认对话框 |
| `apps/web/src/main.tsx` | modify | 集成动态配置、房主管理、顶栏操作、统一准备、观战、设置、主题与有界筹码计数 |
| `apps/web/src/styles.css` | modify | 增加语义主题、固定设置窗口、内部滚动、卡片、控件反馈、300px 和减少动态效果样式 |
| `apps/web/src/locales.ts`、`apps/web/index.html` | modify | 增加中英文文案并移除固定绿色主题元数据 |
| `tests/platform.test.ts`、`tests/server.test.ts`、`tests/poker.test.ts`、`tests/realtime.test.ts` | modify | 覆盖迁移、设置、成员角色、准备、管理命令、资产、并发和私牌隔离 |
| `tests/e2e/core.spec.ts`、`tests/capacity.test.ts` | modify | 覆盖 Chromium/WebKit 完整产品流程及 15 账户、两房间、多大屏容量 |
| `tests/docker-smoke.mjs` | modify | 适配方案 A 准备语义，并允许通过 `DOCKER_SMOKE_HOST` 访问远端随机发布端口 |
| `Dockerfile` | modify | 为 legacy builder 声明既有 `linux/amd64` 构建平台默认值，BuildKit 仍可覆盖 |
| `AGENTS.md` | modify | 同步带日期的当前功能阶段快照 |
| `implementation-plan.md`、`execution/initial/phase-001-plan.md`、`execution/initial/execution-state.md` | add | 保存初始路线图、四次即时计划修订和可恢复执行证据 |
| `execution/initial/phase-001-result.md` | add | 冻结本阶段任务、文件、验证、偏差和风险结果 |

`requirements.md`、`workflow-contract.md`、`deploy/**`、`.dockerignore`、冻结的其他功能工作流和生成目录未修改。

## 4. 测试与验证

| 验证 | 观察结果 |
| --- | --- |
| `npm run lint` | 通过；Docker 修正后的最终工作树 ESLint 无错误 |
| `npm run typecheck` | 通过；最终 TypeScript 契约、服务和 Web 使用一致 |
| `npm run test:platform` | 通过：2 个文件、20/20 测试 |
| `npm run test:poker` | 通过：1 个文件、15/15 测试 |
| `npm run test:realtime` | 通过：1 个文件、3/3 测试；玩家、观众和 display 私牌隔离成立 |
| `npm run test:e2e:core` | 通过：生产 Chromium desktop 与 WebKit mobile 共 4/4；命令内部生产 build 与静态资源检查通过 |
| `npm run test:capacity` | 通过：1 个文件、3/3；15 账户、两房间、多 display 无串房或私牌泄漏 |
| `npm run test:docker-smoke` | 通过：临时 Docker CLI 29.6.2 通过 SSH 连接 iStoreOS Docker 27.3.1 / API 1.47 / amd64；当前工作树冷构建成功，`--network none` 健康、非 root、随机命名卷牌局与本人私牌跨容器重启保持，连接恢复为离线 |
| Docker 前后资源审计 | 通过：正式 `deploy-home-table-1` 始终运行原 b949 镜像且 healthy；固定 `home-party-game-platform-data` 存在；smoke 容器、卷和镜像标签全部为空 |
| `git diff --check` | 通过；无空白错误 |
| 最终差异审计 | 通过；实际变更均可由 P-001 解释，没有进入 `deploy/**`、冻结历史或生成目录 |

本机 npm 在成功命令后仍报告无法扫描用户级日志目录的 `EPERM` 警告；命令退出码、测试和构建产物均未受影响，因此不构成 finding。

## 5. 发现项与处置

无 `FND-I-*` 报告项。下一个可分配编号仍为 `FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

## 6. 决策、计划偏差与恢复记录

- 保持用户选择的 `relaxed` 策略；所有 core、项目硬门禁和三个 supplemental 验收实际均通过，未使用 `passed_with_findings`。
- 需求中的准备歧义采用用户明确选择的方案 A：房主始终自动参赛，房主加至少一名有效已准备玩家即可开手；其余批准项使用需求文档中的默认值。
- 阶段计划修订 2 把不存在的 `tests/docker-smoke.test.ts` 更正为仓库实际 `tests/docker-smoke.mjs`，不改变验证范围。
- 扩展 E2E 首次暴露牌桌成员菜单被底部操作区拦截指针事件；修复菜单定位并重跑 Chromium/WebKit 后通过。
- T2 为保持结算阶段成员角色连续性回改 `packages/domain/src/index.ts`；随后重跑 typecheck、platform 与 realtime，证据来自最终源码状态。
- 本机没有 Docker CLI/daemon，初次本地 smoke 按硬门禁暂停。用户随后明确授权使用自动化部署的 SSH 边界访问服务器 Docker；计划修订 3 采用更小的隔离 smoke 子集，没有切换正式服务。
- 第一次远端 smoke 在镜像构建第一步发现 daemon 使用 legacy builder，未注入 BuildKit 自动 `BUILDPLATFORM`。计划修订 4 在 Dockerfile 增加既有固定 `linux/amd64` 默认值；第二次同命令完成真实冷构建和全部断言。
- 临时官方 Docker CLI 从 Docker 官方 HTTPS 静态分发地址下载；归档长度、ZIP 完整性、版本与 SHA-256 `c790bfcc9e8b227173b20f04f4ddaae6e997eac6d4aeaf7a850e2874d9222944` 已记录。官方静态 `docker.exe` 未带 Authenticode 签名，因此没有把不存在的签名冒充验证结论。
- iStoreOS 到 Debian 镜像的冷下载较慢，但构建进程持续有网络/CPU 活动，最终没有超时、重试风暴或残留测试资源。

## 7. 遗留风险与下一阶段进入条件

没有阻止交付的遗留风险、未决产品问题或开放 finding。P-001 是初始路线图唯一阶段，不存在下一初始阶段。

本次验证没有发布或切换正式服务；生产部署仍应由已冻结的 `deployment-automation` 能力从干净、已提交的 Git HEAD 发起，并遵守维护窗口、固定卷、唯一备份和健康回滚约束。后续产品需求必须在 `change-0.md` 冻结后通过新的连续 `change-N` 运行进入，不得修改本计划或结果。
