# 德州扑克房间体验与全局界面增强：实施路线图

## 1. 范围与执行模式

- 功能编号：`poker-room-experience-upgrade`
- 合同版本：`3.2`
- 需求文档：[requirements.md](requirements.md)
- 执行模式：`single`
- 详细程度：`expanded`
- 交付与验证策略：`relaxed`
- 路线图修订：`1`
- 需求指纹：`sha256:3e794909bca607258472ec356ff8218019a7f76aeccf65d03aceab64d872c00a`
- 项目基线：干净的 `main@b204ea246e4c0e9770893bc737c5c631838ff33f`
- 创建日期：`2026-07-28`

本功能使用一个阶段完成权威数据、服务命令、角色投影、Web 交互和最终验收。持久化变化是现有 JSON 快照的兼容性扩展，不需要 SQL 表迁移、双写窗口、外部审批或独立部署交接，因此没有足以拆分路线图阶段的产品边界。

选择 `expanded` 是因为同一阶段会改变持久化房间/手牌状态、资产相关成员生命周期、HTTP/WebSocket 公开兼容和隐藏牌投影边界。阶段内必须先完成服务端权威与兼容性归一化，再开放客户端牌中加入、观战和管理入口；该顺序是任务依赖和检查点，不是独立交付阶段。

`relaxed` 允许实现先于测试，但所有 `core` 验收、资产守恒、私牌隔离、幂等并发、旧 SQLite 恢复、构建性和项目硬门禁仍然阻塞阶段完成。只有证据证明不影响交付行为的 `supplemental` 异常可以使用稳定的 `FND-I-*` 编号报告保留。

## 2. 项目现状与全局实现依据

| 区域 | 当前事实 | 本功能的实现依据 |
| --- | --- | --- |
| 共享契约 | `Room.seats` 保存全部买入座位，`PokerState.players` 保存本手参赛者；`PokerState.readyAccountIds` 只支持结算准备；投影没有显式观看角色或动态面值。 | 保留既有 `seats`/`players` 分层，增加兼容字段与显式投影角色，不重命名冻结接口。 |
| 领域与资产 | `PlatformDomain` 在一个聚合根中处理房间、资产和投影；资产不变量已经把不在 `PokerState.players` 中的 `room.seats` 计入桌上总量。 | 牌中加入者可直接复用“成员在 `seats`、不在当前 `players`”的现有守恒路径。 |
| 持久化 | SQLite 只持久化 `platform_state.state_json`；服务启动调用 `recoverAfterRestart()`，领域构造器已有旧字段归一化。 | 新面值、首局准备和活动手牌快照使用加法式 JSON 归一化，无需新增 SQL migration。 |
| 服务命令 | `/api/command` 通过 Zod、控制租约、平台版本和 SQLite 事务分发；房主超时已使用 `randomInt` 从在线座位随机转让。 | 新加入、准备、开手、踢人和房主退出沿用同一幂等信封、事务和随机候选模式。 |
| 私牌投影 | `projectRoom()` 只给非 display 的当前账户投影自己的 `holeCards`；公共大屏不含私牌；WebSocket 按账户租约或 display 角色广播。 | 登录观众继续从同一公共数据投影派生，只在顶部增加身份化信息；自己的私牌只在当前手参赛时返回。 |
| 扑克状态机 | `forceFold()` 已能移除正在行动的玩家并继续行动；开手与下一手由 server 组合 `createPokerState()`。 | 在线踢出和房主牌中退出复用权威强制弃牌；下一手改为房主显式选择有效准备成员。 |
| Web 客户端 | `main.tsx` 内硬编码 8 个头像和 8 个面值；等待室直接开局，结算准备会自动开下一手；大屏、牌桌和设置已有可复用组件。 | 提取共享配置与通用 UI 组件，按服务器投影角色选择玩家或观战主体，不复制私牌逻辑。 |
| 视觉样式 | `styles.css` 的主界面和扑克界面共用绿色调色板，大量产品颜色为字面值；设置 modal 和原生 select 尚未满足新要求。 | 由类型化主题配置注入语义 CSS 变量，CSS 只消费令牌；花色预设保持独立映射。 |
| 测试 | platform/server/poker/realtime 覆盖资产、恢复、强制弃牌和私牌隔离；E2E 覆盖 Chromium/WebKit、设置、真实两人手牌和大屏；capacity 覆盖 15 账户/两房间。 | 在现有分层测试上增加成员角色、竞争、迁移、主题和观战路径，不新建平行测试框架。 |

