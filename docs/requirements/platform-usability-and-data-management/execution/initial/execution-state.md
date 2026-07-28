# 平台易用性与数据管理增强：initial 执行状态

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：`change-0.md`
- 运行状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 当前路线图修订：`1`
- 需求指纹：`sha256:d06b6407f4c128431551c1ff148efe8ef285b2285c291ea1b22e52265c777f4a`
- 路线图或变更计划指纹：`sha256:d00cb1f130d74785a12009d8586a3815d74887e656bc6ca767d4ee917f89f434`
- 当前阶段：`P-001（completed）`
- 当前阶段计划：[phase-001-plan.md](phase-001-plan.md)，修订 `1`，指纹 `sha256:221dfca701d7c92eafb600c21f7758410469c6572991d63d6207a52b3dd60798`
- 当前任务：`无`
- 项目基线：`main@d55c2568abcb2b67871c58b53559d7b05a32232c`
- 最后更新时间：`2026-07-29`

## 1. 运行目标或待生效变更

P-001 的两个有序任务和 initial 收口均已完成。
[phase-001-result.md](phase-001-result.md)、[change-0.md](../../change-0.md) 和
[effective-requirements.md](../../effective-requirements.md) 已一致生成；本状态现已
冻结为 `completed`。

已实现范围包括平台级参赛排行榜、账户/赛季数据管理、历史匿名化、资产退役、
旧状态恢复、完整结算退出重进、平台管理 UI、共享语言/主题入口规则，以及扑克桌
声音、移动下注和顶部布局改进。隔离 iStoreOS smoke 已完成；它没有发布或切换正式
服务。

## 2. 阶段状态

| 阶段/任务 | 状态 | 验证结论 | 说明 |
| --- | --- | --- | --- |
| P-001 | completed | passed | 唯一阶段；全部 core、硬门禁和 supplemental 验收通过 |
| P-001-T-001 | completed | passed | 平台权威、持久化兼容、删除安全、两手间生命周期及分层验证完成 |
| P-001-T-002 | completed | passed | 平台 Web、扑克桌易用性、本地最终门禁及隔离远端验证完成 |

不存在其他 ready、in-progress、paused 或 blocked 阶段。

## 3. 当前检查点

- schema `3.2`；路线图 `single + expanded`；策略 `relaxed`。
- FR-001–FR-013、AC-001–AC-019（16 core、3 supplemental）和
  NFR-001–NFR-011 均有实现和最终证据。
- `Room.seats` 是两手间当前成员/筹码权威；旧 `PokerState.players` 只保留已完成
  手牌语义，退出后不会覆盖重新加入的买入。
- 平台参赛事实只向排行榜暴露游戏无关字段；新增
  `apps/web/src/platform-ui.tsx` 不导入扑克状态或扑克视图。
- 账户删除使用退役流水维持净发行守恒，并以随机公开 ID、稳定序号和不可识别展示
  匿名化保留历史；内部映射不进入普通投影。
- 当前赛季和批量操作发起者由服务端保护；所有删除仍受租约、版本、无开放房间和
  SQLite 单事务约束。
- 当前没有开放 finding、未决问题、未知影响或远端残留。

## 4. 已完成任务

### P-001-T-001

- 实际结果：完成共享契约、旧 JSON 归一化、平台参赛事实、当前排行榜筛选、
  账户/赛季四类删除、匿名历史、资产退役、租约失效、complete 退出重进、
  下一手座位筹码权威及结算后座位同步。
- 实际文件：`packages/contracts/src/index.ts`、`packages/domain/src/index.ts`、
  `apps/server/src/app.ts`、`tests/platform.test.ts`、`tests/server.test.ts` 和
  `tests/realtime.test.ts`。
- 检查点证据：typecheck、platform 25/25、poker 15/15、realtime 4/4 通过。

### P-001-T-002

- 实际结果：完成平台排行榜单一下拉、账户/赛季管理和显式确认、自删会话清理、
  登录/大厅独占语言主题控件、静音入口/状态移除、提示音保留、移动座位双标签、
  300px 顶部布局和友好错误码呈现。
- 实际文件：新增 `apps/web/src/platform-ui.tsx`；修改
  `apps/web/src/main.tsx`、`apps/web/src/styles.css`、`apps/web/src/locales.ts`、
  `tests/e2e/core.spec.ts`、`tests/capacity.test.ts` 和
  `tests/docker-smoke.mjs`；回归覆盖 T1 文件。
- 计划偏差：`apps/web/src/ui.tsx` 无需修改，现有 `SelectField` 和
  `ConfirmDialog` 已满足接口；未修改扑克引擎、持久化实现、Dockerfile、
  `.dockerignore` 或 `deploy/**`。

## 5. 运行累计文件变化

