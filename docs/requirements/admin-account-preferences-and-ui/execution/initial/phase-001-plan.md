# P-001 阶段计划：管理员权威、账户偏好与统一界面

- 运行编号：`initial`
- 阶段编号：`P-001`
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 需求指纹：`sha256:2ea7aa29ee9e4149758016c1f72464f00420f4b639fbb5568a1fb566c01f22d4`
- 项目基线：`main@b131a4c35ec952180beed575e274b9cb27cbccd8`
- 创建日期：`2026-07-30`
- 详细程度：`expanded`
- 交付与验证策略：`relaxed`
- 验证结论：`pending`

## 1. 阶段目标、边界与关联需求

P-001 是唯一实现阶段。它必须在一个可发布的最终源码状态中完成：

- 账户语言、`light`/`dark` 和音量的服务器持久化、旧快照补齐、existing-only 进入与
  create-only 注册；
- 无需登录但受版本、幂等、Zod、事务和最小投影约束的管理员设置、账户和赛季边界；
- 开放房间内的账户集合删除、强制弃牌、投入留池、退款、房主转让/关闭、退役、匿名化和
  租约失效；
- `/admin`、二级管理路由、两步登录、账户设置、共享 SVG、固定滚动框和 body 顶层头像
  菜单；
- 全部本地门禁及用户授权的 `192.168.100.1` 隔离容器/浏览器验收。

关联范围为 FR-001–FR-036、AC-001–AC-024 和 NFR-001–NFR-012。正式 `home-table`
发布、密码/角色模型、新主题色板、扑克规则变化和部署脚本修改不在本阶段。

阶段只有两个有序任务。T1 退出门禁通过前不得开放管理员和新登录 UI；T2 完成后直接运行
最终集成门禁并收口 initial，不另建测试、文档或发布阶段。

## 2. 任务与文件范围

| 任务 | 结果 | 文件或范围 | 实现摘要 | 验证 | 完成条件 |
| --- | --- | --- | --- | --- | --- |
| P-001-T-001 | 账户偏好、匿名管理、集合删除和恢复成为服务端权威 | `packages/contracts/src/index.ts`；`packages/domain/src/index.ts`；`apps/server/src/app.ts`；必要时最小修改 `packages/persistence/src/index.ts`；`tests/platform.test.ts`、`tests/server.test.ts`、`tests/realtime.test.ts`、涉及强制弃牌时的 `tests/poker.test.ts` | 扩展账户/设置/管理契约；加法归一化旧 JSON；拆分查询、existing-only 和 create-only；扩展原子资料保存；建立最小管理投影和匿名命令；实现账户/赛季集合事务及房间退出编排；保留私牌、资产、租约、幂等和日志边界 | `npm run typecheck`、`npm run test:platform`、`npm run test:poker`、`npm run test:realtime` | 全部 T1 core 场景通过；没有 partial delete、重复退款、偏好泄漏或旧状态恢复失败；实际文件和证据已写入 execution state |
| P-001-T-002 | 管理员、登录/资料、账户偏好、统一固定容器和头像菜单在真实浏览器及隔离 iStoreOS 可用 | `apps/web/src/main.tsx`；新增或扩展 `apps/web/src/admin-ui.tsx`、`apps/web/src/platform-ui.tsx`；`apps/web/src/ui.tsx`、`styles.css`、`locales.ts`；`docs/ui-design-guidelines.md`；`tests/e2e/core.spec.ts`、`tests/capacity.test.ts`、`tests/docker-smoke.mjs`；必要的 T1 回归测试；收口时 `AGENTS.md` 与本 feature 工件 | 无依赖路径分流和 History API；管理员双列/二级页和复选批量流；两步登录、按需头像、原子资料偏好；App 主题/语言/音量；共享 SVG、固定 shell/scroll region、portal 锚定菜单；双语、300px、离线与设计文档 | `npm run verify:core`、`npm run test:capacity`、远端隔离 `npm run test:docker-smoke`、浏览器技能临时端口验收、正式资源前后只读审计、`git diff --check` | 所有 core/硬门禁通过；supplemental 通过或只有合规 `FND-I-*`；随机远端资源已精确清理且正式资源未变化；可写 phase result 和 initial 收口 |

任务依赖：`P-001-T-002` 依赖 `P-001-T-001` 的服务端门禁。两任务都完成前 P-001 不得生成
phase result。

### 2.1 T1 文件所有权和接口