需求文档记录的澄清起始提交是 `f671f71…`；当时工作树中的 change-2 与部署自动化内容现已提交，当前干净基线 `b204ea2…` 与本次检查到的产品事实一致。部署自动化工作流已经冻结，本功能不修改 `deploy/**` 或其证据。

## 3. 全局详细设计

### 3.1 组件和文件所有权

1. 在 `packages/contracts/src/product-config.ts` 新增源代码控制下的产品 UI 配置：
   - 至少 24 个可选头像和独立回退头像 `🙂`；
   - `main.light`、`main.dark`、`poker.light`、`poker.dark` 语义主题令牌；
   - 花色预设、动态筹码可用的视觉色板；
   - 编译期结构约束和运行时重复、空值、回退冲突检查。
2. `packages/contracts/src/index.ts` 继续作为前后端唯一共享入口，导出配置、面值、成员角色和投影契约。
3. `packages/domain/src/index.ts` 负责成员/参赛者划分、准备、面值归一化、头像修复、资产与投影不变量。
4. `apps/server/src/app.ts` 负责 Zod 输入、租约与房主授权、原子命令组合、房主随机转让、实时广播和服务错误。
5. `apps/web/src/ui.tsx` 承载可复用的主题状态/切换、风格化 listbox、确认 modal 和可访问折叠控件；`main.tsx` 保留产品流程和牌桌组合。
6. `apps/web/src/styles.css` 只通过语义变量表达产品调色板，并实现 modal、卡片、hover/active、触控和减少动态效果布局。

不新增第三方运行时依赖，不新增公网资源，不修改持久化表结构或部署接口。

### 3.2 权威数据模型与兼容迁移

- `Room.seats` 继续表示全部已买入、计入 10 人上限的房间成员；不引入第二套资产容器。
- `PokerState.players` 继续表示当前手参赛者。活动手牌中存在于 `Room.seats` 但不在 `PokerState.players` 的账户即为观众；该关系随 JSON 快照持久化并可恢复。
- 等待首局准备使用新增的房间级准备集合；完整结算准备继续使用现有 `PokerState.readyAccountIds`。服务命令与投影将二者归一成同一“准备/取消准备”语义，开手后清空相应集合。
- `GlobalSettings.poker.denominations` 保存规范化全局列表；活动 `PokerState.denominations` 保存本手快照。投影中的有效面值在活动手牌取快照，在 waiting/complete/void 取最新全局设置。
- `PublicSeatProjection` 增加显式参与角色；`RoomProjection` 增加当前 viewer 角色、有效面值和统一准备信息。现有字段保持加法兼容。
- 旧快照缺少全局面值时补齐 `[1,5,25,100,500,1000,5000,10000]`；旧活动手牌缺少快照时也使用该历史默认值，避免升级时改变未结算手牌。
- 房间级准备集合缺失时补空数组；服务重启继续清空所有准备和在线状态，但保留成员、当前参赛者、面值快照和资产。
- 当前账户头像不在配置列表时持久化为 `🙂`；历史赛季和手牌结果头像不遍历、不回写。
- 归一化通过现有 `recoverAfterRestart()` 事务保存；附加 JSON 字段可被旧代码忽略，回退不会需要删除表或转换数据库。

### 3.3 命令、状态转换与并发

- `room.join` 继续接收买入并原子转移资产，但允许 waiting、in_progress 和 paused。是否成为当前手参赛者只由开手事务决定，牌中加入永不修改当前 `PokerState.players`。
- 现有准备命令扩展为显式 `ready: boolean`，在 waiting 和 complete 两个合法窗口工作；旧客户端省略该字段时等价于 `true`。连接丢失会清除相应准备。
- `room.start` 同时处理首局和 complete 后下一手，并接受未准备成员确认标记。服务端在提交时重新校验房主、房间/手牌版本、在线状态、筹码和准备集合；房主加至少一名有效准备成员才建立手牌。
- 准备不再触发自动开手。开手事务确定参赛者、更新所有成员的桌上筹码、清空准备、建立面值快照、轮转庄家、记录盲注并推进房间/手牌版本。
- `room.remove` 允许房主移除在线或离线的非房主成员；当前参赛者先由扑克引擎强制弃牌，再由领域兑换未投入筹码和移除成员。
- `room.leave` 对普通当前手参赛者仍拒绝；观众可直接退款退出；房主退出由服务端在同一事务中强制弃牌/兑换并从执行时在线的其余成员中 `randomInt` 选新房主。没有候选时走现有 `closeRoom()` 作废退款路径。
- 所有状态变化继续使用命令 ID、平台期望版本、必要的 poker 版本和 SQLite 事务。确认 modal 只收集用户意图，服务端不信任客户端显示的名单。

