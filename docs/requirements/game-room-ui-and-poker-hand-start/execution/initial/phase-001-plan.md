# P-001 阶段计划：权威开手协议与统一房间体验

- 运行编号：`initial`
- 阶段编号：`P-001`
- 阶段计划修订：`1`
- 父路线图：[../../implementation-plan.md](../../implementation-plan.md)，修订 `1`
- 需求指纹：`sha256:ad5cdcf8d67fee30ddbc71f1ac1b381330a8a3a0d9881d978e22e065c8598351`
- 路线图指纹：`sha256:b70e050378d10735e824d6de4492f249fe8120db63dc539804dd719dd10f6fa2`
- 项目基线：`main@2f1901047ee0e23c2038544db7a7508a8d60aeef`
- 创建日期：`2026-07-31`
- 详细程度：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

P-001 交付本功能的完整集成结果：

1. 让两种 Poker 模式都以持久、权威、幂等的手动盲注与全员确认开始，并安全兼容旧手牌、
   旧 paused 房间、资产流水、断线、移除、关闭和重启。
2. 统一所有已登录 Poker/Avalon 房间顶栏，交付 Avalon 公开角色构成、准备布局和 300px
   双列玩家卡，同时取消面向用户的暂停/恢复/手动作废入口。
3. 交付 Poker 玩家待办/本人视觉、开手卡、私牌按住查看、felt 下注缓存、无拖动筹码交互
   和手机牌桌几何修复。
4. 在最终源码上通过全部 core/硬门禁，并使用用户授权的 `192.168.100.1` iStoreOS
   隔离资源验证候选容器和 SQLite 重启；不在阶段内切换正式服务。

阶段覆盖 `FR-001`–`FR-029`、`AC-001`–`AC-027` 和 `NFR-001`–`NFR-011`。
详细映射以父路线图第 7 节为准。

### 1.1 进入条件

- `requirements.md`、`workflow-contract.md` 和父路线图可读，需求/路线图指纹与本计划一致。
- Git 基线可追溯到 `2f1901047ee0e23c2038544db7a7508a8d60aeef`；工作区中只有用户
  提供的本功能需求/合同及本次新建的规划文件，没有与产品源码重叠的用户改动。
- initial 执行状态为 `ready`，P-001 是唯一 active 阶段，当前任务为“无”。
- 被 Git 忽略的真实部署配置可以在 T3 只读使用，但主机、用户、私钥、发布路径和凭据
  不得写入工作流证据或普通命令输出。

任一条件不成立时，先把执行状态设为 `paused` 并记录事实，不开始产品修改。

### 1.2 阶段边界

- 允许修改共享契约、Poker 引擎、平台领域、Fastify 服务、Web 通用/Poker/Avalon 视图、
  相关 Vitest/Playwright/capacity/Docker smoke 测试、`AGENTS.md` 阶段快照和本功能工作流。
- 不改变正式 `preflop` 以后下注/判型/分池规则，不改变 Avalon 游戏规则或秘密投影，不
  新增游戏、认证、管理员设置、SQL 业务表、运行时依赖或公网资源。
- 不修改 `packages/persistence/src/index.ts` 的事务接口、`packages/avalon` 规则实现、
  `Dockerfile`、`.dockerignore` 或 `deploy/**`。若证据表明其中任一区域必须修改，先暂停
  并修订计划，说明现有边界为何不足及新增门禁。
- T3 的远端候选验证只使用随机隔离容器/镜像/端口/卷；正式部署入口必须等 initial
  冻结并由后续独立运维动作调用。

## 2. 任务与文件范围