| 文件或区域 | 预期所有权 |
| --- | --- |
| `packages/contracts/src/index.ts` | `Account` 偏好、`GlobalSettings.defaultTheme`、匿名管理投影/摘要、查询/注册/集合命令结果；不得向公开座位或 display 增加偏好。 |
| `packages/domain/src/index.ts` | 旧 JSON 归一化、只读用户名查找、create-only 创建、原子资料偏好、设置校验、目标集合校验、退役/匿名化、历史赛季集合和不变量。 |
| `apps/server/src/app.ts` | 查询/进入/注册 API，管理读取/命令 schema 与 dispatch，活动房间集合编排、广播、租约失效和非敏感日志。 |
| `packages/persistence/src/index.ts` | 默认不改；只有现有事务或 pre-store 空选择边界被确定性证据证明不足时才最小扩展。 |
| T1 tests | 领域、Fastify、SQLite 故障/重放、旧快照、私牌和 realtime 证据；测试只使用临时数据库。 |

T1 暴露的接口必须满足：

- username lookup 不创建、不租约；existing enter 不接受偏好；register create-only；
- profile 保存五项字段；admin projection 最小；admin command 无 lease 但必须有 version/id；
- account deletion 接收去重 ID 集合；season deletion 只接收 historical 集合；
- normal player command 不再接受全局设置、账户/赛季管理或新赛季。

### 2.2 T1 有序执行

1. 在任何产品编辑前把 execution state 设为 `in_progress`、当前任务
   `P-001-T-001`，记录实际基线、目标文件和完成条件。
2. 扩展契约和旧快照归一化：
   - 先补 `defaultTheme: "dark"`，再为缺字段账户补全局语言/主题和 volume 100；
   - 保留合法现值，验证非法语言、主题、非整数/范围外音量；
   - 增加最小 Admin projection，确认普通大厅、房间和 display 无其他账户偏好。
3. 在领域拆出只读查找、create-only 创建和原子 profile/preferences 保存。保留内部测试构造
   的最小兼容方式，但生产 API 不再调用“查不到即创建”的混合语义。
4. 建立专用管理读取与管理命令：
   - 设置更新、账户 ID 集合删除、历史赛季 ID 集合删除、新赛季；
   - 空集合和非法 payload 在 store 前拒绝；
   - 普通 command schema/dispatch 移除旧危险写入。
5. 实现账户集合事务：
   - 先验证全部目标并冻结集合；
   - 逐房间按目标集合计算未选中在线房主候选；
   - 活动参与者用 `forceFold()`，普通目标强制退出，房主转让或无候选关闭；
   - 最后按稳定 ID 退役、匿名化、清租约和删除，验证零账户状态。
6. 实现历史赛季集合删除和管理员新赛季，保持 current 与开放房间服务端门禁。
7. 补齐 T1 测试：旧/新偏好、二次恢复、查询无写、注册竞态、profile 全败、匿名命令重放/
   stale、开放房间非房主/房主/全选、多房间、持久化故障、会话失效、投影/日志/私牌隔离。
8. 运行 T1 四项门禁。失败时保持任务 `in_progress`，记录失败输出和最小下一动作；全部通过
   后写 post-task checkpoint，才允许开始 T2。

### 2.3 T2 文件所有权和接口

| 文件或区域 | 预期所有权 |
| --- | --- |
| `apps/web/src/main.tsx` | Player App、两步登录、session/preferences、唯一账户入口、房间视图组合和音量传递；避免继续膨胀管理员页面。 |
| `apps/web/src/admin-ui.tsx`（新增时） | Admin App、路径导航、管理状态/命令、首页/账户/赛季页和本地管理员偏好。 |
| `apps/web/src/platform-ui.tsx` | 游戏无关管理选择或 leaderboard 共享部分；不得导入扑克状态机。 |
| `apps/web/src/ui.tsx` | 共享 SVG、主题受控原语、Select/Collapsible、固定 panel/dialog、portal 锚定菜单和焦点行为。 |
| `apps/web/src/styles.css` | 双列/单列管理员布局、固定框架、稳定 scrollbar gutter、portal 层级、300px 和 `focus-visible`。 |
| `apps/web/src/locales.ts` | 全部新增中英文文案和稳定错误映射。 |
| `docs/ui-design-guidelines.md` | 可独立复用的固定容器、滚动、层叠浮层、响应式和可访问性规范。 |
| T2 tests | Chromium/WebKit、capacity、Docker 旧 JSON/重启和远端隔离证据。 |

### 2.4 T2 有序执行

