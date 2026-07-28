# 平台易用性与数据管理增强：修改记录 0

- 修改编号：`0`
- 修改类型：`首次实现`
- 原始需求：[requirements.md](requirements.md)
- 初始路线图：[implementation-plan.md](implementation-plan.md)，修订 `1`
- 执行状态：[execution/initial/execution-state.md](execution/initial/execution-state.md)
- 项目基线：`main@d55c2568abcb2b67871c58b53559d7b05a32232c`
- 完成日期：`2026-07-29`

## 1. 实现概述

首次实现完成了平台级参赛排行榜、账户与历史赛季数据管理、历史身份匿名化和当前资产
退役，并修复了德州扑克完整结算后退出、重新买入和下一手筹码选择。平台账户、赛季、
排行榜、设置与数据管理保持游戏无关；当前扑克结果只作为最小参赛事实适配器。

账户删除支持逐个（含自删）和原子批量删除其他账户。删除受有效控制租约、最新平台
版本、无开放房间和 SQLite 事务保护；目标当前余额进入退役流水，历史显示替换为随机
公开 ID 和稳定匿名序号，旧租约失效，同名重建不继承旧状态。历史赛季可逐个或批量
永久删除其榜单、手牌和流水，current 始终受保护。

Web 新增平台排行榜单一下拉、账户管理和赛季管理。语言/主题只在登录和大厅显示；
所有游戏等待、牌桌、观战、结算和公共大屏移除该入口。现有扑克静音入口及本地静音
状态生效被移除，阶段提示音保留。移动座位分行显示剩余筹码与本轮下注，300px 顶部
不再重叠，正常同步不显示技术提示，真实错误使用友好双语说明和可选稳定代码。

全部本地门禁与真实 iStoreOS 隔离 Docker smoke 通过。远端 smoke 没有发布正式服务，
没有挂载或改写固定卷、发布目录和唯一备份；正式容器/镜像/release SHA/备份指纹前后
一致，随机资源已经清零。

## 2. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/contracts/src/index.ts` | modify | 退役身份、匿名历史、平台参赛事实、管理摘要、删除结果和退出标记契约 |
| `packages/domain/src/index.ts` | modify | 排行榜资格、账户/赛季删除、匿名化、资产退役、恢复不变量和两手间座位权威 |
| `apps/server/src/app.ts` | modify | 四类删除命令、租约/事务分发、下一手座位选择、结算同步和离开后撤销保护 |
| `apps/web/src/platform-ui.tsx` | add | 游戏无关排行榜、账户管理、赛季管理和确认流程 |
| `apps/web/src/main.tsx` | modify | 平台组件、自删会话、共享控件、声音、移动座位和错误呈现 |
| `apps/web/src/styles.css` | modify | 管理 modal、空/保护/危险状态、座位双标签和 300px 顶部布局 |
| `apps/web/src/locales.ts` | modify | 新增简体中文/英文管理、匿名、赛季、错误和座位文案 |
| `tests/platform.test.ts` | modify | 参赛筛选、匿名化、同名重建、退役守恒、赛季清理和旧 JSON |
| `tests/server.test.ts` | modify | 删除命令、重放/过期、租约失效与 complete 退出重进 |
| `tests/realtime.test.ts` | modify | 匿名历史投影、内部映射隔离和公共隐私 |
| `tests/e2e/core.spec.ts` | modify | Chromium/WebKit 平台管理、赛季保护、自删、共享控件和 300px 牌桌 |
| `tests/capacity.test.ts` | modify | 15 账户、双房间、20 历史赛季和批量管理容量 |
| `tests/docker-smoke.mjs` | modify | 旧 JSON、牌局/私牌、匿名化、用户名复用和三次容器重启 |
| `AGENTS.md` | modify | 同步 2026-07-29 项目阶段快照 |
| `docs/requirements/platform-usability-and-data-management/requirements.md` | add | 保存批准的原始需求、分层验收与决策 |
| `docs/requirements/platform-usability-and-data-management/workflow-contract.md` | add | 保存 schema-v3.2 工作流合同 |
| `docs/requirements/platform-usability-and-data-management/implementation-plan.md` | add | 保存单阶段展开路线图修订 1 |
| `docs/requirements/platform-usability-and-data-management/execution/initial/phase-001-plan.md` | add | 保存 P-001 即时计划修订 1 |
| `docs/requirements/platform-usability-and-data-management/execution/initial/phase-001-result.md` | add | 冻结唯一阶段的实现、验证和远端隔离证据 |
| `docs/requirements/platform-usability-and-data-management/execution/initial/execution-state.md` | add | 冻结 completed initial 协调状态 |
| `docs/requirements/platform-usability-and-data-management/change-0.md` | add | 保存本首次实现记录 |
| `docs/requirements/platform-usability-and-data-management/effective-requirements.md` | add | 生成当前有效需求快照 |

