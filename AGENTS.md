# AGENTS.md

本文件面向在本仓库中工作的自动化 agent。开始修改前，应先阅读本文件、根目录 `README.md`，以及与任务对应的 `docs/requirements/<feature>/` 工作流文档。本文中的“当前阶段”是带日期的快照；若工作流状态已经推进，以最新的 `execution-state.md` 和 Git 事实为准，并同步更新本节。

## 1. 项目是什么

### 产品定位

本项目是一个在可信家庭局域网内运行的、本地优先的双语聚会游戏平台。当前完整游戏包括德州扑克和 5–10 人原版阿瓦隆；平台同时提供可供后续狼人杀等游戏复用的账户、房间、赛季、积分、排行榜、实时同步和公共大屏能力。

核心使用流程是：

1. 玩家用手机或桌面浏览器通过用户名和头像免密码进入。
2. 玩家在大厅选择游戏并创建或加入房间；扑克以积分买入筹码，阿瓦隆按配置托管押分。
3. 服务端权威执行房间与游戏命令，并通过 HTTP/WebSocket 向不同角色投影状态。
4. 电视或桌面显示器可以匿名打开只读公共大屏，不占玩家名额。
5. SQLite 持久化账户、赛季、房间、牌局和资产流水；Docker 重启后恢复已确认状态。

### 设计目的

- 让家庭和朋友聚会只依赖一台局域网服务器与浏览器，不依赖公网、CDN、云数据库或第三方身份服务。
- 在简体中文和英文、手机触控和桌面鼠标键盘上提供一致体验。
- 同时支持“仅筹码”（线下实体牌）和“筹码＋牌”（服务端洗牌、发牌、判型和分池）两种德州扑克模式。
- 以可复用的平台边界承载后续游戏，而不是把所有能力耦合在扑克 UI 中。
- 即使在免密码的可信 LAN 模型下，也严格保证资产守恒、命令幂等、并发正确、隐藏牌隔离、只读大屏和崩溃恢复。

### 目标用户与信任边界

- 产品用户：同一家庭 LAN 中的聚会玩家，以及使用电视/显示器查看公开牌桌状态的人。
- 运维用户：从 Windows 工作站把项目部署到支持 Docker Compose 的 x86-64 iStoreOS 家庭服务器的项目维护者。
- 本项目没有互联网身份、密码、管理员后台或账户所有权验证，不得直接暴露到公网。
- “可信 LAN”只放宽登录身份模型，不放宽隐藏牌、资产、并发、持久化或恢复的正确性要求。

## 2. 当前开发阶段

阶段快照日期：`2026-08-01`。当前分支为 `main`；本快照已包含 `game-room-ui-and-poker-hand-start` change-3 收口工作区，精确提交身份与正式发布状态应以 `git rev-parse HEAD`、最新自动化部署输出和只读服务器事实为准。

### 已完成

