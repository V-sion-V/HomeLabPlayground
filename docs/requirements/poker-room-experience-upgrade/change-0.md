# 德州扑克房间体验与全局界面增强：修改记录 0

- 修改编号：`0`
- 修改类型：`首次实现`
- 原始需求：[requirements.md](requirements.md)
- 初始路线图：[implementation-plan.md](implementation-plan.md)
- 执行计划：[execution/initial/phase-001-plan.md](execution/initial/phase-001-plan.md)
- 完成执行状态：[execution/initial/execution-state.md](execution/initial/execution-state.md)
- 阶段结果：[execution/initial/phase-001-result.md](execution/initial/phase-001-result.md)
- 项目基线：干净的 `main@b204ea246e4c0e9770893bc737c5c631838ff33f`；完成状态为该基线加本记录第 2 节列出的未提交工作树差异
- 完成日期：`2026-07-28`

## 1. 实现概述

首次实现交付了德州扑克房间成员、当前手参赛者和观众的权威分层。用户可以加入等待、进行中或暂停的未满房间；活动手牌中途加入者先进入公共大屏级观战页面，完整结算后成为可准备成员。首局与后续手牌都使用方案 A：房主自动参赛，至少一名在线、有筹码的非房主准备后，由房主显式开始；存在未准备成员时先确认，并仅让房主与有效准备成员参赛。

房主可以从玩家头像菜单转让或确认踢出成员，也可在顶部确认退出。牌中踢出或房主退出由服务端权威强制弃牌，已投入筹码留在底池，剩余筹码兑换；房主退出在同一事务中随机转让给在线成员，无候选时安全作废、退款并关闭。退出和关闭操作已移动到返回大厅右侧。

全局扑克设置新增可编辑并持久化的 1–16 个筹码面值；旧数据库补历史默认值，活动手牌保存独立快照，完整结算后同步最新全局值。产品 UI 配置集中定义 32 个可选头像、不可选回退头像、主界面与扑克界面各自的亮暗主题、花色和筹码色板。设置窗口、内部滚动、默认折叠、卡片、风格化下拉、数字输入、交互反馈、主/次操作布局、双语、300px 和触控/键盘体验均已完成。

最终本地分层、生产 Chromium/WebKit、容量、生产构建、静态资源和远端 iStoreOS Docker smoke 全部通过。远端测试只使用随机临时镜像、容器和卷；正式 b949 服务及固定业务卷在测试前后保持不变。

## 2. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/contracts/src/product-config.ts` | add | 集中配置头像、回退头像、主题语义令牌、花色和筹码色板 |
| `packages/contracts/src/index.ts` | modify | 扩展全局/每手面值、准备、成员角色和 viewer 投影契约 |
| `packages/domain/src/index.ts` | modify | 实现兼容归一化、成员/参赛者分层、准备、设置、头像、资产与投影不变量 |
| `packages/poker/src/index.ts` | modify | 保存每手筹码面值快照 |
| `apps/server/src/app.ts` | modify | 实现活动加入、显式准备/开手、在线踢出、房主退出/随机转让和授权 |
| `apps/web/src/ui.tsx` | add | 提供主题、可访问 listbox、折叠卡片和确认对话框 |
| `apps/web/src/main.tsx` | modify | 集成房间管理、观战、统一准备、设置、主题、动态面值/头像和有界筹码渲染 |
| `apps/web/src/styles.css` | modify | 实现语义配色、固定 modal、卡片、交互反馈、触控、窄屏和减少动态效果 |
| `apps/web/src/locales.ts`、`apps/web/index.html` | modify | 增加中英文文案并允许设备主题同步页面颜色 |
| `tests/platform.test.ts`、`tests/server.test.ts`、`tests/poker.test.ts`、`tests/realtime.test.ts` | modify | 增加领域、持久化、服务、扑克与私牌隔离证据 |
| `tests/e2e/core.spec.ts`、`tests/capacity.test.ts` | modify | 增加真实生产浏览器流程和容量/隔离场景 |
| `tests/docker-smoke.mjs` | modify | 适配准备语义并支持远端随机端口 HTTP 断言 |
| `Dockerfile` | modify | 为 legacy builder 提供固定 `linux/amd64` 默认平台 |
| `AGENTS.md` | modify | 同步仓库当前阶段快照 |
| `implementation-plan.md` | add | 保存 schema-v3.2 单阶段展开路线图和追踪矩阵 |
| `execution/initial/phase-001-plan.md` | add | 保存 P-001 的四次计划修订、任务、门禁和恢复说明 |
| `execution/initial/phase-001-result.md` | add | 冻结 P-001 完成证据 |
| `execution/initial/execution-state.md` | add | 保存并最终冻结 initial 可恢复执行状态 |
| `change-0.md` | add | 汇总首次实现并冻结编号历史 |
| `effective-requirements.md` | add | 生成应用 change-0 后的自包含当前产品需求权威快照 |

