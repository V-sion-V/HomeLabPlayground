# P-001 阶段结果：游戏房间界面统一与德州扑克开手体验

- 运行编号：`initial`
- 阶段编号：`P-001`
- 阶段计划：[phase-001-plan.md](phase-001-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 开始基线：干净的 `main@2f1901047ee0e23c2038544db7a7508a8d60aeef`
- 完成基线：上述提交加本结果第 3 节列出的工作区差异
- 完成日期：`2026-07-31`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 阶段目标与结果

P-001 在唯一展开阶段内完成了 FR-001–FR-029、AC-001–AC-027 和
NFR-001–NFR-011。

Poker 开手现在持久停留在服务端权威的 `blinds` 阶段。庄家、大小盲、冻结参与者、
面值和筹码＋牌模式的牌一次确定，但不再自动扣盲。大小盲分别通过
`poker.blind.post` 提交固定盲注，所有仍有效参与者通过
`poker.hand-start.confirm` 确认线上或实体底牌；全部待办完成后才原子进入
`preflop`。每笔实际盲注与一条 `table-to-pot / blind` 流水位于同一 SQLite 命令
事务，短码、任意提交顺序、重复、过期、并发、故障回滚、移除和关闭均保持幂等与守恒。

旧 Poker JSON 缺少新字段时被解释为既有开手协议已经完成，不会重发牌、重扣盲注或
再次要求确认；新的部分盲注/确认进度、底牌和公开待办可跨服务重启恢复。公开投影只
包含盲位和完成状态，`ownHoleCards` 仍只进入本人有效控制租约。外部
`room.pause`、`room.resume` 和 `avalon.void` 已移除并确定性拒绝，关闭、离开、
移除和账户删除依赖的内部安全作废、退款与秘密清理仍保留。

Poker 与 Avalon 的已登录等待、参赛和观战页面现使用同一三段式房间顶栏。房间内
不再提供 display、暂停、恢复或手动作废入口，大厅房间卡继续提供匿名只读 display。
Avalon 准备卡、独立设置卡、角色构成摘要、房间名可访问浮层和匿名 display 卡复用
同一公开派生结果；活动构成按冻结参与者稳定显示，不读取角色归属。300px 下最多十名
成员保持双列。

Poker 玩家卡以整卡操作提示填充表达正式行动者和开手待办，并以独立边框表达本人。
线上私牌从牌桌常态区域移除；本人只在按住“查看底牌”时临时显示，所有释放、失焦、
隐藏、离线、房间/手牌/版本/连接及接管变化都会清除本机显示。下注缓存只在本人正式
回合显示为 felt 内半透明卡，筹码仅支持点击、触控和键盘；HTML drag/drop 与指针拖动
已移除。手机玩家轨道、庄家标识、阴影、公共牌和层级边界完成修复。

最终本地分层门禁、生产 Chromium/WebKit、容量、构建、静态资源和真实 iStoreOS
隔离 Docker smoke 全部通过。隔离验收前后正式 `home-table` 的容器镜像、健康状态、
固定卷、发布标记、唯一备份和部署锁保持不变，随机资源已清零；本结果不表示正式发布。

## 2. 任务、需求与验收覆盖

| 任务 | 完成结果 | 需求范围 | 主要证据 |
| --- | --- | --- | --- |
| P-001-T-001 | completed | FR-005、FR-012–FR-020；数据、接口、事务、隐私、恢复与兼容 NFR | typecheck；Poker 17/17；platform/server/Avalon platform 40/40；realtime 5/5 |
| P-001-T-002 | completed | FR-001–FR-013、FR-017–FR-029；共享顶栏、Avalon 构成、Poker Web、双语和移动体验 | lint；Avalon 8/8；目标 Chromium/WebKit Poker/Avalon；最终生产浏览器 8/8 |
| P-001-T-003 | completed | AC-001–AC-027；完整候选门禁、容量、隔离容器、恢复与差异审计 | 最终分层门禁；capacity 4/4；iStoreOS Docker smoke；正式资源前后只读一致；随机资源 0 |

| 验收范围 | 层级 | 通过证据 |
| --- | --- | --- |
| AC-001–AC-009 | core | 共享顶栏、大厅 display、旧命令拒绝、Avalon 准备/构成/浮层/display/300px 双列由 server、realtime 和 Chromium/WebKit 覆盖 |
| AC-010–AC-016 | core | 玩家状态、两模式手动盲注/确认、短码、任意顺序、一次流水、秘密投影、断线/重启/移除和旧快照由 poker、platform/server、realtime、E2E 与 Docker 覆盖 |
| AC-017–AC-022 | core | 私牌按住、全部安全遮盖、felt 缓存、16 面值、无拖动、横向滚动、公共牌和玩家轨道几何由 Chromium/WebKit 桌面/手机/300px 覆盖 |
| AC-023–AC-025 | core | 故障回滚、幂等/并发、资产守恒、双语/可访问性、全部项目硬门禁和最终差异检查通过 |
| AC-026–AC-027 | supplemental | capacity 4/4、16 面值有界 DOM、双浏览器、减动效/长名称/非标准视口检查通过 |

没有验收降级、用户豁免或报告后放行。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/contracts/src/index.ts` | modify | 增加持久盲位、已下盲/已确认集合及公开待办投影 |
| `packages/poker/src/index.ts` | modify | 实现持久 `blinds`、固定盲注、全员确认、安全推进和开手期强制弃牌 |
| `packages/domain/src/index.ts` | modify | 兼容旧 Poker JSON、校验新不变量并投影非秘密开手状态 |
| `apps/server/src/app.ts` | modify | 增加盲注/确认命令、原子盲注流水并删除旧外部暂停/作废命令 |
| `apps/web/src/ui.tsx` | modify | 增加共享三段式已登录房间顶栏及移动端图标行为 |
| `apps/web/src/main.tsx` | modify | 接入 Poker 顶栏、开手卡、公开状态、私牌按住、felt 缓存和无拖动筹码 |
| `apps/web/src/avalon-ui.tsx` | modify | 接入共享顶栏、公开角色构成三处复用、准备/设置纵排和 300px 双列 |
| `apps/web/src/styles.css` | modify | 实现共享布局、构成卡、Poker 状态/悬浮层、筹码重叠和移动几何 |
| `apps/web/src/locales.ts` | modify | 增加房间阶段、盲注、确认、构成、私牌和状态的完整中英文文案 |
| `tests/poker.test.ts` | modify | 覆盖盲注/确认转换、短码、顺序、重复、版本、移除和后续行动 |
| `tests/platform.test.ts` | modify | 覆盖原子流水、故障回滚、旧快照、部分进度重启、关闭和守恒 |
| `tests/server.test.ts` | modify | 覆盖新 HTTP 命令、重放、投影、旧命令拒绝和既有 Poker 流程 |
| `tests/realtime.test.ts` | modify | 覆盖公开待办、并发版本、控制接管和私牌隔离 |
| `tests/e2e/core.spec.ts` | modify | 覆盖双游戏顶栏、Avalon 构成、两模式开手、按住私牌、无拖动和 300px |
| `tests/capacity.test.ts` | modify | 迁移手动开手协议并回归 15 账户、双房间和多 display 容量 |
| `tests/docker-smoke.mjs` | modify | 覆盖部分开手状态、私牌、重启、一次继续和内部安全关闭退款 |
| `AGENTS.md` | modify | 同步 2026-07-31 功能完成与正式发布边界快照 |
| 本功能工作流目录 | add / modify | 保存批准需求、合同、路线图、阶段计划/结果、完成状态和有效快照 |

没有修改 `packages/persistence`、`packages/avalon`、`Dockerfile`、`.dockerignore`、
`deploy/**`、其他冻结功能历史或生成目录。

## 4. 测试与验证

| 验证 | 观察结果 |
| --- | --- |
| `npm run lint` | 通过；最终 TypeScript/TSX/JS/MJS 差异无 ESLint 错误 |
| `npm run typecheck` | 通过；严格 TypeScript 检查无错误 |
| `npm run test:platform` | 通过；platform 21/21、server 13/13、Avalon platform 6/6，共 40/40 |
| `npm run test:poker` | 通过；17/17 |
| `npm run test:avalon` | 通过；8/8 |
| `npm run test:realtime` | 通过；5/5 |
| `npm run test:e2e:core` | 通过；生产 Web/server build 与静态资源检查成功，Chromium desktop / WebKit iPhone 共 8/8 |
| `npm run test:capacity` | 通过；4/4，覆盖 15 账户、双房间和多 display |
| 最终源码 iStoreOS 隔离 `npm run test:docker-smoke` | 通过；Docker 27.3.1 / x86-64，linux/amd64、离线、非 root、health、旧偏好、部分 blinds/确认/私牌重启、一次继续、Poker 行动、Avalon 恢复及内部安全关闭成立 |
| 远端前后只读审计 | 通过；正式镜像与 release 均为 `2f1901047ee0e23c2038544db7a7508a8d60aeef`，容器 running/healthy、固定卷 `home-party-game-platform-data`、唯一备份大小 `1818624`、部署锁缺失，前后相同 |
| 隔离资源清理 | 通过；候选容器、镜像、卷和临时目录残留均为 0 |
| `git diff --check` / 最终差异审计 | 通过；无空白错误、临时归档、真实配置、部署接口、生成物或其他功能历史 |

`npm run test:deploy` 未运行，因为差异没有触及部署接口、`.dockerignore` 或发布协议；
隔离验收也没有调用正式部署入口。成功 npm 命令结束后的用户级日志目录 `EPERM`
清理 warning 不影响退出码、lockfile 或交付证据，不构成 finding。依赖清单和 lockfile
未发生变化。

## 5. 发现项与处置

无开放 `FND-I-*`；下一可用编号仍为 `FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

目标 E2E 首次发现牌桌内的“查看底牌”按钮层级会遮挡观战成员管理触发器。完成前已按
FR-022 把按钮移动到原暂停操作所在的底部位置；随后 Chromium Poker、WebKit Poker
和完整 8/8 均通过，因此这是已解决的实施反馈，不是 report-only finding。

## 6. 决策、计划偏差与恢复记录

- 保持用户选择的 `relaxed` 策略；全部 core、硬门禁和 supplemental 实际通过。
- 路线图保持 `single + expanded`，阶段数、三个任务顺序、需求范围和计划修订均未改变。
- 复用现有 SQLite JSON 快照和 `PlatformStore.execute()`；没有新增 SQL migration、
  运行时依赖、外部资源或部署接口。
- T3 按新开手协议更新 capacity 与 Docker smoke 夹具；这属于计划内最终集成，不是
  验收降级。
- 本机没有 Docker CLI/daemon，因此在用户授权的 `192.168.100.1` 通过现有 SSH
  边界运行同一 `tests/docker-smoke.mjs` 断言，没有以手工观察替代脚本。
- 隔离远端只使用明确归属的临时归档和随机镜像、容器、卷；没有挂载固定卷、读取业务
  SQLite、调用正式部署入口或修改唯一备份。

## 7. 遗留风险与下一阶段进入条件

没有阻止交付的遗留风险、未决产品问题、开放 finding、未知影响或下一 initial 阶段。
P-001 是路线图唯一阶段。

本结果、completed execution state、`change-0.md` 和
`effective-requirements.md` 创建后，initial 历史冻结。后续产品变化必须从有效需求
快照发起连续 `change-N` 运行。

正式发布不属于本阶段证据；用户已另行授权在工作流冻结、Git 提交和推送后，通过
`deploy/README.md` 的受支持入口执行正式发布及只读 SSH/浏览器核验。
