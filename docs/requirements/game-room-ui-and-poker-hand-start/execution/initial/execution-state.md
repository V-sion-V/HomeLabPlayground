# 游戏房间界面统一与德州扑克开手体验：initial 执行状态

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：[change-0.md](../../change-0.md)
- 运行状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 当前路线图修订：`1`
- 需求指纹：`sha256:ad5cdcf8d67fee30ddbc71f1ac1b381330a8a3a0d9881d978e22e065c8598351`
- 路线图或变更计划指纹：`sha256:b70e050378d10735e824d6de4492f249fe8120db63dc539804dd719dd10f6fa2`
- 当前阶段：`P-001（completed）`
- 当前阶段计划：[phase-001-plan.md](phase-001-plan.md)，修订 `1`，指纹
  `sha256:9365ce65c1dfcc54409e47f5491649ff1bd5ba718376c0284573a441c833e6bd`
- 当前阶段结果：[phase-001-result.md](phase-001-result.md)
- 当前任务：`none`
- 项目开始基线：`main@2f1901047ee0e23c2038544db7a7508a8d60aeef`
- 最后更新时间：`2026-07-31`

## 1. 运行目标与最终结果

initial 在一个 `single + expanded` 阶段中完成 FR-001–FR-029、AC-001–AC-027 和
NFR-001–NFR-011：

- 两种 Poker 模式都先进入持久、服务端权威的 `blinds`，指定大小盲提交固定盲注，
  所有仍有效参与者确认线上或实体底牌后才原子进入 `preflop`；
- 盲注状态和实际 `table-to-pot` 流水同一 SQLite 命令事务完成，短码、任意顺序、
  重放、并发、故障、移除、关闭和重启保持幂等、守恒与私牌隔离；
- 旧活动手缺少新字段时视为协议已完成，不重发牌、重扣盲或重确认；新部分进度和私牌
  可跨重启恢复；
- Poker/Avalon 已登录房间统一使用三段式顶栏，房间内 display 与外部暂停/恢复/
  手动作废退役，内部安全作废继续有效；
- Avalon 准备/设置、公开角色构成、房间名浮层、匿名 display 卡和 300px 双列成员，
  以及 Poker 玩家状态、按住私牌、felt 缓存、无拖动筹码和手机牌桌均已交付；
- 最终本地硬门禁和 `192.168.100.1` 随机隔离 Docker smoke 全部通过。

本次隔离验收没有调用正式部署入口，没有切换正式 `home-table`、固定卷、发布目录或
唯一备份。正式资源前后只读事实相同，随机容器、卷、镜像和临时目录均已清零，因此
本 initial 结果不表示正式发布。

## 2. 阶段与任务状态

| 阶段/任务 | 状态 | 验证结论 | 说明 |
| --- | --- | --- | --- |
| P-001 | completed | passed | 唯一展开阶段，结果见 `phase-001-result.md` |
| P-001-T-001 | completed | passed | Poker 权威开手、事务流水、旧状态恢复、投影和外部命令边界 |
| P-001-T-002 | completed | passed | 共享顶栏、Avalon 构成、Poker Web/移动体验和目标双浏览器门禁 |
| P-001-T-003 | completed | passed | 最终本地门禁、容量、真实远端隔离 smoke、清理和 initial 收口 |

没有下一 initial 阶段，也没有 ready、in_progress、paused 或 blocked 任务。

## 3. 最终检查点

- schema `3.2`；需求、合同、README、AGENTS、相关源码/测试、部署边界和远端资源规则
  均完成审计。
- 路线图修订 1 保持 `single + expanded`，策略保持 `relaxed`。持久 Poker 状态、
  公共命令、盲注流水、旧快照、私牌和 300px 风险均由展开计划及完整门禁覆盖。
- requirements、roadmap 和 phase plan 指纹与计划时一致；没有运行中需求漂移、路线图
  修订或验收层级下降。
- P-001-T-001 已证明两种模式持久 `blinds`、固定盲注、全员确认、短码完整大盲额、
  原子流水、幂等/并发/失败回滚、移除/关闭、旧 JSON 与私牌投影成立。
- P-001-T-002 已证明共享顶栏、外部旧入口移除、Avalon 构成三处复用、Poker 开手卡、
  状态语义、按住私牌、felt 缓存、无拖动和双游戏 300px 布局成立。
- 最终源代码通过 lint、typecheck、platform/server/Avalon platform 40/40、
  Poker 17/17、Avalon 8/8、realtime 5/5、生产 Chromium/WebKit 8/8 和 capacity 4/4。
