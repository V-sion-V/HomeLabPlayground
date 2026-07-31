# 游戏房间界面统一与德州扑克开手体验：修改记录 0

- 修改编号：`0`
- 修改类型：`首次实现`
- 原始需求：[requirements.md](requirements.md)
- 初始路线图：[implementation-plan.md](implementation-plan.md)，修订 `1`
- 执行状态：[execution/initial/execution-state.md](execution/initial/execution-state.md)
- 项目基线：`main@2f1901047ee0e23c2038544db7a7508a8d60aeef`
- 完成日期：`2026-07-31`

## 1. 实现概述

首次实现把 Poker 的自动开手改为持久、服务端权威的手动盲注和全员确认协议。两种模式
都先进入 `blinds`；大小盲通过固定按钮独立提交实际盲注，所有仍有效参与者确认线上或
实体底牌后才进入 `preflop`。筹码＋牌在建手时一次发牌但只向本人有效租约投影，纯筹码
模式不创建线上牌。盲注状态与实际 `table-to-pot` 流水在同一 SQLite 命令事务完成，
短码、重复、并发、重放、失败、移除、关闭和重启保持幂等、守恒和隐私。

旧 Poker JSON 缺少新字段时视为开手已经完成，不重新发牌、扣盲或确认；新的部分进度
和私牌可跨重启恢复。外部 `room.pause`、`room.resume` 和 `avalon.void` 已退出当前
命令边界，内部关闭、离开、移除和账户删除所需的安全作废、退款及秘密清理继续有效。

Poker/Avalon 已登录房间统一使用三段式顶栏，房间内移除 display 和暂停/作废入口，
大厅保留匿名只读 display。Avalon 准备卡、独立设置卡、房间名浮层和 display 角色构成
卡复用同一公开派生结果，活动构成按冻结参与者稳定显示且不泄露角色归属。

Poker 玩家卡增加公开待办/行动背景和本人独立边框；线上私牌改为本人按住临时查看，
并在全部安全事件后立即遮盖。下注缓存只在本人正式回合出现在 felt，筹码仅支持点击、
触控和键盘，拖放与指针拖动全部移除。Avalon 十人双列、Poker 玩家轨道、庄家标识、
公共牌、筹码重叠及 300px 层级几何完成修复。

全部本地门禁与真实 iStoreOS 隔离 Docker smoke 通过。隔离测试没有发布正式服务、
挂载固定卷或读取业务数据库；正式镜像、健康、固定卷、发布标记、唯一备份和部署锁
前后不变，随机资源已清零。

## 2. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/contracts/src/index.ts` | modify | 持久盲位、已下盲/已确认集合和公开待办投影契约 |
| `packages/poker/src/index.ts` | modify | 持久 `blinds`、固定盲注、确认门禁、安全推进及强制弃牌 |
| `packages/domain/src/index.ts` | modify | 旧 Poker JSON 归一化、新状态不变量和非秘密投影 |
| `apps/server/src/app.ts` | modify | 盲注/确认命令、原子流水和旧外部暂停/作废命令删除 |
| `apps/web/src/ui.tsx` | modify | 共享三段式已登录房间顶栏和移动按钮 |
| `apps/web/src/main.tsx` | modify | Poker 开手、公开状态、按住私牌、felt 缓存、无拖动和移动布局 |
| `apps/web/src/avalon-ui.tsx` | modify | 共享顶栏、公开角色构成三处复用、准备/设置纵排和双列成员 |
| `apps/web/src/styles.css` | modify | 房间结构、状态语义、悬浮层、筹码重叠和 300px 几何 |
| `apps/web/src/locales.ts` | modify | 新房间阶段、盲注、确认、构成、私牌和状态中英文 |
| `tests/poker.test.ts` | modify | 手动开手、短码、任意顺序、版本、重复、移除和后续行动 |
| `tests/platform.test.ts` | modify | 原子流水、故障回滚、旧快照、部分进度重启、关闭和守恒 |
| `tests/server.test.ts` | modify | 新 HTTP 命令、重放、投影、旧命令拒绝和流程回归 |
| `tests/realtime.test.ts` | modify | 公开待办、并发、接管和私牌隔离 |
| `tests/e2e/core.spec.ts` | modify | 双游戏顶栏、角色构成、两模式开手、按住私牌、无拖动和 300px |
| `tests/capacity.test.ts` | modify | 手动开手协议与目标容量回归 |
| `tests/docker-smoke.mjs` | modify | 部分开手进度、私牌、重启、一次继续和内部安全关闭退款 |
| `AGENTS.md` | modify | 同步 2026-07-31 完成状态和正式发布边界 |
| `docs/requirements/game-room-ui-and-poker-hand-start/requirements.md` | add | 用户批准的原始需求 |
| `docs/requirements/game-room-ui-and-poker-hand-start/workflow-contract.md` | add | schema-v3.2 工作流合同 |
| `docs/requirements/game-room-ui-and-poker-hand-start/implementation-plan.md` | add | initial 路线图修订 1 与完整追踪 |
| `docs/requirements/game-room-ui-and-poker-hand-start/execution/initial/phase-001-plan.md` | add | P-001 修订 1 的三个有序任务与门禁 |
| `docs/requirements/game-room-ui-and-poker-hand-start/execution/initial/phase-001-result.md` | add | P-001 completed / passed 冻结结果 |
| `docs/requirements/game-room-ui-and-poker-hand-start/execution/initial/execution-state.md` | add | completed initial 状态与累计证据 |
| `docs/requirements/game-room-ui-and-poker-hand-start/effective-requirements.md` | add | change-0 后可重新生成的当前产品权威 |
| `docs/requirements/game-room-ui-and-poker-hand-start/change-0.md` | add | 本首次实现的冻结修改记录 |

