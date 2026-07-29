# 管理员设置、账户偏好与界面容器统一：修改记录 0

- 修改编号：`0`
- 修改类型：`首次实现`
- 原始需求：[requirements.md](requirements.md)
- 初始路线图：[implementation-plan.md](implementation-plan.md)，修订 `1`
- 执行状态：[execution/initial/execution-state.md](execution/initial/execution-state.md)
- 项目基线：`main@b131a4c35ec952180beed575e274b9cb27cbccd8`
- 完成日期：`2026-07-30`

## 1. 实现概述

首次实现把危险平台设置与普通玩家流程分离到匿名直达的 `/admin`、
`/admin/accounts` 和 `/admin/seasons`。管理员只获得最小管理投影，并通过独立的
版本化、幂等、校验和 SQLite 事务命令保存全局设置、批量删除账户/历史赛季和开始
新赛季；普通玩家命令不再拥有这些能力。

账户批量删除现在支持开放房间。活动手目标先权威弃牌，投入留池、剩余退款；删除
房主时只转让给未选中在线成员，否则安全关房。房间处理、资产退役、历史匿名化、
租约失效和活动账户删除全成或全败，并保持守恒、同名重建隔离和公共/私牌投影边界。

登录改为只读用户名查询、existing-only 进入和 create-only 注册。语言、亮暗主题和
0–100 音量与用户名、头像一起成为服务器权威账户资料，跨刷新、接管和重启恢复；
旧 JSON 只补缺失字段，重启清除旧租约。大厅只保留一个账户资料入口。

Web 新增全屏管理员应用、复选批量管理、两步注册、头像按需展开、共享 SVG 箭头、
固定三段容器和 body portal 头像菜单。管理员本地语言/主题与玩家账户及全局设置
隔离。`docs/ui-design-guidelines.md` 成为固定外框、滚动、层叠、响应式和可访问性
的项目级依据。

全部本地门禁、真实 iStoreOS 隔离 Docker smoke 和浏览器技能实测通过。远端测试
没有发布正式服务，没有挂载固定卷或读取业务数据库；正式容器/固定卷指纹前后相同，
随机资源已清零。

## 2. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/contracts/src/index.ts` | modify | 主题、账户偏好、用户名查询和 admin 最小投影契约 |
| `packages/domain/src/index.ts` | modify | 偏好迁移、拆分登录、资料保存、集合删除、开放房间和重启租约语义 |
| `apps/server/src/app.ts` | modify | lookup/register/enter/admin 接口、校验、日志、事务分发和玩家命令收缩 |
| `apps/web/src/admin-ui.tsx` | add | 管理员首页、账户/赛季二级路由和本地 admin 偏好 |
| `apps/web/src/main.tsx` | modify | 两步登录、账户偏好、唯一大厅入口、音量、固定 modal 和成员菜单 |
| `apps/web/src/ui.tsx` | modify | 受控主题、SVG 箭头、固定面板、确认层和锚定 portal |
| `apps/web/src/styles.css` | modify | 固定容器、稳定滚动槽、管理响应式、注册/资料和层叠样式 |
| `apps/web/src/locales.ts` | modify | 管理员、注册、偏好、批量操作和错误的中英文文案 |
| `docs/ui-design-guidelines.md` | add | 固化可复用 UI 容器、滚动、portal、响应式和可访问性规则 |
| `tests/platform.test.ts` | modify | 偏好迁移、租约清理、集合删除、匿名化和守恒 |
| `tests/server.test.ts` | modify | HTTP/admin 边界、幂等、并发和开放房间删除 |
| `tests/realtime.test.ts` | modify | 删除广播、角色投影和私牌隔离回归 |
| `tests/e2e/core.spec.ts` | modify | Chromium/WebKit admin、注册、偏好、批量管理、300px 和菜单 |
| `tests/capacity.test.ts` | modify | create-only API 和目标家庭容量回归 |
| `tests/docker-smoke.mjs` | modify | 旧偏好 JSON、admin 删除、租约、用户名复用、重启及可选 SSH Docker 驱动 |
| `AGENTS.md` | modify | 同步 2026-07-30 项目阶段快照 |
| 本功能工作流目录 | add / modify | 保存批准需求、合同、路线图、计划、状态、结果和有效快照 |