- 核心 `home-party-game-platform` 首版已经实现并完成 initial、change-1、change-2。
- 账户、双语大厅、房间、赛季与排行榜、两种扑克模式、玩家端、公共大屏、SQLite 恢复、资产守恒和实时投影均已有代码与自动化测试。
- change-2 已通过，当前产品行为的权威快照是 `docs/requirements/home-party-game-platform/effective-requirements.md`；它包括结算时显示筹码增减和总筹码，以及结算层上方可用的补码 modal。
- `deployment-automation` 已完成 initial、P-001/P-002/P-003 和 `change-0.md`，当前权威快照为 `docs/requirements/deployment-automation/effective-requirements.md`。
- 部署自动化包含 PowerShell 5.1 本地入口、POSIX 远端状态机、Git HEAD 归档、SHA 镜像、冷备份、单目录/单备份、幂等 no-op、自动/人工恢复和文档；状态化假 SSH/Docker 部署矩阵最终为 19/19。
- 真实 iStoreOS 已通过新目录首次接管、受管更新、零上传 no-op 和确定健康失败自动回滚。`deployment-automation` initial 收口时服务器运行受管 Git `b9490b7f8137af2982bf494b1bc1c0005089f656` 对应服务，`home-table` running/healthy、非 root、外部 `/healthz` 200，固定卷与唯一备份安全且无部署临时状态；后续正式发布状态以最近一次自动化部署和只读检查为准。
- `poker-room-experience-upgrade` initial 已完成并冻结：房间成员/准备、面值、头像、主题、设置和移动牌桌体验已交付，全部本地、生产浏览器、容量和远端隔离 Docker 门禁通过。
- `platform-usability-and-data-management` initial 与 change-1 已完成并冻结：当前/未来赛季排行榜按真实参赛结果筛选，平台提供账户与历史赛季逐个/批量管理、资产退役和历史匿名化；扑克 complete 退出重进、移动下注、顶部控件、声音和友好错误体验已修复。change-1 进一步保证 complete 退出者立即从其他玩家和公共大屏的当前结算列表消失，并在牌桌/结算刷新或恢复时初始化正确扑克色板；strict red-first、lint、typecheck、platform 26/26、realtime 4/4、Chromium/WebKit 6/6、生产 build/静态资源和差异门禁通过。当前权威快照为 `docs/requirements/platform-usability-and-data-management/effective-requirements.md`。
- `admin-account-preferences-and-ui` initial 已完成并冻结：平台新增匿名直达管理员设置、账户/历史赛季集合管理、开放房间账户安全删除、两步登录、服务器权威语言/主题/音量偏好，以及固定容器、共享 SVG 和 portal 头像菜单。lint、typecheck、platform/server 29/29、poker 15/15、realtime 4/4、Chromium/WebKit 6/6、容量 4/4、生产构建/静态资源和真实 iStoreOS 隔离容器/浏览器门禁均通过；当前权威快照为 `docs/requirements/admin-account-preferences-and-ui/effective-requirements.md`。
- `avalon-game` initial 已完成并冻结：平台新增完整 5–10 人原版阿瓦隆、自动/手动认角色、原版与 Dized 奥伯伦、秘密投票/任务、刺杀、押分结算/作废、有符号安全积分，以及玩家/管理员/匿名 display 双语响应式 UI。lint、typecheck、Avalon 8/8、platform/server 37/37、poker 15/15、realtime 5/5、Chromium/WebKit 8/8、容量 4/4、生产构建/静态资源和真实 iStoreOS 随机隔离 Docker/浏览器门禁均通过；当前权威快照为 `docs/requirements/avalon-game/effective-requirements.md`。
- `avalon-game` change-1 已完成并冻结：大厅/加入信息层级、十点准备计、玩家卡私密覆盖与队长提名、准备/投票/行动/本人/队长状态、五任务规则常显和独立 Avalon 冷色主题已交付。lint、typecheck、realtime 5/5、生产 build/static、Chromium/WebKit 8/8、桌面与 300px 独立浏览器检查均通过；没有修改服务端规则、资产、SQLite、部署接口或正式服务器。
- `avalon-game` change-2 已完成并冻结：固定页移动端双层滚动已改为动态视口内唯一滚动区；“查看身份”统一强调全部玩家卡并保证本人精确角色，确认后按钮恢复次要样式；手机查看/操作保持左窄右宽双列；任务轨迹使用简化内容、放大票数和高对比结果色；提名区域呼吸提示、本人/队长语义色及 Avalon/Poker 长按/右键/键盘房主管理菜单已交付。lint、typecheck、realtime 5/5、生产 build/static、Chromium/WebKit 8/8、300px 动态视口、计算样式、几何和手势门禁均通过；没有修改服务端规则、投影、资产、SQLite、部署接口或正式服务器。
- `game-room-ui-and-poker-hand-start` initial 已完成并冻结：Poker 两种模式改为服务端权威的持久手动盲注与全员开手确认，每笔实际盲注和流水原子且幂等，部分进度、私牌和旧 JSON 可安全恢复；Poker/Avalon 已登录房间统一三段式顶栏，外部暂停/恢复/手动作废入口退役；Avalon 公开角色构成、Poker 按住私牌、本人回合 felt 缓存、无拖动筹码及 300px 双游戏布局已交付。lint、typecheck、platform/server/Avalon platform 40/40、Poker 17/17、Avalon 8/8、realtime 5/5、Chromium/WebKit 8/8、容量 4/4、生产 build/static 和真实 iStoreOS 隔离 Docker smoke 全部通过；当前权威快照为 `docs/requirements/game-room-ui-and-poker-hand-start/effective-requirements.md`。
- `game-room-ui-and-poker-hand-start` change-1 已完成并冻结：Poker 准备主面板移除外圈边框，玩家卡填充前景/头像右侧身份块/紧凑尺寸、全宽且按实际面值节点数动态等分的下注缓存、紧凑数量行及手机阴影安全区已交付；普通/游戏/管理员瞬时反馈统一为左上角最新在上、可关闭、约五秒自动消失的 toast。lint、typecheck、platform/server/Avalon platform 40/40、Poker 17/17、Avalon 8/8、realtime 5/5、capacity 4/4、生产 build/static、Chromium/WebKit 8/8、300px/16 面值几何与差异门禁全部通过；没有修改服务端规则、投影、资产、SQLite 或部署接口，当前权威快照仍为 `docs/requirements/game-room-ui-and-poker-hand-start/effective-requirements.md`。
- `game-room-ui-and-poker-hand-start` change-2 已完成并冻结：Poker 准备页已从共享顶栏下沿形成无外圈空白的贴边表面，等待/活动头像保持正圆；下注缓存少量面值从左按正常小间距排列，仅在轨道拥挤时均匀压缩；手机上方玩家卡精确恢复旧可见顶部距离和原横向 gap，并通过独立裁剪安全区与层级完整显示阴影、焦点和庄家标识。lint、typecheck、platform/server/Avalon platform 40/40、Poker 17/17、Avalon 8/8、realtime 5/5、capacity 4/4、生产 build/static、Chromium/WebKit 8/8、桌面/300px/3/16 面值几何与差异门禁全部通过；没有修改服务端规则、投影、资产、SQLite 或部署接口，当前权威快照为 `docs/requirements/game-room-ui-and-poker-hand-start/effective-requirements.md`。
- `game-room-ui-and-poker-hand-start` change-3 已完成并冻结：Poker 上方玩家卡已在手机与桌面统一为固定 top/left/gap 的横向 flex/scroll 轨道，卡宽连续增长且桌面上限约为手机的 1.36 倍；旧 760/600/520px grid/flex、间距和卡宽跳变已退役，独立裁剪安全区与层级继续完整容纳阴影、焦点和庄家标识。lint、typecheck、realtime 5/5、生产 build/static、Chromium/WebKit 8/8、1280/900/761/760/601/600/521/520/300px 几何与差异门禁全部通过；没有修改服务端规则、投影、资产、SQLite、部署接口或正式服务器，本轮没有提交/推送/部署授权；当前权威快照为 `docs/requirements/game-room-ui-and-poker-hand-start/effective-requirements.md`。