没有修改 `packages/poker`、`packages/persistence`、`apps/web/src/ui.tsx`、
`Dockerfile`、`.dockerignore`、`deploy/**`、其他冻结工作流或生成目录。

## 3. 需求、阶段与任务完成情况

| 范围 | 状态 | 完成证据 |
| --- | --- | --- |
| FR-001–FR-013 | completed | 领域、服务、平台 Web、扑克视图和恢复实现均已交付 |
| AC-001–AC-016 core | passed | 全部分层、生产浏览器、构建、容量、远端容器和差异硬门禁通过 |
| AC-017–AC-019 supplemental | passed | Chromium/WebKit 6/6、结构化拒绝/隐私测试、15 账户与历史增长场景通过 |
| NFR-001–NFR-011 | passed | 守恒、隐私、恢复、响应式、双语、离线、容量、并发和类型边界成立 |
| P-001-T-001 | completed | 契约/领域/服务和 T1 分层门禁完成 |
| P-001-T-002 | completed | 平台 Web、扑克易用性、最终集成和隔离远端门禁完成 |
| P-001 | completed | 唯一阶段结果与 initial 状态一致冻结 |

本功能路线图没有下一 initial 阶段。

## 4. 测试与验证

- 交付与验证策略：`relaxed`。
- 验证结论：`passed`。
- `npm run verify:core` 通过：
  - lint；
  - typecheck；
  - platform 25/25；
  - poker 15/15；
  - realtime 4/4；
  - 生产 Chromium desktop / WebKit mobile 6/6；
  - E2E 内 Web/server build 和静态资源无公网引用检查。
- `npm run test:capacity` 通过，4/4；覆盖 15 在线账户、双房间、20 历史赛季、
  有界管理投影与批量删除。
- iStoreOS 隔离 `npm run test:docker-smoke` 通过：临时 Docker CLI 29.6.2 经 SSH
  连接 Docker 27.3.1 / linux / amd64；离线启动、非 root、health、旧 JSON 归一化、
  命名卷牌局/私牌恢复、账户匿名化、用户名复用及三次容器重启指纹均成立。
- 远端前后只读审计通过：正式单容器、运行镜像、healthy、release SHA、固定卷和
  唯一备份指纹完全不变；随机 smoke 容器、卷、镜像均为 0。
- `git diff --check` 和最终差异归属审计通过；没有真实配置、部署接口、冻结历史或
  生成物进入提交。

没有运行 `npm run test:deploy`：路线图明确排除部署接口修改，实际差异也未触及该范围。
隔离 Docker 观察不是正式发布证据。

成功 npm 命令后的用户级日志目录 `EPERM` 清理警告没有改变退出码、测试或构建产物，
不构成 finding。

## 5. 与路线图及阶段计划的偏差

- 没有改变需求、阶段数、任务顺序、交付策略或验证范围。
- `apps/web/src/ui.tsx` 最终无需修改：现有 `SelectField` 和 `ConfirmDialog` 已满足
  单一下拉、确认和焦点接口，因此保持更小差异。
- 本机没有 Docker CLI/daemon，按已批准路线图使用校验过 SHA-256 的临时 Docker
  官方 CLI 连接用户授权的远端 daemon；隔离脚本本身及全部断言保持不变。
- 没有触及计划列为需暂停修订的扑克引擎、持久化事务、Dockerfile、`.dockerignore`
  或部署文件，因此路线图和阶段计划均保持修订 1。

## 6. 遗留事项

没有开放 `FND-I-*`、未决问题、阻塞或已知交付缺口。下一可用 finding ID 仍为
`FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

本记录创建后，原始需求、initial 路线图、阶段计划/结果、completed 执行状态和本记录
均为冻结历史。未来产品变化必须从
[effective-requirements.md](effective-requirements.md) 发起连续 `change-N` 运行。