- E2E 内生产 Web/server 构建和静态资源无公网引用检查通过。
- 本机没有 Docker CLI/daemon；同一 `tests/docker-smoke.mjs` 在用户授权的
  `192.168.100.1` Docker 27.3.1 / x86-64 上执行最终源码断言。
- 隔离 smoke 证明 linux/amd64、离线、非 root、health、旧偏好、部分 Poker
  blinds/确认/私牌重启、一次继续、正式行动、Avalon 恢复和内部安全关闭成立。
- 隔离前后正式镜像/release 均为
  `2f1901047ee0e23c2038544db7a7508a8d60aeef`，容器 running/healthy、固定卷
  `home-party-game-platform-data`、唯一备份大小 `1818624`、部署锁缺失；随机
  容器/镜像/卷/临时目录残留为 0。
- `git diff --check` 和最终差异归属审计通过；没有真实配置、部署接口、生成物、
  临时归档或其他 feature 冻结历史进入差异。

## 4. 已完成任务

### P-001-T-001

- 扩展共享契约中的盲位、已下盲、已确认和公开待办。
- 让 `createPokerState()` 停留在持久 `blinds`，增加固定盲注、确认和最后待办推进。
- 在服务事务内把每笔成功盲注与一次实际桌到池流水原子绑定。
- 兼容缺少新字段的旧 active/complete/paused Poker JSON，保留既有资产和牌局。
- 保持短码、完整大盲开局额、强制弃牌、关闭退款、命令重放/并发和私牌租约隔离。
- 从外部 schema/dispatch 移除暂停、恢复和手动作废，同时保留内部安全路径。

### P-001-T-002

- 统一 Poker waiting/player/spectator 与 Avalon room view 的三段式已登录房间顶栏。
- 交付 Avalon 紧凑准备卡、下方独立设置卡、公开构成摘要/浮层/display 卡及双列成员。
- 交付 Poker 整卡行动/待办背景、本人边框、两模式开手卡和公开文字/ARIA 状态。
- 移除常态私牌，增加按住临时查看并覆盖释放、失焦、隐藏、离线和权威变化安全事件。
- 把缓存移入 felt 并限制为本人正式回合；删除拖动，保留点击、触控、键盘和横向滚动。
- 修复 300px 公共牌、玩家轨道、阴影、焦点、庄家标识、层级和房间按钮。

### P-001-T-003

- 更新 capacity 与 Docker smoke 对新手动开手协议和部分进度恢复的覆盖。
- 在最终源码运行全部分层、生产浏览器、容量、构建和静态资源门禁。
- 在真实 iStoreOS 以随机资源完成隔离 Docker smoke，前后只读对比正式资源并清零残留。
- 完成 FR/AC/NFR、finding、差异归属和工作流工件一致性审计。

## 5. 运行累计文件变化

| 文件或区域 | 模式 | 所有权与目的 |
| --- | --- | --- |
| `docs/requirements/game-room-ui-and-poker-hand-start/requirements.md` | pre-existing/add | 用户批准的原始需求，initial 未改写 |
| `docs/requirements/game-room-ui-and-poker-hand-start/workflow-contract.md` | pre-existing/add | 用户批准的 schema 3.2 合同，initial 未改写 |
| 本功能其余工作流文件 | add | 路线图、阶段计划/结果、完成状态、change-0 和有效需求快照 |
| `packages/contracts/src/index.ts` | modify | 盲位、提交/确认集合和公开待办契约 |
| `packages/poker/src/index.ts` | modify | 持久 blinds、盲注、确认、安全推进和强制弃牌 |
| `packages/domain/src/index.ts` | modify | 旧状态归一化、新不变量和非秘密投影 |
| `apps/server/src/app.ts` | modify | 新命令、原子流水和旧外部命令删除 |
| `apps/web/src/ui.tsx` | modify | 共享已登录房间顶栏 |
| `apps/web/src/main.tsx` | modify | Poker 开手、状态、私牌、缓存、无拖动和手机布局 |
| `apps/web/src/avalon-ui.tsx` | modify | 共享顶栏、公开构成、准备/设置和双列布局 |
| `apps/web/src/styles.css` | modify | 房间、状态、悬浮层、筹码和 300px 几何 |
| `apps/web/src/locales.ts` | modify | 新增状态与交互的中英文 |
| `tests/poker.test.ts` | modify | Poker 引擎协议和边界 |
| `tests/platform.test.ts` | modify | 事务、恢复、旧状态和守恒 |
| `tests/server.test.ts` | modify | HTTP 命令、重放、投影和拒绝 |
| `tests/realtime.test.ts` | modify | 待办、接管、并发和私牌隔离 |
| `tests/e2e/core.spec.ts` | modify | 双游戏桌面/手机核心流程和几何 |
| `tests/capacity.test.ts` | modify | 新开手协议和目标容量 |
| `tests/docker-smoke.mjs` | modify | 部分开手、重启、一次继续和安全关闭 |
| `AGENTS.md` | modify | 同步 2026-07-31 阶段快照 |