`requirements.md`、`workflow-contract.md`、`deploy/**`、`.dockerignore`、其他已冻结功能工作流和生成目录没有修改。

## 3. 需求、阶段与任务完成情况

- 原始需求 `FR-001`–`FR-021` 全部生效；`NFR-001`–`NFR-011` 全部满足。
- 验收 `AC-001`–`AC-026` 全部通过，其中 23 项为 `core`、3 项为 `supplemental`。
- 用户明确选择 `relaxed` 交付策略；方案 A 明确为房主自动参赛，房主加至少一名有效已准备玩家即可开始。
- 初始路线图采用 `single + expanded`，唯一阶段 P-001 已完成。
- P-001-T-001 已完成服务端权威配置、成员/参赛者状态、准备、动态面值、头像迁移、房主管理、资产和私牌投影。
- P-001-T-002 已完成设置、主题、成员菜单、顶部操作、统一准备、登录观战、双语响应式交互和全部最终门禁。
- 完成证据以 [phase-001-result.md](execution/initial/phase-001-result.md) 为准；当前权威产品行为以 [effective-requirements.md](effective-requirements.md) 为准。

## 4. 测试与验证

- 交付与验证策略：`relaxed`。
- 验证结论：`passed`。
- `npm run lint` 与 `npm run typecheck` 通过。
- `npm run test:platform` 通过：2 个文件、20/20 测试。
- `npm run test:poker` 通过：1 个文件、15/15 测试。
- `npm run test:realtime` 通过：1 个文件、3/3 测试。
- `npm run test:e2e:core` 通过：生产 Chromium desktop 与 WebKit mobile 共 4/4；内部生产 build 和静态资源无公网引用检查通过。
- `npm run test:capacity` 通过：1 个文件、3/3；15 账户、两房间、多 display 无串房或私牌泄漏。
- `npm run test:docker-smoke` 通过：当前工作树在 iStoreOS Docker 27.3.1 / amd64 上构建，离线启动、非 root、健康、随机命名卷牌局/私牌恢复及重启连接归一化均通过。
- Docker 前后审计确认正式 `deploy-home-table-1` 仍运行 b949 镜像并 healthy，固定 `home-party-game-platform-data` 存在，随机 smoke 容器、卷和镜像标签均已清理。
- `git diff --check` 和最终差异范围审计通过。

## 5. 与路线图及阶段计划的偏差

- 即时计划修订 2 仅更正 Docker smoke 文件的实际扩展名。
- E2E 首次运行发现牌桌成员菜单被底部操作区拦截指针事件；修复定位后重跑 Chromium/WebKit 通过。
- T2 为结算成员角色连续性回改领域投影；随后重跑受影响的 typecheck、platform 和 realtime。
- 本机没有 Docker CLI/daemon，initial 曾按 core 硬门禁暂停。用户授权使用既有自动化部署 SSH 边界后，计划修订 3 改为在远端 daemon 执行同一隔离 smoke，没有切换生产。
- 首次远端构建发现服务器使用 legacy builder，未注入 BuildKit 自动 `BUILDPLATFORM`。计划修订 4 为既有 `linux/amd64` 目标声明默认值；第二次远端冷构建及全部 smoke 断言通过。
- 上述偏差均在 P-001 内恢复并关闭，没有新增产品阶段、需求变化、验收降级或正式部署动作。

## 6. 遗留事项

无开放 `FND-I-*`、未决产品问题或阻塞项；下一个可用初始发现编号保留为 `FND-I-001`，但不会在已冻结的 initial 运行中继续分配。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | 后续需求通过新的 `change-N` 运行处理 |