| 任务 | 依赖 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- | --- |
| P-001-T-001 | 无 | Poker 权威开手、流水、恢复与公开/私有投影在 UI 开放前成立 | `packages/contracts/src/index.ts`、`packages/poker/src/index.ts`、`packages/domain/src/index.ts`、`apps/server/src/app.ts`、poker/platform/server/realtime 测试 | 增加盲位、已下盲、已确认状态和两条命令；停止自动盲注；原子记账/推进；拒绝旧外部暂停/作废；兼容旧 JSON、移除、关闭和重启 | `npm run typecheck`、`npm run test:poker`、`npm run test:platform`、`npm run test:realtime` | 正常/短码/任意顺序/并发/重复/过期/故障、断线/移除/关闭/重启、旧手/paused、守恒和私牌隔离全部通过；尚未把 Web 任务标记完成 |
| P-001-T-002 | P-001-T-001 completed | 共用顶栏、Avalon 构成和 Poker 开手/私牌/缓存/移动体验完成 | `apps/web/src/ui.tsx`、`apps/web/src/main.tsx`、`apps/web/src/avalon-ui.tsx`、`apps/web/src/styles.css`、`apps/web/src/locales.ts`、`tests/e2e/core.spec.ts`、必要的 capacity/服务测试 | 抽取三段式顶栏；移除房内 display/暂停/作废；角色构成三处复用；开手卡和按住私牌；玩家卡语义；felt 缓存、无拖动和 300px 几何 | `npm run lint`、`npm run typecheck`、`npm run test:avalon` 及改变行为的目标 Playwright 项目/用例 | 双语、鼠标/键盘/触控、玩家/观众/display、长名称和 300px 核心路径通过；全部 UI 状态仍由权威投影驱动 |
| P-001-T-003 | P-001-T-002 completed | 最终候选门禁、隔离 iStoreOS 验收和 initial 收口完成 | 全部实际变更、`tests/capacity.test.ts`、`tests/docker-smoke.mjs`、`AGENTS.md`、本功能 result/state/change/effective 文件 | 在最终源码运行完整本地门禁，修复范围内问题；以随机远端资源验证生产容器/旧 JSON/开手重启；审计差异、finding 和追踪后冻结 | 第 3 节最终验证流 | 所有 core/硬门禁通过；supplemental 通过或合规记录；正式远端资源前后不变；阶段结果、change-0、有效需求和 completed state 一致 |

### 2.1 文件所有权和接口

| 文件或区域 | 任务所有权 | 目的与接口约束 |
| --- | --- | --- |
| `packages/contracts/src/index.ts` | T1 | 加法扩展 `PokerState` 和 `PokerRoomProjection` 的开手字段；不把私牌放入公开完成状态，不改变旧字段含义。 |
| `packages/poker/src/index.ts` | T1 | 唯一拥有盲位计算、固定盲注提交、确认门禁和进入 preflop；正式行动规则只做兼容适配。 |
| `packages/domain/src/index.ts` | T1 | 旧 JSON 归一化、不变量、公开/本人投影、重启与移除协调；不得通过前端隐藏补服务端规则。 |
| `apps/server/src/app.ts` | T1 | Zod、两条新命令、租约/事务/流水/广播和旧外部命令拒绝；不记录敏感 payload。 |
| `tests/poker.test.ts` | T1 | 引擎开手、短盲、顺序、待办、强制弃牌和正式规则回归。 |
| `tests/platform.test.ts`、`tests/server.test.ts` | T1 | 旧 JSON/paused、事务/重放/故障、盲注流水、移除/关闭/重启和资产守恒。 |
| `tests/realtime.test.ts` | T1 | 玩家/观众/display 的公开待办和本人底牌隔离、接管与并发。 |
| `apps/web/src/ui.tsx` | T2 | 通用三段式房间顶栏和必要的无业务浮层原语；不得导入 Poker/Avalon 状态机。 |
| `apps/web/src/avalon-ui.tsx` | T2 | 公开构成纯派生、准备/设置卡、房间名浮层、display 卡和双列成员；不得消费私有角色归属。 |
| `apps/web/src/main.tsx` | T2 | Poker waiting/player/spectator 顶栏、开手卡、私牌按住、玩家卡状态、felt 缓存和无拖动交互。 |
| `apps/web/src/styles.css`、`apps/web/src/locales.ts` | T2 | 统一层级、操作/本人语义色、双语、可访问、300px、筹码重叠和公共牌尺寸。 |
| `tests/e2e/core.spec.ts` | T2/T3 | 更新真实两人 Poker 流程为手动盲注/确认，覆盖 Avalon 构成、顶栏、私牌按住、无拖动和 300px 几何；Chromium/WebKit 同源。 |
| `tests/capacity.test.ts` | T3 | 15 账户、双房间、多 display、公开待办/构成隔离和有界投影；不复制 E2E。 |
| `tests/docker-smoke.mjs` | T3 | 在既有随机资源机制内补新开手持久化/重启和旧状态断言，保持本地/远端 daemon 兼容。 |
| `AGENTS.md` | T3 | 只在阶段事实推进后同步带日期快照；正式发布状态使用最近自动化/只读事实，不预写成功。 |