1. 更新 execution state 为当前任务 `P-001-T-002`，确认 T1 文件和证据仍对应当前源码。
2. 顶层分离 Admin 与 Player App：
   - Admin exact paths 不恢复玩家 session；
   - History API 支持直达、刷新、push、back/forward；
   - 管理员专用本地语言/主题验证损坏值并与全局草稿隔离。
3. 实现管理员 shell、双列设置、扑克折叠卡、固定保存、账户/赛季二级页、复选全选/
   indeterminate、数量和危险确认；所有写入使用 T1 admin command。
4. 重做登录/注册：
   - 首屏用户名 + SVG 右箭头；
   - 已有账户 existing-only 进入；
   - 新账户注册页只读用户名、按需头像、默认语言/主题、返回和 create-only 提交。
5. 重做账户入口和资料：
   - 大厅移除 DeviceControls/gear/管理入口，只留头像用户名；
   - 用户名右侧头像按需展开，语言/主题/0–100 range 一次保存；
   - 成功后同步 session、最近账户、语言、主题、音量；失败/取消恢复权威值。
6. 把账户 theme mode 与视图 scope 组合，给提示音传入 volume，0 静音且任何 Audio API 异常
   不影响游戏。
7. 建立共享 SVG 和固定 panel/dialog 结构，迁移设置、资料、管理、确认和相关 modal；用稳定
   gutter 和内部 scroll region 消除跳宽、悬空和横向溢出。
8. 用 body portal 锚定菜单替换等待室、活动桌和观众条的嵌套菜单；覆盖边缘定位、Esc、
   外部点击、目标消失、权限变化和焦点恢复，不改变命令或服务端授权。
9. 写 `docs/ui-design-guidelines.md`，扩展 E2E、capacity 和 Docker smoke；测试使用临时
   数据库或随机远端卷。
10. 运行本地最终门禁，再运行远端隔离 Docker 和浏览器验收。完成前后只读正式资源审计，
    精确清理随机资源，最后运行 diff gate 并写 post-task checkpoint。

## 3. 验证与完成条件

### 3.1 验证分类和阻塞规则

| 分类 | 覆盖 | 阻塞规则 |
| --- | --- | --- |
| core | FR-001–FR-036 对应行为；AC-001–AC-020；资产、批量房间处理、偏好、匿名边界、旧状态恢复、并发、幂等、双语、300px 和菜单权限 | 任一失败、未知影响或未运行都阻塞。 |
| 项目硬门禁 | lint、typecheck、platform/server、poker、realtime、E2E 内 build/静态资源、capacity、隔离 Docker、正式远端资源不变、`git diff --check` | 任一失败或证据不对应最终源码都阻塞。 |
| supplemental | AC-021 浏览器非关键差异、AC-022 容量体验、AC-023 日志深度、AC-024 文档复用审阅 | `relaxed` 下只有证明不影响 core、数据、安全、隐私、构建、恢复或正式资源后才可用 `FND-I-*` 报告；否则阻塞。 |

下一可用 finding 编号：`FND-I-001`。不得在观察失败后降低验收层级。

### 3.2 T1 门禁

按以下顺序运行并记录一次有效证据：

1. `npm run typecheck`
2. `npm run test:platform`
3. `npm run test:poker`
4. `npm run test:realtime`

`test:platform` 包含 platform 与 server 文件。若 T2 后续回改契约、领域或服务，最终
`verify:core` 会在最终源码重跑对应门禁。

### 3.3 最终本地门禁

1. `npm run verify:core`
2. `npm run test:capacity`
3. `git diff --check`

`verify:core` 依次包含 lint、typecheck、platform、poker、realtime 和核心 E2E；
E2E runner 先执行生产 build 与静态资源无公网引用检查。若第 1 项后修改源码，从受影响的
最早门禁重跑。计划不运行 `test:deploy`，除非实际 diff 意外触及部署接口并先修订计划。

### 3.4 隔离 iStoreOS 与浏览器验收

1. 复用本机已忽略 SSH 配置或已批准连接边界；不得把用户、私钥、发布路径或凭据写入
   工作流证据。
2. 连接 `192.168.100.1` 后只读记录正式容器 ID/镜像/健康、固定卷存在性和可公开发布
   标识，不读取业务 SQLite 内容。
3. 使用随机镜像、容器、命名卷和临时端口运行更新后的 Docker smoke；禁止使用
   `home-table`、`home-party-game-platform-data`、正式发布目录或固定备份。
4. 在隔离卷验证 linux/amd64、离线、非 root、health、旧 JSON 偏好补齐、管理集合删除、
   用户名重建隔离、租约不复现和容器重启恢复。
