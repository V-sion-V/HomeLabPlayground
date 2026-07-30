# P-001 阶段计划：完整阿瓦隆与有符号平台资产

- 运行编号：`initial`
- 阶段编号：`P-001`
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:7b27e53479b995e9aa5decb9a73f29f91ee015cd7ad9a7ec56765d14765b936d`
- 项目基线：`main@67e68cea036a41c38917e19936c27e3f7cd49f19`
- 创建日期：`2026-07-31`
- 详细程度：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

P-001 是唯一实现阶段，必须在一个可构建、可部署候选源码状态中完成：

- 全平台账户/赛季/排行榜有符号安全整数、正负发行/退役和扑克透支兼容；
- 独立阿瓦隆纯规则包、5–10 人配置、知识、夜间、投票、任务、刺杀和终局；
- Poker/Avalon 判别房间、设置、成员、结果、命令、SQLite 恢复、租约投影和删除事务；
- 大厅、管理员、等待/观战/玩家/结算、公共大屏、双语、主题、音量和 300px 体验；
- 全部本地硬门禁及用户授权的 `192.168.100.1` 隔离 Docker/浏览器验收。

关联范围为 FR-001–FR-058、AC-001–AC-031 和 NFR-001–NFR-012。扩展模块、机器人、
聊天/语音、永久回放、密码模型、部署状态机修改和正式 `home-table` 发布不在本阶段。

阶段包含三个有序任务。T1 退出门禁通过前不得接入可达的阿瓦隆服务命令；T2 权威和隐私
门禁通过前不得开放完整 Web 流程；T3 完成后直接执行最终门禁并收口 initial。

## 2. 任务与文件范围

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-001-T-001 | 有符号资产和纯阿瓦隆规则形成可独立验证的基础 | 新增 `packages/avalon/**`、`tests/avalon.test.ts`；`package.json`、`package-lock.json`、`tsconfig.json`；`packages/contracts/src/index.ts` 的独立 Avalon 类型；`packages/domain/src/index.ts`、`apps/server/src/app.ts` 与 platform/server/poker 测试中的有符号分数范围 | 新增 5–10 人规则/预设/知识/状态转换；统一安全整数检查、正负发行/退役和守恒；移除扑克余额门禁但保持游戏资产非负；暂不开放阿瓦隆房间 API | `npm run typecheck`、`npm run test:avalon`、`npm run test:platform`、`npm run test:poker` | 纯规则矩阵和有符号资产 core 通过；现有扑克可构建且回归通过；实际文件与证据写入 state |
| P-001-T-002 | 阿瓦隆成为平台、SQLite、Fastify 和 WebSocket 的服务器权威游戏 | `packages/contracts/src/index.ts`；`packages/domain/src/index.ts`；`packages/persistence/src/index.ts`（仅必要时）；`apps/server/src/app.ts`；`packages/test-support/src/index.ts`；`tests/platform.test.ts`、`tests/server.test.ts`、`tests/realtime.test.ts`、`tests/poker.test.ts`、`tests/avalon.test.ts` | 完成严格房间/投影判别；设置和旧快照归一化；成员准备/配置/开始/作废；完整命令、托管/派分/结果/删除；租约角色投影、日志过滤、幂等/并发/重启 | `npm run typecheck`、`npm run test:avalon`、`npm run test:platform`、`npm run test:poker`、`npm run test:realtime` | API/领域/恢复/秘密/事务全部 core 通过；无跨游戏写入、部分资产或越权秘密；实际文件与证据写入 state |
| P-001-T-003 | 玩家、管理员和 display 完成全流程，并通过最终本地与隔离 iStoreOS 验收 | `apps/web/src/main.tsx`；可新增 `apps/web/src/avalon-ui.tsx`；`apps/web/src/admin-ui.tsx`、`platform-ui.tsx`、`ui.tsx`、`locales.ts`、`styles.css`；`tests/e2e/core.spec.ts`、`tests/capacity.test.ts`、`tests/docker-smoke.mjs`；必要的回归测试；`AGENTS.md` 与本 feature 收口工件 | 游戏选择、阿瓦隆设置/自定义角色、准备、遮盖、夜间、提名、投票、任务、刺杀、结算和 display；双语/300px/可访问性；最终全门禁、远端随机资源验收和工作流收口 | `npm run verify:core`、`npm run test:avalon`、`npm run test:capacity`、`npm run build`、远端隔离 Docker smoke、浏览器技能临时端口验收、正式资源前后只读审计、`git diff --check` | 所有 core/硬门禁通过；supplemental 通过或只有合规 `FND-I-*`；远端随机资源清理且正式资源不变；可写 phase result、change-0 和 effective snapshot |

任务依赖：T2 依赖 T1；T3 依赖 T2。三个任务都完成前不得创建 phase result。

### 2.1 T1 文件所有权与接口

| 文件或区域 | 预期所有权 |
| --- | --- |
| `packages/avalon/src/index.ts` | 角色/阵营/阶段类型、人数表、默认预设、配置校验、知识、夜间步骤、状态创建与版本化转换；不得访问平台资产或 I/O。 |
| `packages/avalon/package.json`、根 workspace 配置 | 新私有 ESM workspace 和 `@party/avalon` 路径；新增单一 `test:avalon` 脚本，不引入公网运行时依赖。 |
| `packages/contracts/src/index.ts` | 先增加可共享的 Avalon 值/状态接口和游戏类型，不在 T1 强制迁移现有 Room 调用者。 |
| `packages/domain/src/index.ts` | checked integer、正负发行/退役、守恒汇总、排行榜比较、基础分、扑克买入/补码余额语义。 |
| `apps/server/src/app.ts` | 赛季基础分和金额 Zod 使用安全整数；暂不注册可达 Avalon 命令。 |
| T1 tests | 原版六人数矩阵、配置/知识/夜间/投票/任务/刺杀/版本；正负极值、发行/退役、扑克透支和回滚。 |

T1 暴露的纯引擎接口必须满足：

- 配置验证返回规范化的完整角色列表，不依赖客户端补位；
- 随机函数可注入以支持确定性测试，生产调用可使用加密随机来源；
- 所有状态转换接收 actor、payload 和 expected Avalon version，失败不修改输入；
- 公共历史从一开始就不保存任务选择与提交者映射；
- 知识函数按 viewer 和模式返回最小私有结果，不提供完整映射快捷投影。

### 2.2 T1 有序执行

1. 在任何产品编辑前把 execution state 更新为 `in_progress`、当前任务
   `P-001-T-001`，记录实际基线、目标范围和完成条件。
2. 建立 workspace/package/types，定义 5–10 人规则表、角色元数据、默认预设和配置校验。
3. 实现不可变或先克隆后提交的版本化状态转换：分配/确认、手动夜间推进/重启、提名、
   投票、任务、五次否决、刺杀和公开终局；覆盖 original/dized 奥伯伦知识差异。
4. 建立 checked arithmetic 和方向化外部流水，迁移基础分、排行榜、账户退役和不变量；
   删除扑克加入/补码余额检查，保留所有正数、时点、房间上限和游戏资产检查。
5. 增加 T1 测试并运行四项门禁。失败时保持任务 `in_progress` 并记录最小恢复动作；全部
   通过后写 durable post-task checkpoint，才允许开始 T2。

### 2.3 T2 文件所有权与接口

| 文件或区域 | 预期所有权 |
| --- | --- |
| `packages/contracts/src/index.ts` | 完成 Room/Config/Lobby/Projection/Result 判别联合、GlobalSettings.avalon、命令结果和秘密断言；扑克字段只在扑克分支。 |
| `packages/domain/src/index.ts` | 旧快照归一化、共享成员/准备/房主、阿瓦隆房间配置和生命周期、托管/派分/作废、结果/参与事实/删除、角色化投影和全局不变量。 |
| `packages/persistence/src/index.ts` | 默认复用现有事务；仅在故障注入证明 load/execute/recover 边界不足时做最小修改。 |
| `apps/server/src/app.ts` | 判别 Zod、创建/加入/配置/准备/开始、全部 Avalon 命令、系统恢复/房主超时、广播与安全日志。 |
| `packages/test-support/src/index.ts` | 显式扑克默认和 Avalon 测试构造器，避免模糊 RoomConfig。 |
| T2 tests | 服务端校验、事务/幂等/并发/故障、角色租约投影、观众/display/admin、重启、删除和扑克兼容。 |

T2 对外接口必须满足：

- `room.create`、`room.join`、ready/start payload 显式携带或由命令族唯一确定游戏判别，
  且服务端与目标房间再次比对；
- Avalon 写命令覆盖设置更新、配置、准备、开始、角色确认、夜间推进/重启、提名、投票、
  任务、刺杀、暂停/恢复、作废、退出/移除和恢复所需系统动作；
- 每个游戏写命令受 platform version、command ID、lease 和 Avalon version 约束；
- 玩家/观众/display/admin 投影是不同构造路径，不把完整 `AvalonGameState` 直接返回；
- 终局和作废结果、托管与资产变化在一个 `PlatformStore.execute()` 事务中完成。

### 2.4 T2 有序执行

1. 更新 state 当前任务为 T2，确认 T1 文件、门禁和 fingerprint 对应当前源码。
2. 完成契约判别联合并机械迁移扑克调用者；任何临时兼容别名只可保留合法 Poker 分支。
3. 为全局设置和旧快照增加 Avalon 默认归一化；二次恢复不得改变已规范化数据。
4. 在领域接入 Avalon 房间成员、准备、配置快照、开始托管、状态转换、暂停/作废、结算、
   参与事实、排行榜、历史/账户删除和房主超时安全关闭。
5. 在服务增加严格 Zod、命令 dispatch、平台/游戏双版本、租约和非敏感日志；公共广播只
   调用角色化 projection。
6. 增加 private leakage 断言和 T2 测试，覆盖每类 viewer、控制接管、断线、重启、重复/
   stale/并发、持久化失败、活动删除、正负极值和跨游戏拒绝。
7. 运行五项 T2 门禁；全部通过并写 post-task checkpoint 后才允许开始 T3。

### 2.5 T3 文件所有权与接口

| 文件或区域 | 预期所有权 |
| --- | --- |
| `apps/web/src/main.tsx` | 顶层按游戏选择 Room/Display 分支、Lobby 创建/加入判别和共享 session/command 边界；避免把完整 Avalon 页面继续堆入本文件。 |
| `apps/web/src/avalon-ui.tsx`（新增时） | Avalon 等待/配置/玩家/观众/display/结算组件、本地遮盖和草稿；只消费投影与发送命令。 |
| `apps/web/src/admin-ui.tsx` | Avalon 默认模式、奥伯伦、押分和 5–10 人预设编辑；一个原子设置保存。 |
| `apps/web/src/locales.ts` | 全部新增中英文角色、规则、步骤、状态、胜因、动作、错误和可访问名称。 |
| `apps/web/src/styles.css`、`ui.tsx`、`platform-ui.tsx` | Avalon 主题 scope/三段布局、十人/300px、固定容器、portal、排行榜负数和共享控件；不复制规则。 |
| E2E/capacity/Docker tests | Chromium/WebKit 全流程、遮盖/草稿、display、跨房容量、旧快照/重启和真实容器证据。 |
| `AGENTS.md` 与 feature 工件 | 仅在实现和最终证据成立后更新当前阶段并按合同收口。 |

### 2.6 T3 有序执行

1. 更新 state 当前任务为 T3，确认 T2 服务端/隐私证据仍有效。
2. 大厅和创建/加入 modal 按游戏判别；管理员增加 Avalon 设置卡和完整客户端提示。
3. 实现 Avalon 等待与局间配置、准备/确认未准备观战、成员/房主操作和开始。
4. 实现玩家三段页面、角色遮盖与自动隐藏、夜间步骤、队长提名、秘密投票、秘密任务、
   刺杀、暂停/恢复/作废和完整结算；权威版本变化清空本地草稿。
5. 实现观战和 display 公共分支；活动秘密零渲染，手动夜间和完整结算按要求公开。
6. 补齐中英文、主题、音量、300px、键盘/触控、`focus-visible` 和 reduced motion；
   扩展核心 E2E、capacity 和 Docker smoke。
7. 运行最终本地门禁；任何后续源码修复使相关证据失效时从最早受影响门禁重跑。
8. 读取浏览器技能并按其流程，在授权服务器使用随机隔离资源和临时端口完成 Docker/
   浏览器验收；前后只读比较正式资源并精确清理随机资源。
9. 运行最终差异、秘密、生成物和工作流一致性审计；满足完成定义后写 phase result、
   `change-0.md`、effective snapshot 和 completed state。

## 3. 验证与完成条件

### 3.1 分类与阻塞规则

| 分类 | 覆盖 | 阻塞规则 |
| --- | --- | --- |
| core | AC-001–AC-027；全部 FR/NFR 的可交付行为；资产、秘密、并发、恢复、兼容、双语、300px 和正式资源保护 | 任一失败、未知影响或缺少独立证据都阻塞。 |
| 项目硬门禁 | lint、typecheck、platform/server、poker、avalon、realtime、Chromium/WebKit E2E、capacity、build/static、隔离 Docker、正式资源不变、`git diff --check` | 任一失败或证据不对应最终源码都阻塞。 |
| supplemental | AC-028 浏览器差异、AC-029 容量体验、AC-030 日志深度、AC-031 独立视觉审阅 | `relaxed` 下只有证明不影响 core、数据、隐私、安全、兼容、构建、恢复或正式资源时才可保留 `FND-I-*`。 |

下一可用 finding 编号：`FND-I-001`。不得在观察失败后降低验收层级。

### 3.2 T1 门禁

1. `npm run typecheck`
2. `npm run test:avalon`
3. `npm run test:platform`
4. `npm run test:poker`

T1 测试必须覆盖六个人数表、角色校验、知识、夜间、投票、任务阈值、连续否决、刺杀、
expected version，以及 signed safe integer、正/负发行/退役、排行榜和扑克透支。

### 3.3 T2 门禁

1. `npm run typecheck`
2. `npm run test:avalon`
3. `npm run test:platform`
4. `npm run test:poker`
5. `npm run test:realtime`

T2 测试必须覆盖跨游戏拒绝、设置原子性、成员/观战、押分托管/派分/作废、结果/删除、
幂等/并发/故障、安全整数、每类 viewer、lease 接管和 SQLite 重启。

### 3.4 最终本地门禁

1. `npm run verify:core`
2. `npm run test:avalon`
3. `npm run test:capacity`
4. `npm run build`
5. `git diff --check`

`verify:core` 已包含 lint、typecheck、platform/server、poker、realtime 和先 build 的
Chromium/WebKit E2E。显式再次运行 build 是 AC-027 的最终静态资源证据；若 E2E 后未
改动构建输入，可引用 E2E 内同一最终源码 build 而不重复。计划默认不运行 `test:deploy`；
实际 diff 触及部署接口时必须先修订本计划。

### 3.5 隔离 iStoreOS 与浏览器验收

1. 使用已忽略 SSH 配置或已授权连接访问 `192.168.100.1`；不得把用户、密钥、路径、
   凭据或业务数据写入证据。
2. 先只读记录正式 `home-table` 容器 ID、镜像和健康，以及固定卷存在性和已知发布标识；
   不读取 SQLite 内容。
3. 使用本次随机前缀的镜像、容器、卷、临时归档和空闲端口运行更新后的 Docker smoke；
   禁止使用正式容器、固定卷、发布目录或唯一备份。
4. 在隔离卷验证 `linux/amd64`、无公网运行、非 root、health、旧快照默认补齐、有符号
   数据、活动 Avalon 角色/票/任务/托管恢复和租约清除。
5. 保留一个随机临时容器供浏览器技能访问，验证管理员设置、大厅创建/加入、自动和手动
   认角色、遮盖、投票、任务、刺杀、结算、display、负分和 300px 核心流程。
6. 成功后只删除能由随机前缀精确证明归属的资源，再次只读比较正式资源。归属或清理不确定
   时设置 `paused` 并保留现场，不扩大删除范围。

该证据只说明候选在真实 iStoreOS 环境隔离运行，不表示正式发布。

### 3.6 阶段完成定义

P-001 只有同时满足以下条件才能完成：

1. T1–T3 都有 durable post-task checkpoint，累计文件可由本计划解释。
2. FR-001–FR-058、AC-001–AC-027、NFR-001–NFR-012 和全部项目硬门禁在最终源码通过。
3. 没有 unresolved、critical/high finding、未知影响、数据/隐私/安全/兼容/构建/恢复
   问题或远端残留。
4. AC-028–AC-031 通过，或仅以连续 `FND-I-*` 保留有独立无交付影响证据的异常。
5. 扑克、Avalon、大厅、管理员、观众和 display 判别正确；活动秘密只进入本人有效 lease。
6. 账户/游戏/外部发行退役守恒，所有值安全且游戏资产非负；作废、删除和失败无部分提交。
7. 正式 `home-table`、固定卷、发布目录和唯一备份未改变；隔离验收没有冒充正式发布。
8. `phase-001-result.md`、`change-0.md`、`effective-requirements.md` 和 completed state
   按合同一致生成。

## 4. 风险、恢复与修订记录

### 4.1 风险检查点

| 风险 | 执行检查点 |
| --- | --- |
| 极值算术先修改后溢出 | 所有加减先 checked；Store 故障/极值测试比较完整提交前后快照。 |
| T1 类型提前破坏现有 Poker | T1 只加独立 Avalon 类型，Room 判别迁移留到 T2；每个任务都要求 typecheck 和 poker。 |
| T2 临时投影泄漏原始状态 | 先建立领域投影和泄漏断言，再注册可达命令；所有 WebSocket/HTTP 路径只消费 projection。 |
| 活动删除或无房主候选孤立托管 | 同一事务先作废退款，再移除/转让/退役；失败注入和守恒测试阻塞。 |
| 公开历史关联任务选择者 | 公共记录只保存汇总；测试随机提交顺序并比较投影长度、字段和日志。 |
| UI 草稿在权威版本变化后误提交 | 草稿绑定 `avalonVersion`/phase，投影变化立即清空并提示；服务端 stale 仍是最终防线。 |
| 远端清理误删正式资源 | 随机前缀、精确 ID/label/inspect、前后只读比较；无法证明归属就保留并暂停。 |

### 4.2 恢复与回滚

- `execution-state.md` 是协调权威；不得用 reset、checkout、stash 或删除用户文件恢复。
- 任一任务中断时保留当前 diff，记录活动任务、实际文件、最后有效测试和最小下一动作。
  没有 post-task checkpoint 的任务继续视为 incomplete。
- T1/T2 JSON 兼容只在临时数据库验证；正式数据不运行候选。未来若正式升级后写入负分或
  Avalon 状态，降级必须恢复升级前完整 SQLite 备份，不能让旧镜像直接解释新状态。
- 远端失败只处理已记录且由随机前缀证明归属的资源；未知容器、卷、正式备份和恢复状态
  保持原状。

### 4.3 精确恢复步骤

从当前 `ready` 状态开始：

1. 读取 `execution-state.md`，确认 run `initial`、P-001 `ready`、当前任务“无”。
2. 重新核对 requirements/roadmap/phase-plan 指纹与 `git status`；本功能输入和规划工件
   应是唯一未跟踪范围。
3. 把 state 更新为 `in_progress`、阶段 P-001、任务 `P-001-T-001`，记录目标文件和
   T1 完成条件。
4. 只执行 T1；不得在同一未完成检查点开始 T2。

### 4.4 修订记录

| 修订 | 日期 | 结论与依据 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-31 | 初次 just-in-time 计划。expanded 细节用于有符号资产、秘密投影、活动删除和恢复风险；三个任务在唯一阶段内保持同步发布。 | 建立 T1–T3 顺序、文件所有权、门禁、远端隔离和恢复规则。 |