### 3.4 投影、授权与实时数据流

- 领域先生成不含私牌的公共牌桌主体，再按 viewer 角色添加本人可见信息；公共大屏与登录观众共享该公共主体。
- 只有 `viewerAccountId` 同时属于当前 `PokerState.players` 且控制租约有效时，投影才包含 `ownHoleCards` 和玩家行动能力。
- 当前手参赛座位与观众成员在投影中显式区分；公共牌桌只渲染参赛座位，大厅人数与头像可以继续展示全部成员。
- WebSocket 的成员检查继续基于 `Room.seats`，因此观众能维持房间订阅；匿名 display 继续无账户、只读且不占名额。
- 被踢、退出或关闭时沿用 `room.left`/`room.closed` 广播；房主变更和准备变化通过普通权威投影同步。
- 服务端日志只记录命令类型、非敏感 ID、拒绝码和版本，不记录 hole cards、deck、配置凭据或无关私有数据。

### 3.5 Web 交互与视觉

- App 根级维护设备主题；无本地值时读取 `prefers-color-scheme`，显式切换写入本地存储并把 `main`/`poker` scope 的语义变量应用到当前根节点和文档背景。
- 登录、大厅、等待室、玩家牌桌、观战页和大屏在语言切换旁使用同一个主题按钮；`index.html` 不再固定绿色 `theme-color`，由当前主题同步。
- 观战页面复用公共牌桌/结算视觉主体，只替换顶部为本人身份与允许的导航、退出、语言、主题控件，不挂载下注、私牌或赢家选择控件。
- 头像点击打开键盘/触控可达的成员菜单；踢出、房主退出和关闭统一通过确认 modal 后提交。
- 顶部左侧排列返回大厅、退出和关闭；普通当前参赛者退出保持禁用，观众退出可用。
- 全局设置使用固定外框、固定标题/操作区和内部滚动内容；所有游戏卡片每次打开默认收起。德州扑克卡片用可访问展开控件和减少动态效果兼容动画。
- 使用自有无依赖 listbox 取代无法一致着色的原生 select，并保留标签、键盘导航、Esc、焦点恢复和触控。
- 数字输入隐藏微调箭头但保留 `inputmode`、范围校验和可读错误。
- 筹码缓存从“每枚筹码一个数组节点”调整为按面值计数的有界模型；自动跟注/全押只更新计数，渲染每种面值的代表筹码和数量，避免用户配置 `[1]` 时生成无界节点。
- hover 只在 `@media (hover: hover) and (pointer: fine)` 生效，所有设备保留 active，禁用与 focus-visible 语义独立。

### 3.6 错误、恢复、回退与运维

- 新增本地化错误覆盖无效面值、无效头像、需要未准备确认、观众/参赛者退出限制、准备资格和过期开手。
- 任一归一化或配置结构检查失败必须阻止受损状态运行；不得部分保存设置或账户修复。
- 持久化失败由现有 SQLite 事务回滚。实现不写独立数据迁移脚本，不触碰命名卷或部署备份。
- 代码回退时，旧服务忽略新增 JSON 字段；已回退为 `🙂` 的当前头像仍是旧代码可接受字符串。历史快照和资产无需逆向迁移。
- 当前服务器发布不在本功能执行授权内；阶段完成只产生本地代码与验证证据，不运行 `deploy/deploy.ps1` 或真实 iStoreOS 操作。

## 4. 阶段路线图

| 阶段 | 目标 | 关联需求与验收 | 前置阶段 | 退出条件 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| P-001 | 完成权威成员/准备/面值/头像/主题基础、全部 Web 体验及最终集成验收 | FR-001–FR-021；AC-001–AC-026 | 无 | 所有 core 与项目硬门禁通过；supplemental 通过或按 relaxed 合同以无交付影响的 `FND-I-*` 完整记录；项目保持可构建、可恢复、无私牌泄漏和资产偏差 | ready |