`packages/persistence/src/index.ts` 的 `PlatformStore.execute()` 已提供单命令事务、版本校验、
命令结果重放和回滚，预计无需修改；T1 必须用故障/重放证据证明它足以承载盲注状态与
流水。如果证据不成立，按阶段边界暂停修订，不能临时扩边。

### 2.2 T1 有序执行

1. 更新执行状态为 `in_progress`、当前任务 `P-001-T-001`，记录开始基线、文件范围、完成
   条件和计划验证。
2. 加法扩展契约：
   - 持久状态保存小盲/大盲账户、已提交盲注和开手确认集合；
   - 公开投影保存非秘密盲位/完成/待办字段；
   - 字段均可由旧快照安全补齐，`ownHoleCards` 仍为唯一本人牌面字段。
3. 重构 Poker 建手与转换：
   - 创建时冻结位置、面值、牌堆/底牌，不扣盲；
   - 实现固定盲注和确认，版本/阶段/角色/顺序/重复校验；
   - 最后一项完成时进入 preflop，短额大盲保留完整开局额；
   - `forceFold()` 在 blinds 安全重算待办/胜出/推进。
4. 在领域构造器补可重复旧 JSON 归一化和新状态不变量；旧 active/paused/complete 手不
   重新执行开手协议，重启只清易失连接。
5. 在服务层增加两条命令：
   - 盲注转换和实际 `table-to-pot` 流水同事务；
   - 确认无资产流水；
   - 普通下注在 blinds 被引擎拒绝；
   - 移除、关闭、主机退出和自动调度保持安全。
6. 从外部 schema/dispatch 移除 pause/resume/Avalon void，但保留领域内部安全方法。
   添加确定性拒绝、内部关闭/退款和旧 paused 关闭测试。
7. 更新 T1 测试并执行任务门禁。失败时保持 T1 `in_progress`，记录输出和最小下一动作；
   全部通过后才写 T1 completed 检查点并进入 T2。

### 2.3 T2 有序执行

1. 更新执行状态为当前任务 `P-001-T-002`，确认 T1 证据仍对应未被 Web 任务改变的服务
   状态。
2. 在 `ui.tsx` 建立共享房间顶栏，并接入 Poker waiting/player/spectator 和 Avalon：
   - 返回只切视图，离开/关闭沿用确认；
   - 中间显示房间名、游戏名和权威阶段；
   - 桌面图标+文字、手机圆形图标、长标题截断；
   - 房内 display、暂停、恢复、作废和当前用户身份全部移除。
3. 在 Avalon 建立公开角色构成派生/视图：
   - 准备期使用房主+在线 ready；active/complete 使用冻结参与人数；
   - preset/custom、少于五人、人数不匹配和重复计数双语；
   - 准备摘要、房间名浮层、display 静态卡复用；
   - 房主设置卡独立位于准备卡下方，300px 成员双列和菜单保持。
4. 在 Poker 接入开手公开/本人状态：
   - 玩家卡 action fill、自身 border、文字/ARIA；
   - 本人开手卡先提交盲注再确认线上/实体牌；
   - 牌桌删除常态私牌，增加按住查看层和全部安全覆盖事件；
   - spectator/display 只显示非秘密待办。
5. 重构下注缓存和手机 felt：
   - 缓存只在本人正式回合显示在 felt；
   - 删除 drag/drop 和指针拖动状态；
   - button 点击/触控/键盘、横向 pan、CSS 等距重叠和稳定高度；
   - 玩家轨道、庄家标识、焦点、公共牌和悬浮层在 300px 无页面横溢。
6. 同步双语文案和错误码，扩展 E2E/必要的服务断言；运行 T2 目标验证。失败时保留 T2
   `in_progress`，不得进入 T3。

### 2.4 T3 有序执行

1. 更新状态为 `P-001-T-003`，确认 T1/T2 都有 durable completed 检查点，清点实际差异
   与计划范围。
2. 在最终源码按 3.2 运行全部本地门禁；若修复改变先前已验证层，从最早受影响门禁重跑。
3. 读取 `deploy/README.md` 与忽略配置，确认 SSH/正式资源边界；在
   `192.168.100.1` 先只读记录正式容器镜像/健康、固定卷和发布标记。