### 尚未完成或待执行

- 当前没有待恢复的 `platform-usability-and-data-management` initial 或 change-1 任务。2026-07-30 只读检查确认正式 `home-table` 运行 healthy 的 Git `b131a4c35ec952180beed575e274b9cb27cbccd8` 镜像；后续正式发布状态以受支持部署入口的实际结果和只读服务器检查为准。
- 当前没有待恢复的 `deployment-automation` initial 任务。其三个 phase plan/result、完成状态、`change-0.md` 与有效需求已经冻结；未来部署自动化需求必须新建连续的 `change-N` 运行。
- 当前没有待恢复的 `admin-account-preferences-and-ui` initial 任务。其远端验收只使用随机隔离容器、卷、镜像、端口和临时归档，没有切换正式服务、固定卷、发布目录或唯一备份；正式发布仍需按受支持部署入口另行执行并以只读服务器事实为准。
- 当前没有待恢复的 `avalon-game` initial、change-1 或 change-2 任务。initial 远端验收只使用随机隔离容器、卷、镜像、端口和临时归档，且已全部清理；change-1 与 change-2 只执行本地验证。2026-07-31 收口时正式服务仍运行 Git `67e68cea036a41c38917e19936c27e3f7cd49f19` 对应 healthy 镜像，固定卷、发布标记、唯一备份和部署锁均未改变；阿瓦隆及两次 UI 变更尚未正式发布到 `home-table`。
- 当前没有待恢复的 `game-room-ui-and-poker-hand-start` initial、change-1、change-2 或 change-3 任务。initial 远端功能验收只使用明确归属的随机隔离容器、卷、镜像、端口和临时归档，且已全部清理；change-1/change-2/change-3 产品验收为本地生产浏览器与自动化门禁。change-3 仅形成已验证未提交工作区，未授权或执行提交、推送、正式发布；任何正式发布仍属于独立运维动作，其实际结果以最近一次受支持部署输出和只读服务器事实为准，不倒写为 change 阶段证据。