本路线图只有一个阶段。详细执行以 [execution/initial/phase-001-plan.md](execution/initial/phase-001-plan.md) 为准，不提前创建其他阶段计划。

## 5. 跨阶段依赖与不变量

虽然只有一个阶段，阶段内仍必须遵守以下顺序和不变量：

1. 服务端配置校验、成员/参赛者权威、面值快照和观众投影必须先于客户端开放新入口。
2. `Room.seats`、`PokerState.players`、准备集合和资产流水之间始终只有一个服务端权威解释；客户端不能用页面类型决定成员资格。
3. 任一检查点不得把观众加入当前 `PokerState.players`，也不得给观众、房主或 display 投影他人私牌。
4. 任一资产命令失败、重复或竞争时都必须完整回滚；房间不能短暂暴露无房主状态。
5. 旧数据库在客户端开始消费动态面值前必须能补齐全局值与活动手牌快照。
6. 花色预设与亮暗主题保持正交；主界面不能因主题重构回退到赌桌绿色。
7. 任务 T2 原则上只改 Web、文案和集成验证；若为修复问题回到 T1 的服务端文件，必须重新运行被影响的 T1 验证。
8. `deploy/**`、冻结的其他功能工作流、生成目录和真实服务器不属于本功能文件所有权。

## 6. 最终集成与整体验证流程

验证只在其结果最后仍有效的位置执行：

1. 服务端权威任务完成后运行 `npm run typecheck`、`npm run test:platform`、`npm run test:poker` 和 `npm run test:realtime`，验证契约、迁移、资产、强制弃牌、命令竞争和投影隐私。
2. Web 与集成任务完成后运行 `npm run lint` 和 `npm run typecheck`，覆盖最终全部源码。
3. 运行 `npm run test:e2e:core`；该命令自身执行生产 `npm run build`，随后在 Chromium 桌面和 WebKit 手机中验证真实设置、主题、准备、观战、管理和牌局流程，并承担静态资源无公网引用门禁。
4. 运行 `npm run test:capacity`，验证约 15 个账户、两房间、登录观众和多公共大屏不串房、不泄漏私牌。
5. 运行 `npm run test:docker-smoke`，验证新增 JSON 状态在 `linux/amd64`、非 root、命名卷重启路径中兼容恢复。Docker 不可用时这是 core/硬门禁阻塞，不能以本地模拟替代。
6. 最后运行 `git diff --check` 并核对实际修改未进入 `deploy/**`、生成目录或冻结历史。

不计划运行 `npm run test:deploy`，因为需求明确排除部署自动化且本阶段不得修改发布接口；若实际 diff 触及 `deploy/**`、`.dockerignore` 或部署命令接口，必须先修订计划并加入对应门禁。真实 iStoreOS 部署不在本阶段授权范围内。

## 7. 需求追踪矩阵

| 需求组 | 实现所有者 | 阶段/任务 | 验收与证据 |
| --- | --- | --- | --- |
| FR-001–FR-004 房主管理与顶部操作 | domain/server 权限与资产；Web 成员菜单、确认和顶栏 | P-001 / T1、T2 | AC-001–AC-004、AC-022；platform/server/poker + E2E |
| FR-005–FR-006 面值配置与每手快照 | shared config/contracts、domain 归一化、server schema、Web 面值编辑/缓存 | P-001 / T1、T2 | AC-005–AC-006、AC-022–AC-023、AC-026；platform/server/realtime + E2E/capacity/docker |
| FR-007–FR-009 牌中加入与观战 | Room/PokerState 分层、角色投影、Web 观战主体 | P-001 / T1、T2 | AC-007–AC-009、AC-012、AC-022–AC-023、AC-026；platform/server/realtime + E2E/capacity/docker |
| FR-010–FR-011 统一准备与显式开手 | room/poker 准备集合、版本化 start、Web 准备与确认 | P-001 / T1、T2 | AC-010–AC-012、AC-022–AC-023；platform/server/poker + E2E/docker |
| FR-012–FR-016 设置窗口、控件、卡片与反馈 | Web 通用 UI、settings 结构、CSS 交互媒体查询 | P-001 / T2 | AC-013–AC-017、AC-021、AC-024、AC-026；lint/typecheck + E2E/capacity |
| FR-017–FR-018 主题与配色分离 | shared theme tokens、Web device theme、CSS 变量、HTML theme-color | P-001 / T1、T2 | AC-018–AC-019、AC-021、AC-023–AC-024、AC-026；typecheck + E2E/build/capacity |
| FR-019–FR-021 头像、回退、本地化与可访问性 | shared avatar config、domain 修复/server 校验、Web 选择与双语组件 | P-001 / T1、T2 | AC-020–AC-025；platform/server + lint/E2E/docker |
| NFR-001–NFR-002、NFR-008–NFR-009 资产、隐私、恢复、并发 | domain/server/persistence path | P-001 / T1 | AC-002–AC-012、AC-022–AC-023；platform/poker/realtime/docker |
| NFR-003–NFR-007、NFR-010–NFR-011 响应式、配置、容量、本地化、离线、动效、日志 | shared config、Web/CSS、server logs、integration tests | P-001 / T1、T2 | AC-013–AC-026；lint/typecheck/E2E/capacity/docker |