4. 以脚本随机资源运行候选 Docker smoke，覆盖 linux/amd64、非 root、health、离线静态
   资源、旧 JSON、新 blinds/确认集合和容器重启；仅清理本次可证明归属的随机资源。
5. 再次只读比较正式资源；任何变化、残留或归属不明都阻塞阶段完成。
6. 运行 diff 检查，更新 `AGENTS.md` 阶段快照，汇总 AC/finding。所有完成定义满足后写
   `phase-001-result.md`、`change-0.md`、`effective-requirements.md` 并最后把执行状态
   设为 `completed`。

## 3. 验证与完成条件

### 3.1 验证分类和阻塞规则

| 分类 | 覆盖 | 阻塞规则 |
| --- | --- | --- |
| core | FR-001–FR-029 对应行为；AC-001–AC-025；盲注/确认权威、流水/守恒、旧状态、私牌/角色秘密、内部安全作废、双语与 300px 操作 | 任一失败、未知影响或未运行都阻塞。 |
| 项目硬门禁 | lint、typecheck、platform/server、poker、Avalon、realtime、E2E 内生产 build/静态资源、capacity、隔离 Docker smoke、正式远端资源不变、`git diff --check` | 任一失败或证据不对应最终源码都阻塞。 |
| supplemental | AC-026 容量/性能观察、AC-027 非核心视觉细节 | `relaxed` 下只有证明不影响 core、数据、安全、隐私、兼容、构建、恢复或正式资源后，才可用 `FND-I-*` 报告；否则阻塞。 |

下一可用 finding 编号：`FND-I-001`。不得在观察失败后降低验收层级。

### 3.2 最终验证流