没有修改 `packages/persistence`、`packages/avalon`、`Dockerfile`、`.dockerignore`、
`deploy/**`、正式 Compose/配置、固定卷接口、发布目录、唯一备份或其他功能的冻结历史；
没有保留 `dist/`、测试报告、远端归档或随机资源。

## 3. 需求、阶段与任务完成情况

| 范围 | 状态 | 完成证据 |
| --- | --- | --- |
| FR-001–FR-029 | completed | 契约、Poker 引擎、领域、服务、Poker/Avalon Web 和恢复实现全部交付 |
| AC-001–AC-025 core | passed | 分层、生产浏览器、构建、恢复、隐私、资产、容量、远端容器和差异硬门禁通过 |
| AC-026–AC-027 supplemental | passed | capacity、16 面值有界 DOM、Chromium/WebKit、减动效和非标准视口通过 |
| NFR-001–NFR-011 | passed | 权威、守恒、隐私、兼容、响应式、双语、容量、离线和工程边界成立 |
| P-001-T-001 | completed | Poker 权威开手、事务流水、旧状态恢复和秘密投影完成 |
| P-001-T-002 | completed | 共享顶栏、Avalon 构成、Poker Web/移动体验和双浏览器任务门禁完成 |
| P-001-T-003 | completed | 最终本地门禁、容量、隔离 iStoreOS 验收、清理和差异审计完成 |
| P-001 | completed | 唯一阶段结果与 initial 完成状态一致冻结 |

本功能路线图没有下一 initial 阶段。

## 4. 测试与验证

- 交付与验证策略：`relaxed`。
- 验证结论：`passed`。
- 最终源码门禁通过：
  - `npm run lint`；
  - `npm run typecheck`；
  - `npm run test:platform`：platform 21/21、server 13/13、Avalon platform 6/6，
    共 40/40；
  - `npm run test:poker`：17/17；
  - `npm run test:avalon`：8/8；
  - `npm run test:realtime`：5/5；
  - `npm run test:e2e:core`：生产 build/static 通过，Chromium desktop 与
    WebKit iPhone 共 8/8；
  - `npm run test:capacity`：4/4。
- 最终源码 iStoreOS 隔离 `npm run test:docker-smoke` 通过：Docker 27.3.1 /
  x86-64、linux/amd64、离线、非 root、health、旧偏好、部分 Poker
  blinds/确认/私牌重启、恰好一次继续、正式行动、Avalon 恢复和内部安全关闭成立。
- 远端正式资源前后只读相同：镜像与 release
  `2f1901047ee0e23c2038544db7a7508a8d60aeef`、running/healthy、固定卷
  `home-party-game-platform-data`、唯一备份大小 `1818624`、无部署锁；候选容器、
  镜像、卷和临时目录残留为 0。
- `git diff --check` 和最终差异归属审计通过。

没有运行 `npm run test:deploy`：实现未触及部署接口，远端隔离验收也没有执行正式发布。
成功 npm 命令后的用户级日志目录 `EPERM` warning 不影响退出码、产物或结论；依赖和
lockfile 未改变。

## 5. 与路线图及阶段计划的偏差

- 没有改变需求、阶段数、任务顺序、交付策略、验收层级或验证范围。
- T2 目标 E2E 首次暴露“查看底牌”按钮遮挡观战成员管理触发器；按 FR-022 移至原暂停
  操作位置后，目标双浏览器与最终 8/8 通过。
- T3 按新协议更新 capacity 和 Docker smoke 夹具，并完成计划内重启/一次继续证据。
- 本机没有 Docker CLI/daemon，因而通过用户授权 SSH 在 iStoreOS 运行同一 smoke
  脚本；业务断言未被手工观察替代。
- 未触及计划列为边界外的 SQL 表、Avalon 规则、Dockerfile、`.dockerignore` 或
  `deploy/**`，路线图和阶段计划保持修订 1。

## 6. 遗留事项

没有开放 `FND-I-*`、未决问题、阻塞、未知影响或已知交付缺口。下一可用 finding ID
仍为 `FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

本记录创建后，原始需求、initial 路线图、阶段计划/结果、completed 状态和本记录均为
冻结历史。未来产品变化必须从
[effective-requirements.md](effective-requirements.md) 发起连续 `change-N` 运行。
