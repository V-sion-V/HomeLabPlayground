# P-001 阶段结果：管理员设置、账户偏好与统一 UI 容器

- 运行编号：`initial`
- 阶段编号：`P-001`
- 阶段计划：[phase-001-plan.md](phase-001-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 开始基线：干净的 `main@b131a4c35ec952180beed575e274b9cb27cbccd8`
- 完成基线：上述提交加本结果第 3 节列出的工作区差异
- 完成日期：`2026-07-30`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 阶段目标与结果

P-001 在唯一展开阶段内完成了 FR-001–FR-036、AC-001–AC-024 和
NFR-001–NFR-012。

平台新增无需登录、只能通过地址进入的 `/admin`、`/admin/accounts` 和
`/admin/seasons`。匿名管理员只获得账户管理摘要、当前/历史赛季和全局设置；
设置、账户集合删除、历史赛季集合删除和新赛季使用独立 admin 命令边界，同时保留
期望版本、命令幂等、Zod 校验和 SQLite 单事务。普通玩家命令不再承载全局设置、
账户/赛季删除或新赛季能力。

账户集合删除可在开放房间中执行。非房主按权威语义强制弃牌、投入留池、剩余筹码
退款并移除座位；被选房主只转让给未选中且在线成员，无候选时安全作废、退款、兑换
和关房。房间处理、资产退役、历史匿名化、租约失效和活动账户删除在同一事务内
全成或全败。当前手中的已删身份只保留稳定匿名历史，后续结算和关房仍保持资产守恒。

登录拆分为只读用户名查询、existing-only 进入和 create-only 注册。账户语言、
`light`/`dark` 和 0–100 音量成为服务器权威字段，与用户名和头像一次原子保存；
旧 JSON 只补缺失默认值，合法已有偏好不被覆盖，重启会清除旧控制租约。大厅只保留
头像/用户名账户入口，玩家侧不再使用 `party-language` 或 `party-theme`。

Web 新增独立管理员应用、固定面板、共享 SVG 箭头、固定 modal 三段结构和 body
portal 锚定菜单。管理员本地语言/主题使用专用设备键，与玩家偏好和全局待保存设置
隔离。账户和赛季管理使用复选框、全选/取消、不确定状态、选中数量和单一危险操作。
所有 modal/固定面板现在由固定顶栏、唯一内部滚动区和固定底栏组成；头像菜单位于
座位层级之外，保持视口内定位、Esc/外部点击关闭及焦点恢复。项目级规则已写入
`docs/ui-design-guidelines.md`。

最终本地分层门禁、生产 Chromium/WebKit、容量、构建、静态资源和真实 iStoreOS
隔离 Docker smoke 全部通过。浏览器技能在随机候选容器上实测管理员路由、注册、
偏好刷新、300px 固定滚动和头像菜单。正式容器和固定卷前后只读指纹一致，随机
容器、卷、镜像及临时归档已清零；本结果不表示正式发布。

## 2. 任务、需求与验收覆盖

| 任务 | 完成结果 | 需求范围 | 主要证据 |
| --- | --- | --- | --- |
| P-001-T-001 | completed | FR-004–FR-005、FR-010–FR-018、FR-020、FR-022、FR-027–FR-030；数据、隐私、恢复、并发 NFR | typecheck；platform/server 29/29；poker 15/15；realtime 4/4 |
| P-001-T-002 | completed | FR-001–FR-003、FR-006–FR-009、FR-019–FR-036；Web、双语、可访问性、响应式、离线和容量 NFR | lint；生产 Chromium/WebKit 6/6；capacity 4/4；生产 build/静态资源；远端 Docker smoke 与浏览器实测 |

| 验收范围 | 层级 | 通过证据 |
| --- | --- | --- |
| AC-001–AC-004 | core | admin 直达/刷新/保存、双列/单列、任意正整数超时、原子设置和 SVG 收起状态由 server/E2E/远端浏览器覆盖 |
| AC-005–AC-008 | core | read-only lookup、create-only 注册、五字段原子资料、服务器偏好、main/poker scope、静音和刷新/重启由 platform/server/E2E/Docker 覆盖 |
| AC-009–AC-015 | core | 账户/赛季复选、全选、不确定状态、开放房间删除、房主转让/关房、匿名化、同名重建及二级历史路由由 platform/server/realtime/E2E/Docker 覆盖 |
| AC-016–AC-017 | core | 固定三段容器、稳定滚动槽和 body portal 菜单由 Chromium/WebKit、300px E2E 和远端浏览器几何/焦点检查覆盖 |
| AC-018–AC-020 | core | 旧 JSON、租约清理、隐私最小投影、离线资源、完整本地硬门禁和最终差异检查通过 |
| AC-021–AC-024 | supplemental | Chromium/WebKit 6/6、capacity 4/4、结构化拒绝日志测试、UI 设计文档独立审阅及远端浏览器通过 |

没有验收降级、用户豁免或报告后放行。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/contracts/src/index.ts` | modify | 增加主题、账户偏好、用户名查询和最小 admin 投影契约 |
| `packages/domain/src/index.ts` | modify | 实现旧状态补值、拆分登录意图、五字段资料、管理投影、集合删除、开放房间处理和重启租约清理 |
| `apps/server/src/app.ts` | modify | 增加 lookup/register/existing enter/admin HTTP 边界、最小日志、事务分发和普通玩家命令收缩 |
| `apps/web/src/admin-ui.tsx` | add | 提供三个匿名管理路由、全局设置、账户/赛季批量管理和本地 admin 偏好 |
| `apps/web/src/main.tsx` | modify | 接入两步登录、账户偏好、唯一大厅入口、音量、固定 modal 和 portal 成员菜单 |
| `apps/web/src/ui.tsx` | modify | 增加受控主题、共享 SVG 箭头、固定面板、确认层和锚定 portal 菜单 |
| `apps/web/src/styles.css` | modify | 增加三段固定容器、admin 响应式、注册/资料、稳定滚动槽、portal 层级和 300px 规则 |
| `apps/web/src/locales.ts` | modify | 增加管理员、注册、账户偏好、批量确认和错误的完整中英文文案 |
| `docs/ui-design-guidelines.md` | add | 固化固定外框、顶底栏、滚动、portal、响应式和可访问性规范 |
| `tests/platform.test.ts` | modify | 覆盖偏好迁移、租约重启、集合删除、匿名历史和资产守恒 |
| `tests/server.test.ts` | modify | 覆盖新 HTTP 边界、admin 投影/命令、幂等、并发和开放房间删除 |
| `tests/realtime.test.ts` | modify | 迁移集合删除并回归角色投影、会话失效和私牌隔离 |
| `tests/e2e/core.spec.ts` | modify | 覆盖桌面/手机 admin、两步注册、偏好、批量管理、300px 和 portal 菜单 |
| `tests/capacity.test.ts` | modify | 迁移 create-only API 并回归 15 账户、双房间和多 display 容量 |
| `tests/docker-smoke.mjs` | modify | 覆盖旧偏好 JSON、admin 删除、租约失效、同名重建和三次重启，并支持经 SSH 驱动远端 Docker |
| `AGENTS.md` | modify | 同步 2026-07-30 项目阶段快照 |
| 本功能工作流目录 | add / modify | 保存批准需求、合同、路线图、阶段计划、执行状态和收口证据 |

没有修改 `packages/persistence`、`packages/poker`、`Dockerfile`、`.dockerignore`、
`deploy/**`、其他冻结功能历史或生成目录。

## 4. 测试与验证

| 验证 | 观察结果 |
| --- | --- |
| `npm run verify:core` | 通过；lint、typecheck、platform/server 29/29、poker 15/15、realtime 4/4、生产 Chromium/WebKit 6/6 |
| E2E 内 `npm run build` / 静态资源检查 | 通过；Web/server 生产构建成功，2 个 HTML/CSS 产物无公网引用 |
| `npm run test:capacity` | 通过；1 个文件，4/4；15 在线账户、双房间和多 display 同步保持有界 |
| 最终源码 iStoreOS 隔离 Docker smoke | 通过；Docker server 27.3.1 / x86-64；linux/amd64、离线、非 root、health、旧偏好 JSON、牌局/私牌、admin 删除、租约失效、用户名复用及再次重启成立 |
| 真实远端浏览器 | 通过；admin 直达/保存/历史导航、两步注册、32 头像按需展开、语言/主题/音量刷新、300 CSS px 内部滚动、portal 菜单视口定位/Esc/焦点恢复；应用来源控制台无错误 |
| 远端前后只读审计 | 通过；正式容器 ID/镜像/running/healthy 与固定卷指纹均为 `0a242421…7073b`；随机 smoke 容器/卷/镜像为 0 |
| `git diff --check` / 最终差异审计 | 通过；无空白错误、临时归档、日志、真实配置、部署接口、生成物或其他功能历史 |

最终远端归档 SHA-256 为
`3fa4b952d156b0fc4e18d0ed4f0cad4dd6024d5daa96257bd81bd4a4551d82bb`，
上传后校验一致并在验收后删除。

`npm run test:deploy` 未运行，因为实际差异没有触及部署接口。npm 在成功命令后报告
无法清理用户级日志目录的 `EPERM` warning；所有测试、构建和命令退出码未受影响，
不构成 finding。

## 5. 发现项与处置

无开放 `FND-I-*`；下一可用编号仍为 `FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

远端浏览器曾发现注册页当前头像按钮缺少可读名称；在阶段完成前增加本地化
`aria-label`，重建后 DOM 明确显示“选择头像”/“Choose avatar”，最终 E2E 和远端
浏览器均通过，因此它是已解决的实施反馈，不是 report-only finding。

## 6. 决策、计划偏差与恢复记录

- 保持用户选择的 `relaxed` 策略；全部 core、硬门禁和 supplemental 实际通过。
- 使用现有 SQLite JSON 快照和 `PlatformStore.execute()`，没有新增 SQL migration
  或运行时依赖。
- T1 为保持全仓 typecheck，提前机械迁移了 `tests/capacity.test.ts` 的两处旧 API；
  容量结果仍由 T2 正式执行并通过，记录为 `DEV-I-001`。
- 本机没有 Docker CLI/daemon。现有 `tests/docker-smoke.mjs` 增加可选 SSH Docker
  驱动，使用用户已授权连接运行原有断言；没有下载或安装本地工具。
- 第一次远端 smoke 暴露了测试归一化把易失 poker 版本及 JSON 键顺序当作持久差异；
  修正为排除明确易失字段并使用深度结构比较后，最终源码完整 smoke 通过。核心断言
  没有降级。
- 远端只使用随机、带所有权边界的镜像、容器、端口、卷和 `/tmp` 归档；没有调用
  `deploy/deploy.ps1`、没有挂载固定卷、没有读取业务 SQLite、没有切换正式服务。

## 7. 遗留风险与下一阶段进入条件

没有阻止交付的遗留风险、未决产品问题、开放 finding、未知影响或下一 initial 阶段。
P-001 是路线图唯一阶段。

本结果、completed execution state、`change-0.md` 和
`effective-requirements.md` 创建后，initial 历史冻结。后续产品变化必须从有效需求
快照发起连续 `change-N` 运行。

正式发布不属于本阶段；本次只完成了用户授权的隔离部署环境测试。