### 工作流文档规则

- 已完成产品的当前需求以 `effective-requirements.md` 为准；原始 `requirements.md` 和连续的 `change-N.md` 用于追溯。
- `phase-*-result.md`、已完成的 `change-N.md`、completed execution state 和已冻结阶段证据属于历史记录，不要为了配合新实现而改写。
- 新需求先检查对应 `workflow-contract.md`、`requirements.md`、`implementation-plan.md` 和 `execution/**/execution-state.md`。状态为 paused 或缺少计划时，先恢复/规划，不要跳到实现。
- 不要把另一个 feature 的改动、证据或提交归属到当前 feature；保留工作区中不属于当前任务的用户改动。

## 3. 技术架构

项目是 npm workspaces 管理的 TypeScript ESM 单仓库，主要数据流如下：

`React Web → Fastify HTTP/WebSocket → 服务命令分发 → PlatformDomain / Poker or Avalon engine → PlatformStore / SQLite`

- `apps/web`：React 19 + Vite 客户端。包含登录、大厅、设置、排行榜、房间、牌桌和公共大屏。
- `apps/server`：Fastify 5 服务端。提供静态资源、REST、WebSocket、角色投影、控制租约、定时推进和命令分发。
- `packages/contracts`：前后端共享类型、Zod 命令信封、状态与投影契约，以及私牌泄漏断言。
- `packages/domain`：平台聚合根和业务不变量，负责账户、赛季、房间、资产与命令语义。
- `packages/poker`：纯德州扑克状态机，负责发牌、合法动作、边池、结算、撤销和牌型计算。
- `packages/avalon`：纯阿瓦隆状态机，负责人数规则、角色与知识、夜间流程、提名、投票、任务、刺杀和终局。
- `packages/persistence`：SQLite 存储、迁移、WAL 模式、事务与幂等命令结果。
- `packages/test-support`：测试默认配置、命令构造器和临时数据库辅助函数，不属于生产运行时功能。

TypeScript 路径别名为 `@party/contracts`、`@party/domain`、`@party/persistence`、`@party/poker`、`@party/avalon` 和 `@party/test-support`，直接指向各包的 `src/index.ts`。

实现时必须保持以下不变量：