5. 保持一个随机临时容器供浏览器技能访问，完成管理员直达/刷新/二级导航、登录/注册、
   账户偏好、固定滚动/300px 和头像菜单核心验收。
6. 成功后只清理本次随机前缀资源，再次只读比较正式资源。归属或清理不确定时将阶段设为
   paused，禁止扩大删除范围或改走正式发布。

该结果只证明候选工作区在真实 iStoreOS 环境隔离运行，不代表正式服务已发布。

### 3.5 阶段完成定义

P-001 只有同时满足以下条件才能完成：

1. T1、T2 都有 durable post-task checkpoint，实际文件全部可由本计划解释。
2. 所有 core 和项目硬门禁在最终源码状态通过。
3. 没有 unresolved 问题、critical/high finding、未知影响、数据/隐私/安全/兼容/构建/
   恢复问题或远端残留。
4. supplemental 项通过，或以连续 `FND-I-*` 记录并有独立无交付影响证据。
5. 匿名管理员、玩家本人、其他玩家和 display 投影边界正确；普通玩家命令不能再调用危险
   管理写入。
6. 正式 `home-table`、固定卷、发布目录和唯一备份未改变；没有把隔离验收描述为发布。
7. `phase-001-result.md`、`change-0.md`、`effective-requirements.md` 和 completed state
   按合同一致生成。

## 4. 风险、恢复与修订记录

### 4.1 风险检查点

| 风险 | 执行检查点 |
| --- | --- |
| 目标集合或房间事实变化导致部分删除 | T1 进入任何修改前验证全部 ID；同一 store handler 内完成房间处理和退役；stale、并发与故障注入阻塞。 |
| 活动手强制退出破坏底池或行动 | T1 覆盖 acting/non-acting、host/non-host、旁观、complete、全选和重启；poker/realtime 不变量阻塞 T2。 |
| 旧快照补值覆盖用户偏好 | T1 比较缺字段、已有合法字段、非法字段与二次恢复；只补缺失值。 |
| 匿名 admin 投影或日志泄漏 | T1 序列化与日志断言；任何 token、私牌、完整流水或内部映射出现都阻塞。 |
| UI 先于权威边界开放 | T2 严格依赖 T1 post-task checkpoint；发现回改使 T1 证据失效时重跑门禁。 |
| portal 菜单扩大操作权限 | T2 只迁移呈现/定位，命令仍由 host 判断和服务端拒绝；E2E 与 realtime 双重验证。 |
| 远端清理误删正式资源 | 随机前缀、精确 inspect、前后只读比较；不能证明归属就保留并暂停。 |

### 4.2 恢复与回滚

- `execution-state.md` 是协调权威；不得用 reset、checkout、stash 或删除用户文件恢复。
- T1/T2 中断时保留当前 diff，记录活动任务、实际文件、最后有效测试和最小下一动作。未有
  post-task checkpoint 的任务继续视为 incomplete。
- JSON 迁移只在临时数据库和随机卷验证；正式数据不运行候选。若未来正式升级后写入新偏好
  或执行删除，降级必须恢复升级前完整 SQLite 备份，不能让旧镜像直接解释新状态。
- 远端失败只处理已记录且经随机前缀证明归属的资源；未知容器、卷、正式备份和恢复锁保持
  原状。

### 4.3 精确恢复步骤

从当前 `ready` 状态开始：

1. 读取 `execution-state.md`，确认 run `initial`、P-001 `ready`、当前任务“无”。
2. 运行 `git rev-parse HEAD` 与 `git status --short`，核对
   `main@b131a4c…` 或识别后续用户改动；不自动接管新改动。
3. 重新计算 requirements、implementation plan 和本 phase plan 的 SHA-256，并与 state
   匹配；确认没有 `phase-001-result.md` 或 `change-0.md`。
4. 在任何产品文件修改前，把 state 更新为 `in_progress`、当前任务
   `P-001-T-001`，记录目标文件和完成条件。
5. 从 `packages/contracts/src/index.ts` 的加法契约和
   `tests/platform.test.ts` 的旧快照/批量房间场景开始。

若任务中断，按 state 的最新活动范围、实际 diff 和测试证据恢复，不假定聊天中声称的进度。

### 4.4 修订记录

| 修订 | 日期 | 内容 |
| --- | --- | --- |
| 1 | 2026-07-30 | 根据路线图修订 1 创建唯一 P-001 展开计划；T1 先建立偏好、匿名管理和删除事务，T2 再开放路由/UI 并完成本地及隔离 iStoreOS 验收。 |
