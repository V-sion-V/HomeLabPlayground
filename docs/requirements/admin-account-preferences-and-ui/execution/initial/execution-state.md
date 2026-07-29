# 管理员设置、账户偏好与界面容器统一：initial 执行状态

- 运行编号：`initial`
- 运行类型：`首次实现`
- 目标记录：[change-0.md](../../change-0.md)
- 运行状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`
- 当前路线图修订：`1`
- 需求指纹：`sha256:2ea7aa29ee9e4149758016c1f72464f00420f4b639fbb5568a1fb566c01f22d4`
- 路线图或变更计划指纹：`sha256:dd7bbc375b77fcdb689ae61a314cb38309ba06186deba336c5f4a626429c0d1c`
- 当前阶段：`P-001（completed）`
- 当前阶段计划：[phase-001-plan.md](phase-001-plan.md)，修订 `1`，指纹
  `sha256:ff56b34e6a3d90fa28690d82a01b443956754ae414f24fc641c6bc417d6fcfb9`
- 当前阶段结果：[phase-001-result.md](phase-001-result.md)
- 当前任务：`none`
- 项目开始基线：`main@b131a4c35ec952180beed575e274b9cb27cbccd8`
- 最后更新时间：`2026-07-30`

## 1. 运行目标与最终结果

initial 在一个 `single + expanded` 阶段中完成 FR-001–FR-036、AC-001–AC-024 和
NFR-001–NFR-012：

- 账户语言、主题和音量成为服务器权威资料；登录拆分为只读查询、existing-only 进入和
  create-only 注册，资料五字段一次原子保存；
- 新增匿名直达但受版本、幂等、Zod、领域不变量和 SQLite 单事务约束的管理员设置、账户
  集合删除、历史赛季集合删除和新赛季边界；
- 账户删除可安全处理开放房间、活动手成员和房主，并保持退款/留池、资产退役、历史
  匿名化、租约失效、同名重建隔离和后续结算守恒；
- 交付 `/admin`、`/admin/accounts`、`/admin/seasons`、两步登录、账户资料、共享 SVG、
  固定三段容器、稳定滚动槽和 body portal 头像菜单；
- 通过最终本地硬门禁、真实 `192.168.100.1` 随机隔离 Docker smoke 和浏览器验收。

本次远端验收没有调用正式部署入口，没有切换正式 `home-table`、固定卷、发布目录或唯一
备份。正式资源前后只读指纹一致，随机容器、卷、镜像和临时归档均已清零，因此本结果
不表示正式发布。

## 2. 阶段与任务状态

| 阶段/任务 | 状态 | 验证结论 | 说明 |
| --- | --- | --- | --- |
| P-001 | completed | passed | 唯一展开阶段，结果见 `phase-001-result.md` |
| P-001-T-001 | completed | passed | 契约、偏好恢复、登录/注册、管理员接口、集合删除、开放房间处理和服务端门禁 |
| P-001-T-002 | completed | passed | Admin/Player Web、共享 UI、设计文档、本地最终门禁和真实远端隔离验收 |

没有下一 initial 阶段，也没有 ready、in_progress、paused 或 blocked 任务。

## 3. 最终检查点

- schema `3.2`；需求、合同、README、AGENTS、相关源码/测试、既有工作流模板、Docker smoke
  和部署边界均完成只读审计。
- 路线图修订 1 保持 `single + expanded`，策略保持 `relaxed`。开放房间批量删除、资产/
  匿名化事务和旧 JSON 偏好迁移风险由展开计划和完整硬门禁覆盖。
- requirements、roadmap 和唯一 phase plan 指纹与计划时一致；没有运行中需求漂移或
  路线图修订。
- P-001-T-001 的 post-task checkpoint 已证明服务器权威偏好、全局默认主题、三段账户
  意图、五字段资料、管理员投影/命令和账户/赛季集合事务成立。
- P-001-T-002 的 post-task checkpoint 已证明管理员和玩家 Web、完整双语、固定容器、
  portal 菜单、设计规范、容量、生产浏览器、离线构建和远端隔离恢复成立。
- 最终源代码通过 `npm run verify:core`；其中 lint、typecheck、platform/server 29/29、
  poker 15/15、realtime 4/4 和生产 Chromium/WebKit 6/6 全部通过。
- `npm run test:capacity` 4/4 通过；生产 Web/server 构建和 2 个 HTML/CSS 产物的无公网
  引用检查通过。
- 本机没有 Docker CLI/daemon；同一 `tests/docker-smoke.mjs` 通过可选 SSH Docker
  驱动在 `192.168.100.1` 的 Docker 27.3.1 / x86-64 上执行最终源代码断言。
- 最终远端归档 SHA-256 为
  `3fa4b952d156b0fc4e18d0ed4f0cad4dd6024d5daa96257bd81bd4a4551d82bb`；
  linux/amd64、离线、非 root、health、旧偏好 JSON、命名卷牌局/私牌、管理员删除、
  租约失效、用户名复用和再次重启均通过。
- 真实远端浏览器通过管理员直达/保存/历史导航、两步注册、32 头像按需展开、账户偏好
  刷新、300 CSS px 固定内部滚动及 portal 菜单视口/Esc/焦点验收；应用来源控制台无错误。
- 正式容器/镜像/running/healthy 与固定卷前后只读指纹均为
  `0a24242101d029f9c77b5e4030709a5b2fad02d078d98545aee136c30327073b`；
  验收后随机 smoke 容器、卷、镜像和临时归档均为 0。
- `git diff --check` 和最终差异归属审计通过；没有临时归档、日志、真实配置、部署接口、
  生成物或其他 feature 冻结历史进入差异。

## 4. 已完成任务

### P-001-T-001

- 扩展共享契约中的账户偏好、全局默认主题、用户名查询和最小管理员投影。
- 通过加法 JSON 归一化恢复旧快照，仅补缺失字段并保留合法已有偏好。
- 分离用户名查询、已有账户进入和新账户注册；实现五字段原子资料更新。
- 新增管理员状态和独立命令分发，收缩普通玩家命令权限。
- 实现账户与历史赛季集合操作，以及开放房间普通成员、活动手和房主的单事务处理。
- 保持资产守恒、稳定匿名化、租约失效、同名重建隔离、公开投影和私牌边界。

### P-001-T-002

- 新增三条管理员路由、通用/扑克设置、管理员专用本地语言/主题和账户/赛季复选管理。
- 完成两步登录、create-only 注册、按需头像和服务器权威资料/音量应用。
- 把玩家大厅收缩为唯一账户入口，并移除旧设备语言/主题权威和玩家管理入口。
- 统一共享 SVG、固定三段容器、稳定滚动槽、确认层和 body portal 锚定菜单。
- 新建 `docs/ui-design-guidelines.md` 并完成双语、300px、键盘、触控和辅助技术语义。
- 更新 platform/server/realtime/E2E/capacity/Docker smoke，并完成最终本地与远端门禁。

## 5. 运行累计文件变化

| 文件或区域 | 模式 | 所有权与目的 |
| --- | --- | --- |
| `docs/requirements/admin-account-preferences-and-ui/requirements.md` | pre-existing/add | 用户批准的澄清需求基线，initial 未改写 |
| `docs/requirements/admin-account-preferences-and-ui/workflow-contract.md` | pre-existing/add | 用户批准的 schema 3.2 合同，initial 未改写 |
| 本功能其余工作流文件 | add | 路线图、阶段计划/结果、完成状态、change-0 和有效需求快照 |
| `packages/contracts/src/index.ts` | modify | 账户偏好、主题、lookup 和最小管理员投影契约 |
| `packages/domain/src/index.ts` | modify | 旧状态补值、账户意图、资料、管理投影、集合删除、开放房间处理和租约恢复 |
| `apps/server/src/app.ts` | modify | lookup/register/enter/admin HTTP 边界、Zod、日志和事务命令分发 |
| `apps/web/src/admin-ui.tsx` | add | 匿名管理员首页、账户/赛季二级页和管理员设备偏好 |
| `apps/web/src/main.tsx` | modify | 两步登录、账户资料、唯一大厅入口、音量、固定层和成员菜单 |
| `apps/web/src/ui.tsx` | modify | 受控主题、共享 SVG、固定面板、确认层和锚定 portal 菜单 |
| `apps/web/src/styles.css` | modify | 固定容器、管理员响应式、资料/注册、稳定滚动槽、portal 层级和 300px |
| `apps/web/src/locales.ts` | modify | 管理、注册、偏好、集合确认和错误的完整中英文文案 |
| `docs/ui-design-guidelines.md` | add | 项目级固定容器、滚动槽、portal、响应式和可访问性规范 |
| `tests/platform.test.ts` | modify | 偏好迁移、租约重启、集合删除、历史匿名化和资产守恒 |
| `tests/server.test.ts` | modify | 新 HTTP/admin 边界、幂等、并发和开放房间集合删除 |
| `tests/realtime.test.ts` | modify | 删除广播、角色投影、会话失效和私牌隔离 |
| `tests/e2e/core.spec.ts` | modify | Chromium/WebKit 管理、注册、偏好、集合、300px 和 portal |
| `tests/capacity.test.ts` | modify | create-only API 与 15 账户、双房间、多 display 容量 |
| `tests/docker-smoke.mjs` | modify | 旧偏好、删除、租约、同名、重启和可选 SSH Docker 驱动 |
| `AGENTS.md` | modify | 同步 2026-07-30 项目阶段快照 |

没有修改 `packages/persistence`、`packages/poker`、`Dockerfile`、`.dockerignore`、
`deploy/**`、其他冻结 feature 历史或生成目录。

## 6. 测试与验证证据

| 日期 | 验证 | 观察结果 | 状态 |
| --- | --- | --- | --- |
| 2026-07-30 | `npm run verify:core` | lint、typecheck、platform/server 29/29、poker 15/15、realtime 4/4、生产 Chromium/WebKit 6/6 | passed |
| 2026-07-30 | E2E 内生产 build / 静态资源检查 | Web/server 构建成功；2 个 HTML/CSS 产物无公网引用 | passed |
| 2026-07-30 | `npm run test:capacity` | 1 个文件 4/4；15 账户、双房间和多 display 有界 | passed |
| 2026-07-30 | 最终源代码远端隔离 Docker smoke | Docker 27.3.1 / x86-64；linux/amd64、离线、非 root、health、迁移、持久化、删除和重启成立 | passed |
| 2026-07-30 | 真实远端浏览器 | 管理、注册、偏好、300px 固定容器、portal 菜单和控制台检查成立 | passed |
| 2026-07-30 | 远端前后只读与清理审计 | 正式资源指纹一致；随机容器/卷/镜像/归档均清零 | passed |
| 2026-07-30 | `git diff --check` / 最终差异审计 | 无空白错误、临时项、敏感配置、部署接口、生成物或越界历史 | passed |

`npm run test:deploy` 未运行，因为差异没有触及 `deploy/**`、`.dockerignore` 或发布接口，
远端验收也没有执行正式发布。成功 npm 命令结束后的用户级 cache 日志清理 `EPERM`
warning 不影响退出码、产物或结论，不构成 finding。

## 7. 决策、偏差与发现项

- 用户确认的交付与验证策略为 `relaxed`；全部 core、硬门禁和 supplemental 验收实际
  通过，没有使用报告后放行。
- 管理员匿名直达、玩家服务器偏好、管理员专用本地偏好、create-only 注册、全账户删除、
  开放房间房主处理、current 赛季保护、共享 SVG、固定容器和 portal 菜单均按批准需求
  实现，没有新增产品决策。
- `DEV-I-001`：T1 为保持全仓 typecheck 提前机械迁移
  `tests/capacity.test.ts` 的两处旧 API；T2 仍完整执行并通过容量门禁。
- 本机无 Docker CLI/daemon，因而为原有 smoke 增加可选 SSH Docker 驱动；同一脚本断言
  在用户授权服务器执行，没有以手工观察替代。
- 首次远端 smoke 暴露测试归一化错误地包含易失 poker 版本和 JSON 键顺序；修复为排除
  明确易失字段并使用深度结构比较后，最终源代码的完整 smoke 通过，核心断言未降级。
- 远端浏览器曾发现注册页当前头像按钮缺少可读名称；完成前增加中英文 `aria-label`，
  最终 E2E 和远端 DOM/交互均通过，因此是已解决实施反馈而非 report-only finding。
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
4. 对涉及正式发布的任务使用受支持部署入口，并把隔离验收与正式发布证据分开。

## 9. 最终完成门禁

| 门禁 | 最终状态 |
| --- | --- |
| P-001-T-001 服务端权威、分层与事务门禁 | passed |
| P-001-T-002 Web/UI、文档、本地与隔离环境门禁 | passed |
| FR-001–FR-036、AC-001–AC-024、NFR-001–NFR-012 完整追踪 | passed |
| 所有 core 与项目硬门禁在最终源代码通过 | passed |
| supplemental 通过或合规 finding 汇总 | passed；无 finding |
| 无 unresolved、blocked、未知影响或远端残留 | passed |
| 正式资源前后只读一致且隔离验收未构成发布 | passed |
| phase result、change-0、effective snapshot 与 completed state 一致 | passed |

验证结论为 `passed`，运行状态冻结为 `completed`。