- 服务端是房间、牌局、资产和权限的唯一权威；客户端动画和缓存不能决定业务状态。
- 同一赛季内，账户积分、阿瓦隆托管押分、桌上筹码、下注和底池只允许通过已记录的原子转移改变，总量必须守恒；账户积分允许为负，游戏资产和转移金额不得为负。
- 重复、过期或并发命令不能造成二次下注、二次兑换、负数或部分提交。
- 进行中和非真实摊牌的私牌，以及活动阿瓦隆的角色、知识、未公开投票、任务选择和刺杀目标，只能进入本人有效控制租约允许的投影；房主、其他玩家、观众、大屏和普通日志都不能越权看到。
- 公共大屏保持匿名、只读、不占成员名额。
- 已确认状态必须能从 SQLite 恢复；连接状态和准备状态等易失信息在重启后安全重建。
- 修改共享契约时，应同时检查领域、持久化、服务投影、Web 类型使用和相关测试。
- 新增可见文案时同步维护简体中文与英文；新增交互同时考虑键盘、触控、300px 窄屏和 `focus-visible`。
- 构建后的 HTML/CSS 不得引用运行时公网资源。

## 4. 开发与自动化测试

### 本地前置条件

- Node.js `20.13+`（`package.json` 的最低约束为 Node 20）。
- npm 10+；使用 lockfile 安装：`npm ci`。
- Playwright 的 Chromium 和 WebKit，用于桌面与移动浏览器验证。
- 只有运行容器门禁时才需要可构建/运行 `linux/amd64` 的 Docker daemon。
- 部署脚本开发还需要 Windows PowerShell 5.1、Git、Windows OpenSSH；远端脚本使用 POSIX `sh`，不能假定 Bash 或 systemd。

仓库没有持续集成工作流；测试和发布门禁目前由本地命令执行。

### 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run lint` | ESLint 检查 TS、TSX、JS 和 MJS。 |
| `npm run typecheck` | 严格 TypeScript 检查，不生成文件。 |
| `npm run test:platform` | 运行平台领域、SQLite 边界和 Fastify 服务测试。 |
| `npm run test:poker` | 运行德州扑克状态机、动作、底池和结算测试。 |
| `npm run test:realtime` | 运行角色投影、私牌隔离、连接接管和实时并发测试。 |
| `npm run test:e2e:core` | 先生产构建，再用临时 SQLite 启动 `127.0.0.1:4173`，运行 Chromium 桌面与 WebKit 手机核心流程。 |
| `npm run verify:core` | 依次执行 lint、typecheck、platform、poker、realtime 和核心 E2E。 |
| `npm run test:capacity` | 验证约 15 个在线账户、1–2 个房间及大屏的目标容量。 |
| `npm run test:deploy` | 用临时 Git 仓库和状态化假 OpenSSH/Docker 运行 19 个部署状态机场景；不会连接服务器，也不会运行真实 Docker。 |
| `npm run build` | Vite 构建 `dist/web`、tsup 构建 `dist/server`，并检查静态资源无公网引用。 |
| `npm run test:docker-smoke` | 构建临时 `linux/amd64` 镜像，验证离线启动、非 root、healthcheck、命名卷持久化和容器重启恢复。 |

`npm test` 会收集所有 `tests/**/*.test.ts`，但部署测试的正式证据应使用已分组并设置时限的 `npm run test:deploy`，不要用一次长 Vitest worker 运行替代它。

### 按改动选择最小验证

- 契约、领域、持久化或服务命令：至少运行 lint、typecheck、`test:platform`；涉及扑克状态时加 `test:poker`。
- Web、投影、双语文本或响应式交互：加 `test:realtime` 和 `test:e2e:core`。
- 容量、房间隔离或广播行为：加 `test:capacity`。
- Dockerfile、启动环境、SQLite 卷或生产构建：运行 build，并在 Docker 可用时运行 `test:docker-smoke`。
- `deploy/**`、`.dockerignore` 或发布接口：运行 `test:deploy`、build 和脚本语法检查；真实服务器验收不能用本地模拟结果冒充。
- 完整候选发布通常依次运行：