T1/T2 任务门禁按任务表运行。T3 在最终源码状态保存一次最新有效的完整证据：

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test:platform`
4. `npm run test:poker`
5. `npm run test:avalon`
6. `npm run test:realtime`
7. `npm run test:e2e:core`
8. `npm run test:capacity`
9. 用户授权的隔离 `npm run test:docker-smoke`
10. `git diff --check`

`test:e2e:core` 内部生产 build/静态资源检查作为最终 build 证据；之后的 capacity、Docker
smoke 和 diff 检查不修改源码，因此不重复 `npm run build`。若第 7 项后修改源码，必须
从受影响的最早门禁重跑。

不运行 `npm run test:deploy`，因为计划不修改发布接口。后续正式部署会使用已经冻结并
提交的干净 HEAD；部署本身按 `deploy/README.md` 另行记录，不计入本阶段门禁。

### 3.3 隔离 iStoreOS 验证

1. 复用被 Git 忽略的本机配置或同等已批准 SSH 边界；命令和证据不得包含真实用户、私钥
   路径、密码或业务数据库内容。
2. 连接 `192.168.100.1` 后只读记录正式容器 ID/镜像/健康、固定卷存在性和发布 SHA；
   不读取 SQLite 业务行。
3. Docker smoke 使用脚本生成的随机容器、镜像标签、命名卷和端口。禁止使用
   `home-table`、`home-party-game-platform-data`、正式发布目录或固定备份。
4. 在隔离卷验证旧 JSON 归一化不会重扣/重发，新 blinds 的牌、盲注、确认集合和流水在
   重启后一致，以及非 root/health/静态资源语义。
5. 成功后仅清理本次随机前缀资源，再次只读比较正式资源。失败或清理不确定时把任务设为
   paused，保留可识别诊断，不扩大删除范围或转而正式部署。

该结果只证明候选版本在真实 iStoreOS Docker 环境隔离运行，不代表正式服务已发布。

### 3.4 阶段完成定义

P-001 只有同时满足以下条件才能完成：

1. T1、T2、T3 均有完成检查点，实际文件全部可由本计划解释。
2. 所有 core 和项目硬门禁在最终源码状态通过。
3. 没有 unresolved 用户问题、critical/high finding、未知影响、资产/隐私/安全/兼容/
   构建/恢复问题或远端残留。
4. supplemental 项通过，或以连续 `FND-I-*` 记录并有独立“无交付影响”证据。
5. 正式 preflop 后 Poker 规则、Avalon 规则、私牌/角色秘密、公共大屏只读和控制租约
   没有被放宽。
6. 正式 `home-table`、固定卷、发布目录和唯一备份在隔离测试前后不变；没有把隔离 smoke
   描述成发布。
7. `phase-001-result.md`、`change-0.md`、`effective-requirements.md` 和 completed
   execution state 按合同一致写入。

## 4. 风险、恢复与修订记录

### 4.1 风险检查点

| 风险 | 执行检查点 |
| --- | --- |
| 新状态字段与旧手冲突 | T1 在任何 UI 前覆盖旧 active/paused/complete JSON、重启和二次归一化；不得靠新建空数据库证明。 |
| 盲注状态/流水分离 | T1 故障注入、相同命令重放、不同重复、过期平台/Poker 版本和并发；ledger 与 `totalBet` 一一核对。 |
| 最后一项确认与移除竞争 | T1 同事务串行版本检查，覆盖 blinds 中移除盲位/非盲位、只剩一人和多人继续。 |
| 私牌 UI 残留 | T2 覆盖 pointer/touch/key release、cancel/leave、blur/hidden/offline、版本/房间/连接变化和 display 对照。 |
| 角色构成错误使用私有状态 | T2 派生函数参数只允许公开 config/人数；realtime 和源码依赖审计阻塞。 |
| 顶栏共用破坏权限/离房 | T2 组件只拥有展示和回调；server/E2E 分别验证 host/non-host、返回/离开/关闭。 |
| 拖动移除后触控失效 | T2 不保留任何 drag/pointer drag listener；WebKit 横滑、轻触和键盘分别验证。 |
| 300px 层级/裁剪回归 | T2/T3 计算样式、bounding box、document width 和唯一合法操作可达断言。 |
| 远端隔离资源残留 | T3 使用脚本返回的随机标识精确检查；无法证明归属时保留现场并暂停。 |

### 4.2 恢复与回滚

- 产品实现前后都以 `execution-state.md` 为协调权威；不得用 `git reset --hard`、checkout、
  stash 或删除用户文件恢复。
- 每个任务前先写 in-progress 检查点，后写实际文件/测试/偏差再标 completed。中断时保留
  当前 diff，按状态中的范围和精确下一步恢复，不根据聊天猜测。
- T1 失败不得通过删流水、重建数据库或自动确认绕过；测试数据库可重建，用户/正式数据
  不进入本地或隔离测试。
- T2 本机浮层或缓存状态无需迁移；出现状态残留时修复清理事件，不能扩大服务端秘密投影。
- 远端测试只清理本次随机资源；未知容器/卷/镜像、固定卷和唯一备份禁止删除。
- 正式部署不在本阶段。未来升级后若需降级，必须通过受支持自动化和升级前完整 SQLite
  备份，不能让旧镜像直接运行含活动新 blinds 状态的数据。

### 4.3 精确恢复步骤

从当前 `ready` 状态开始或在未开始任务时恢复：

1. 读取 `execution-state.md`，确认运行编号 `initial`、阶段 `P-001`、状态 `ready` 且当前
   任务为“无”。
2. 运行 `git rev-parse HEAD` 与 `git status --short`，核对
   `main@2f1901047ee0e23c2038544db7a7508a8d60aeef` 或识别后续用户改动，不把新增改动
   自动归入本任务。
3. 重新计算 `requirements.md` 与 `implementation-plan.md` SHA-256，分别匹配
   `ad5cdcf8…` 和 `b70e0503…`。
4. 确认本计划仍是唯一 phase plan，没有 `phase-001-result.md` 或 `change-0.md`。
5. 修改产品文件前先把 execution state 更新为 `in_progress`、当前任务
   `P-001-T-001`，记录 T1 文件范围、验证和完成条件。
6. 从 `packages/contracts/src/index.ts` 的加法字段及 `tests/poker.test.ts` 的建手断言
   开始 T1。

若在任务中断，按 execution state 最新任务范围、实际 diff 和测试证据恢复，不假定任务
完成。

### 4.4 修订记录

| 修订 | 日期 | 内容 |
| --- | --- | --- |
| 1 | 2026-07-31 | 根据路线图修订 1 创建唯一 P-001 展开计划；T1 建立权威开手/恢复/投影，T2 交付共用房间/Avalon/Poker Web，T3 完成最终门禁、隔离 iStoreOS 验收和 initial 收口。 |