没有修改 `packages/persistence`、`packages/avalon`、`Dockerfile`、`.dockerignore`、
`deploy/**`、其他冻结 feature 历史或生成目录。

## 6. 测试与验证证据

| 日期 | 验证 | 观察结果 | 状态 |
| --- | --- | --- | --- |
| 2026-07-31 | `npm run lint` | 最终源码 ESLint 通过 | passed |
| 2026-07-31 | `npm run typecheck` | 严格 TypeScript 检查通过 | passed |
| 2026-07-31 | `npm run test:platform` | platform 21/21、server 13/13、Avalon platform 6/6，共 40/40 | passed |
| 2026-07-31 | `npm run test:poker` | 17/17 | passed |
| 2026-07-31 | `npm run test:avalon` | 8/8 | passed |
| 2026-07-31 | `npm run test:realtime` | 5/5 | passed |
| 2026-07-31 | `npm run test:e2e:core` | build/static 通过；Chromium/WebKit 8/8 | passed |
| 2026-07-31 | `npm run test:capacity` | 4/4；15 账户、双房间和多 display 有界 | passed |
| 2026-07-31 | 最终源码远端隔离 Docker smoke | Docker 27.3.1 / x86-64；linux/amd64、非 root、health、部分开手与跨重启恢复成立 | passed |
| 2026-07-31 | 远端前后只读与清理审计 | 正式资源事实一致；随机容器/镜像/卷/临时目录均为 0 | passed |
| 2026-07-31 | `git diff --check` / 差异审计 | 无空白错误、临时项、敏感配置、部署接口、生成物或越界历史 | passed |

`npm run test:deploy` 未运行，因为差异没有触及 `deploy/**`、`.dockerignore` 或发布接口，
隔离验收也没有执行正式发布。成功 npm 命令后的用户级 cache 日志清理 `EPERM` warning
不影响退出码、产物或结论；依赖清单和 lockfile 未变化。

## 7. 决策、偏差与发现项

- 用户确认的交付与验证策略为 `relaxed`；全部 core、硬门禁和 supplemental 验收实际
  通过，没有使用报告后放行。
- 两种模式手动盲注/确认、外部暂停/作废退役、Avalon 构成公开而归属保密、本人私牌
  有效租约隔离和旧手协议已完成解释均按批准需求实现。
- 目标 E2E 曾发现“查看底牌”按钮遮挡观战成员管理触发器；按 FR-022 移到原暂停操作
  位置后，双浏览器目标用例和完整 8/8 通过。
- 本机无 Docker CLI/daemon，使用用户授权 SSH 在 iStoreOS 运行同一 smoke 脚本，
  没有以手工观察替代业务断言。
- 当前 severity-rated findings：无。下一可用 initial finding ID：`FND-I-001`。
- 当前未决问题、阻塞和未知影响：无。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

## 8. 精确恢复与未来变更

initial 已完成并冻结，不存在可恢复的 initial 活动任务。未来产品变化必须：

1. 从 [../../effective-requirements.md](../../effective-requirements.md) 读取当前行为；
2. 创建连续 `change-1`，不得改写本状态、`phase-001-result.md` 或 `change-0.md`；
3. 重新检查当时 Git 事实、正式部署状态和独立变更授权；
4. 对正式发布使用 `deploy/README.md` 的受支持入口，并把隔离验收与发布证据分开。

## 9. 最终完成门禁

| 门禁 | 最终状态 |
| --- | --- |
| P-001-T-001 权威开手、事务、恢复和投影 | passed |
| P-001-T-002 共享房间、Avalon/Poker Web 和双浏览器 | passed |
| P-001-T-003 最终门禁、容量、隔离环境和收口 | passed |
| FR-001–FR-029、AC-001–AC-027、NFR-001–NFR-011 完整追踪 | passed |
| 所有 core 与项目硬门禁在最终源代码通过 | passed |
| supplemental 通过或合规 finding 汇总 | passed；无 finding |
| 无 unresolved、blocked、未知影响或远端残留 | passed |
| 正式资源前后只读一致且隔离验收未构成发布 | passed |
| phase result、change-0、effective snapshot 与 completed state 一致 | passed |

验证结论为 `passed`，运行状态冻结为 `completed`。