```text
npm ci
npm run verify:core
npm run test:capacity
npm run test:deploy
npm run build
npm run test:docker-smoke
```

执行验证后检查 `git diff --check`。不要手工编辑 `dist/`、`node_modules/`、`.npm-cache/`、`test-results/` 或 `playwright-report/` 中的生成物。

## 5. 构建与部署知识

### 生产容器

- `Dockerfile` 是多阶段构建：构建阶段安装原生 SQLite 编译工具并执行生产构建，运行阶段只保留生产依赖和 `dist`。
- 运行镜像固定目标为 `linux/amd64`，当前基础镜像为 Node `24.18.0-bookworm-slim`。
- 容器以非 root 的 `node` 用户运行，监听 `0.0.0.0:3000`。
- 环境变量：`HOST`、`PORT`、`DATABASE_PATH`、`STATIC_ROOT`；默认数据库为 `/data/platform.sqlite`，默认静态目录为 `/app/dist/web`。
- `/healthz` 是 Docker 健康端点；`/data` 是唯一持久化挂载。
- Compose 服务名是 `home-table`，固定命名卷是 `home-party-game-platform-data`。

### 手工 Compose

在仓库 `deploy` 目录运行：

```text
PARTY_PORT=3000 docker compose up -d --build
docker compose ps
```

不要运行 `docker compose down -v`，不要删除或重建 `home-party-game-platform-data`；其中包含 SQLite 数据库和 WAL/SHM 文件。

### Windows 自动化部署

- 本地入口是 `deploy/deploy.ps1`，远端状态机是 `deploy/remote-deploy.sh`。
- 真实配置从 `deploy/deploy.config.example.psd1` 复制为被 Git 忽略的 `deploy/deploy.config.psd1`。不得提交、打印或把主机、用户、私钥路径和凭据写入工作流证据。
- 自动化只发布完全干净且已提交的 Git `HEAD`，归档来源是提交而不是工作区。
- 镜像以完整 Git SHA 标记；相同 SHA、匹配镜像且服务 healthy 时必须无副作用 no-op。
- 非 no-op 发布使用一个正式发布目录、固定命名卷和一个原子覆盖的固定数据库备份；永久状态不得累积临时发布目录、备份或回滚标签。
- 发布目录和备份目录必须是无空格、互不包含的绝对 POSIX 路径。
- SSH 保留主机密钥校验；支持密钥或用户终端中的交互密码，但脚本不保存密码。

真实部署会接触外部服务器、覆盖唯一备份和切换容器，必须有当前任务的明确授权。`deployment-automation` initial 已完成，不再按其冻结执行状态追加操作；普通后续发布应从新的干净提交按 `deploy/README.md` 使用受支持入口。当前服务器仍运行 b949，仓库后续新提交不是 no-op，部署前必须重新确认维护窗口、配置、clean worktree、固定卷/唯一备份和无遗留状态。首次接管前的旧 Docker/旧目录继续属于维护者外部资产，自动化不得进入、识别、启动、删除或修改。

失败或状态不明时，先做只读检查并遵循 `deploy/README.md` 和最新 `execution-state.md`。不得通过删除卷、删除固定备份、关闭 SSH 主机密钥检查或清理未知恢复现场来“恢复”。

## 6. 根目录文件与文件夹

### 文件夹