| 文件或区域 | 模式 | 目的 |
| --- | --- | --- |
| `packages/contracts/src/index.ts` | modify | 退役身份、匿名历史、参赛事实、管理摘要、删除结果和退出标记契约 |
| `packages/domain/src/index.ts` | modify | 排行榜资格、删除/匿名化/退役、不变量、旧状态归一化及座位筹码权威 |
| `apps/server/src/app.ts` | modify | 四类删除命令、租约事务分发、下一手座位选择、结算同步和撤销保护 |
| `apps/web/src/platform-ui.tsx` | add | 游戏无关排行榜、账户管理、赛季管理和确认流程 |
| `apps/web/src/main.tsx`、`styles.css`、`locales.ts` | modify | 平台接入、会话清理、共享控件、声音、移动布局和双语文案 |
| `tests/platform.test.ts`、`server.test.ts`、`realtime.test.ts` | modify | 领域、服务、投影、隐私、幂等和恢复证据 |
| `tests/e2e/core.spec.ts`、`capacity.test.ts`、`docker-smoke.mjs` | modify | 真实浏览器、容量增长和隔离容器重启证据 |
| `AGENTS.md` | modify | 同步 2026-07-29 带日期项目阶段快照 |
| 本功能工作流目录 | add / modify | 保留批准需求、路线图、即时计划、执行状态和收口证据 |

`workflow-contract.md` 是用户已有且未修改的合同；`requirements.md` 是用户已有需求，
规划阶段仅补齐了已经明确确认的决策。没有修改其他冻结功能历史、生成目录、真实部署
配置或部署接口。

## 6. 测试与验证证据

| 日期 | 验证 | 观察结果 | 状态 |
| --- | --- | --- | --- |
| 2026-07-29 | `npm run typecheck`（T1） | TypeScript 无错误 | passed |
| 2026-07-29 | `npm run test:platform`（T1） | 2 files，25/25 | passed |
| 2026-07-29 | `npm run test:poker`（T1） | 1 file，15/15 | passed |
| 2026-07-29 | `npm run test:realtime`（T1） | 1 file，4/4 | passed |
| 2026-07-29 | `npm run verify:core`（最终源码） | lint、typecheck、platform 25/25、poker 15/15、realtime 4/4、Chromium/WebKit 6/6 全部通过 | passed |
| 2026-07-29 | E2E 内生产 build/静态资源检查 | Web/server 构建通过；2 个 HTML/CSS 产物无公网资源引用 | passed |
| 2026-07-29 | `npm run test:capacity` | 1 file，4/4；15 在线账户、双房间、20 历史赛季和批量删除 | passed |
| 2026-07-29 | iStoreOS 隔离 `npm run test:docker-smoke` | Docker CLI 29.6.2 经 SSH 连接 Docker 27.3.1 / linux / amd64；离线、非 root、health、旧 JSON、牌局/私牌、匿名化、用户名复用和三次容器重启通过 | passed |
| 2026-07-29 | 远端前后只读审计 | 正式单容器 ID、运行镜像、healthy、release SHA、固定卷和唯一备份指纹完全不变；smoke 容器/卷/镜像均为 0 | passed |
| 2026-07-29 | `git diff --cached --check`（完整收口差异） | 22 个预期文件无空白错误；无真实配置、部署接口、冻结历史或生成物 | passed |

`npm run test:deploy` 未运行且不在阶段计划内，因为实际 diff 未触及部署接口。成功命令
后的 npm 用户日志目录 `EPERM` 清理警告不影响退出码、测试或产物，不构成 finding。

## 7. 决策、待确认问题与回答

Q-001～Q-003 均已解决，决策来源保持为用户在 2026-07-29 的明确确认。平台/游戏边界、
隔离服务器测试、`relaxed` 策略和全部产品语义均按批准需求执行。

当前无 unresolved 问题。用户另在本次目标中明确授权：功能收口后使用受支持入口正式
部署、通过浏览器实测，并在全部通过后推送提交；该发布验收发生在冻结 initial 之后，
不冒充本阶段的隔离 smoke。

## 8. 发现项、偏差、风险与阻塞

- 当前 severity-rated findings：无。
- 下一个 initial finding ID：`FND-I-001`。
- 当前阻塞：无。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

## 9. 精确恢复步骤

本运行已完成且执行状态不可变：

1. 不得继续修改 `requirements.md`、`implementation-plan.md`、`phase-001-plan.md`、
   `phase-001-result.md`、本状态或 `change-0.md` 承载新产品需求。
2. 后续产品变化必须从 `effective-requirements.md` 发起连续 `change-N` 运行。
3. 本阶段远端 smoke 没有正式发布。正式升级只能从干净且已提交的 Git HEAD 通过
   `deploy/README.md` 支持的入口执行；升级后若发生删除，降级必须配合升级前完整
   SQLite 备份。

## 10. 最终完成门禁

| 门禁 | 当前状态 |
| --- | --- |
| P-001-T-001 与 P-001-T-002 完成 | passed |
| FR-001–FR-013、AC-001–AC-019、NFR-001–NFR-011 全部追踪 | passed |
| 所有 core 和项目硬门禁在最终源码通过 | passed |
| supplemental 验收通过 | passed |
| 无 unresolved 问题、阻塞、未知影响或开放 finding | passed |
| 平台/扑克依赖方向符合用户原则 | passed |
| iStoreOS 隔离 smoke 通过且正式资源未改变 | passed |
| 最终收口文件和暂存差异复核 | passed |

以上门禁全部满足；验证结论为 `passed`，运行状态为 `completed`。