所有 FR-001–FR-021 和 AC-001–AC-026 均映射到 P-001；没有孤立需求或未来未分配阶段。

## 8. 风险、技术决策与修订记录

### 8.1 风险

| 风险 | 严重程度 | 控制与门禁 |
| --- | --- | --- |
| 登录观众或房主收到非本人私牌 | critical | 公共主体先投影、仅当前参赛 viewer 添加 own cards；realtime/server/E2E 私牌断言为 core。 |
| 牌中加入、踢人或房主退出破坏资产守恒 | critical | 复用 seats/players 现有不变量和 SQLite 事务；竞争、重放、失败及重启覆盖为 core。 |
| 旧活动手牌在升级后面值改变或无法恢复 | high | 旧活动手补历史默认快照，等待/complete 才读取新全局值；platform/docker 恢复门禁。 |
| 显式准备改变现有下一手流程并造成半完成 UI | high | 同一阶段先实现服务端权威，再开放 UI；阶段只在完整 E2E 后完成。 |
| 配置或 CSS 仍散落硬编码颜色 | medium | 类型化语义令牌、运行时配置检查、CSS 字面色审计和主题 E2E。 |
| `[1]` 面值对大额自动拆分造成无界节点 | medium | 缓存按面值计数，DOM 按面值种类而不是筹码枚数增长；capacity/E2E 检查。 |
| 自定义 listbox 破坏键盘或移动交互 | medium | 无依赖 ARIA 组件，覆盖 Esc、焦点恢复、键盘和 WebKit 触控。 |
| Docker 或浏览器本地环境不可用 | medium | 属于 core 门禁时暂停并记录精确恢复步骤，不以模拟或历史证据冒充。 |

### 8.2 技术决策

| 决策 | 结论 | 依据 |
| --- | --- | --- |
| TD-001 | 保留 `Room.seats` 为全部带身份成员，使用 `PokerState.players` 表示当前参赛者。 | 当前不变量已正确计算非参赛座位资产，最小化迁移和接口破坏。 |
| TD-002 | 使用加法式 JSON 归一化，不新增 SQL schema migration。 | 全部业务状态已在单一 JSON 快照，启动恢复会事务保存归一化结果。 |
| TD-003 | waiting 与 complete 可使用不同存储集合，但通过同一准备命令和投影语义暴露。 | 保留现有 complete 数据兼容，同时支持首局准备并避免双写同一状态。 |
| TD-004 | 公共大屏与登录观众共享公共牌桌主体，身份化只在顶部和 viewer role。 | 满足“仅替换顶部”和私牌最小暴露原则。 |
| TD-005 | 主题和头像配置位于共享 contracts 包的独立配置模块，不引入新 workspace 或依赖。 | 前后端已经共同消费 `@party/contracts`，可保持单一来源。 |
| TD-006 | 自研最小可访问 listbox，不依赖原生 option 的受限样式，也不新增第三方组件库。 | 目标浏览器视觉一致、离线运行和依赖最小化要求。 |
| TD-007 | 单阶段、两任务；T1 服务端权威先于 T2 客户端集成。 | 没有独立产品交付边界，但存在必须保持的授权与迁移顺序。 |

### 8.3 修订记录

| 修订 | 日期 | 结论与原因 | 影响 |
| --- | --- | --- | --- |
| 1 | 2026-07-28 | 初次路线图。需求审计通过；选择 `single + expanded`，用两项有序任务完成兼容权威基础和完整客户端体验。 | 覆盖 FR-001–FR-021、AC-001–AC-026；创建 P-001 即时阶段计划。 |