没有修改 `packages/persistence`、`packages/poker`、`Dockerfile`、
`.dockerignore`、`deploy/**`、其他冻结历史或生成目录。

## 3. 需求、阶段与任务完成情况

| 范围 | 状态 | 完成证据 |
| --- | --- | --- |
| FR-001–FR-036 | completed | 领域、服务、管理/玩家 Web、共享 UI 和恢复实现全部交付 |
| AC-001–AC-020 core | passed | 分层、生产浏览器、构建、恢复、隐私、容量、远端容器和差异硬门禁通过 |
| AC-021–AC-024 supplemental | passed | Chromium/WebKit、容量、结构化日志、设计文档和真实远端浏览器通过 |
| NFR-001–NFR-012 | passed | 守恒、隐私、响应式、可访问性、双语、恢复、并发、容量、离线和工程边界成立 |
| P-001-T-001 | completed | 服务端权威、接口分层、旧状态恢复和开放房间集合删除完成 |
| P-001-T-002 | completed | Admin/Player Web、共享 UI、设计文档、本地与远端门禁完成 |
| P-001 | completed | 唯一阶段结果与 initial 状态一致冻结 |

本功能路线图没有下一 initial 阶段。

## 4. 测试与验证

- 交付与验证策略：`relaxed`。
- 验证结论：`passed`。
- `npm run verify:core` 通过：
  - lint；
  - typecheck；
  - platform/server 29/29；
  - poker 15/15；
  - realtime 4/4；
  - 生产 Chromium desktop / WebKit mobile 6/6；
  - E2E 内 Web/server build 和静态资源无公网引用检查。
- `npm run test:capacity` 通过，4/4；覆盖 15 在线账户、双房间和多 display。
- 最终源码 iStoreOS 隔离 Docker smoke 通过：Docker server 27.3.1 / x86-64，
  linux/amd64、离线启动、非 root、health、旧 JSON 偏好、命名卷牌局/私牌、
  admin 删除、租约失效、用户名复用和再次重启均成立。
- 真实远端浏览器通过：admin 直达/保存/历史导航、两步注册、偏好刷新、300px
  固定滚动、头像菜单 portal/视口/Esc/焦点，以及应用来源零控制台错误。
- 远端前后正式资源指纹
  `0a24242101d029f9c77b5e4030709a5b2fad02d078d98545aee136c30327073b`
  一致；随机 smoke 容器、卷、镜像均为 0，临时归档和日志已删除。
- `git diff --check` 和最终差异归属审计通过。

没有运行 `npm run test:deploy`：实现未触及部署接口，远端验收也没有正式发布。
成功 npm 命令后的用户级日志目录 `EPERM` warning 不影响退出码或产物，不构成
finding。

## 5. 与路线图及阶段计划的偏差

- 没有改变需求、阶段数、任务顺序、交付策略或验证范围。
- T1 为全仓 typecheck 提前机械迁移 `tests/capacity.test.ts` 的两处旧 API；
  T2 仍完整执行容量门禁，记为 `DEV-I-001`。
- 本机没有 Docker CLI/daemon，因此为既有 smoke 增加可选 SSH Docker 驱动；
  所有业务断言仍由同一脚本执行，没有以手工观察替代。
- 远端 browser 在完成前发现注册头像按钮缺少可读名称；修复并重建后中英文
  `aria-label`、E2E 和远端实测均通过。
- 未触及计划列为需暂停修订的扑克引擎、持久化实现、Dockerfile、`.dockerignore`
  或部署文件，路线图和阶段计划保持修订 1。

## 6. 遗留事项

没有开放 `FND-I-*`、未决问题、阻塞或已知交付缺口。下一可用 finding ID仍为
`FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

本记录创建后，原始需求、initial 路线图、阶段计划/结果、completed 状态和本记录均为
冻结历史。未来产品变化必须从
[effective-requirements.md](effective-requirements.md) 发起连续 `change-N` 运行。