| 路径 | 作用 | 维护说明 |
| --- | --- | --- |
| `.git/` | Git 元数据、对象、索引和分支状态。 | 不手工编辑；不是产品源码。 |
| `.npm-cache/` | 本机 npm 下载缓存。 | 已忽略，可重建，不提交。 |
| `apps/` | 可运行应用工作区。 | `server/` 是 Fastify 后端；`web/` 是 React/Vite 前端。 |
| `deploy/` | Compose、Windows 部署入口、远端状态机、配置示例和运维文档。 | 真实配置被忽略；修改时优先运行 `test:deploy`。 |
| `dist/` | Web 与 server 的生产构建输出。 | 由 `npm run build` 生成，已忽略，不作为源码编辑。 |
| `docs/` | schema-v3.2 需求、路线图、执行状态、阶段结果和变更记录。 | 先判断文档是否为当前权威或冻结历史，再修改。 |
| `node_modules/` | 根 workspace 的 npm 依赖。 | 由 `npm ci` 生成，已忽略。 |
| `packages/` | 可复用领域包。 | 包含 contracts、domain、persistence、poker、test-support。 |
| `scripts/` | 本地构建/测试辅助脚本。 | `run-e2e.mjs` 编排生产 E2E；`verify-static-assets.mjs` 检查构建产物无公网资源。 |
| `test-results/` | Playwright 最近运行状态、trace 等测试产物。 | 已忽略，可重建，不提交。 |
| `tests/` | Vitest、Playwright E2E、Docker smoke 和部署自动化测试/夹具。 | 按被修改层选择相应套件。 |

运行后还可能出现被忽略的 `data/`（本地 SQLite）、`playwright-report/`（HTML 报告）和 `deploy/.deploy-local-*`（部署临时项）；它们也不是源码。

### 根目录文件

| 路径 | 作用 |
| --- | --- |
| `AGENTS.md` | agent 的项目背景、阶段、验证、部署和目录约定；阶段变化后应同步更新。 |
| `.dockerignore` | 限制 Docker 构建上下文，排除 Git、依赖、文档、测试产物、数据库、真实部署配置和临时发布状态。 |
| `.gitattributes` | 统一文本为 LF；Windows `.bat`/`.cmd` 保持 CRLF。 |
| `.gitignore` | 忽略依赖、缓存、构建、测试、SQLite、环境文件、真实部署配置和本地部署临时项。 |
| `debug.log` | 被忽略的本地调试日志，不作为正式证据或提交内容。 |
| `Dockerfile` | 构建并运行 Web + Fastify + SQLite 的 `linux/amd64` 生产镜像。 |
| `eslint.config.js` | ESLint flat config、TypeScript 和 React Hooks 规则及生成目录排除。 |
| `package-lock.json` | npm 依赖锁文件；依赖变化时与 `package.json` 一起提交。 |
| `package.json` | 根 workspace 清单、Node 约束、生产/开发依赖和全部构建测试脚本。 |
| `playwright.config.ts` | 核心 E2E 的目录、单 worker、基础 URL、trace、Chromium 桌面和 WebKit iPhone 项目。 |
| `README.md` | 项目入口说明、本地验证、信任边界和自动部署摘要。 |
| `tsconfig.json` | 严格 TypeScript 编译选项、DOM/ES2022 目标和 `@party/*` 路径别名。 |
| `vitest.config.ts` | 收集 `tests/**/*.test.ts` 并排除 Playwright E2E。 |

`debug.log` 是被忽略的本地生成物，不应作为正式证据、源码或提交内容。

## 7. 修改与交付约定

- 先检查 `git status`，保存并避开用户已有改动；不要擅自 reset、checkout、stash、删除或把无关改动混入当前任务。
- 优先修改源码和测试，不编辑生成物。依赖变化使用 npm 更新 lockfile。
- 保持 ESM、严格 TypeScript 和现有 workspace 边界；不要为了绕过类型错误扩大 `any` 或复制共享契约。
- 领域规则、资产变更、权限和私牌过滤放在服务端/领域层，不能只靠隐藏前端按钮。
- 日志可以记录拒绝原因、版本和非敏感标识，但不得记录私牌、密码、私钥内容或真实部署配置。
- 新运行时依赖、外部网络依赖、认证模型、数据迁移或部署数据处理都属于高影响变更，应先回到需求/计划确认。
- 交付说明应列出修改文件、实际运行的验证和未运行门禁；不要把模拟测试、构建成功或历史证据描述成新的真实服务器验收。
