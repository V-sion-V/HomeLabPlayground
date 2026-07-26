# 家庭聚会游戏平台：修改记录 0

- 修改编号：`0`
- 修改类型：`首次实现`
- 原始需求：[requirements.md](requirements.md)
- 初始路线图：[implementation-plan.md](implementation-plan.md)
- 执行计划：[execution/initial/phase-001-plan.md](execution/initial/phase-001-plan.md)
- 完成执行状态：[execution/initial/execution-state.md](execution/initial/execution-state.md)
- 阶段结果：[execution/initial/phase-001-result.md](execution/initial/phase-001-result.md)
- 项目基线：从 `2026-07-26` 的非 Git 空白工作区开始；完成产品基线为 Git 修订 `43bc732b132ced577c2ce1cf7495e6dd7769a26f`
- 完成日期：`2026-07-27`

## 1. 实现概述

首次实现交付了一个面向家庭局域网的统一 Web 聚会游戏平台，并完成首个游戏“德州扑克”。平台提供免密码账户与资料、双语和设备偏好、房间与唯一控制连接、公共大屏、全局设置、赛季与历史排行榜、守恒型积分/筹码资产、SQLite 持久化与恢复。

德州扑克支持 2–10 人无上限现金桌，包含“仅筹码”和“筹码＋牌”模式，覆盖按钮和盲注、标准行动、全押、主池/边池、平分、服务端牌组/牌型、房主手动结算、结果撤销、有限下注撤销、自动推进等待、音效、触控/鼠标/键盘筹码缓存，以及按玩家/公共大屏隔离的实时投影。

生产交付为 x86-64 Node.js 24 多阶段 Docker 镜像：以非 root 用户运行，通过命名卷保存 `/data`，提供健康检查，运行时不依赖公网。最终源状态已在 iStoreOS 上完成 Compose、持久化恢复、真实 Chrome 和无网络容器验证。

## 2. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `.dockerignore`、`.gitattributes`、`.gitignore` | add | 定义构建上下文、文本规范和生成物边界 |
| `package.json`、`package-lock.json`、`tsconfig.json`、`eslint.config.js`、`vitest.config.ts` | add | 建立锁定依赖的 TypeScript workspace、静态检查、构建和测试入口 |
| `apps/server/package.json`、`apps/server/src/**` | add | Fastify HTTP/WebSocket 服务、权威命令处理、投影、健康检查、静态托管和结构化日志 |
| `apps/web/package.json`、`apps/web/index.html`、`apps/web/src/**`、`apps/web/vite.config.ts` | add | 响应式双语大厅、设置、赛季/排行榜、玩家牌桌、筹码交互、音效和公共大屏 |
| `packages/contracts/**` | add | 共享命令、响应、错误、状态、结果和角色投影契约 |
| `packages/domain/**` | add | 账户、连接租约、房间、赛季、排行榜、资产、幂等和恢复领域模型 |
| `packages/persistence/**` | add | SQLite 迁移、事务、快照、原子流水、幂等结果与启动恢复 |
| `packages/poker/**` | add | 两种无上限德州扑克状态机、牌型、底池、结算、撤销和自动推进 |
| `packages/test-support/**` | add | 确定性时钟、随机源、牌组与平台测试辅助 |
| `tests/platform.test.ts`、`tests/server.test.ts`、`tests/poker.test.ts`、`tests/realtime.test.ts` | add | 平台、服务、持久化、扑克规则、隐私投影和并发的确定性验证 |
| `tests/e2e/core.spec.ts`、`tests/capacity.test.ts`、`tests/docker-smoke.mjs` | add | 生产浏览器、目标容量、离线/非 root/命名卷容器验证 |
| `scripts/run-e2e.mjs`、`scripts/verify-static-assets.mjs`、`playwright.config.ts` | add | 启动真实生产服务执行 Chromium/WebKit E2E，并验证无外部静态依赖 |
| `Dockerfile`、`deploy/compose.yml`、`deploy/README.md`、`README.md` | add | 非 root 生产镜像、iStoreOS Compose、持久化卷、健康与升级运维说明 |
| `requirements.md`、`workflow-contract.md`、`implementation-plan.md` | add | 保存原始需求、schema 3.2 契约和初始路线图 |
| `execution/initial/phase-001-plan.md`、`execution/initial/phase-001-result.md`、`execution/initial/execution-state.md` | add | 保存完整初始执行计划、不可变阶段结果和完成状态 |
| `change-0.md`、`effective-requirements.md` | add | 冻结首次实现记录并生成当前产品权威需求快照 |

## 3. 需求、阶段与任务完成情况

- 原始需求 `FR-001`–`FR-057` 全部生效；`NFR-001`–`NFR-012` 全部满足。
- 验收 `AC-001`–`AC-030` 全部通过，其中 28 项为 `core`、2 项为 `supplemental`。
- 初始路线图采用 `single` + `compact`，唯一阶段 P-001 已完成。
- P-001-T-001 已完成平台、资产、持久化和恢复核心。
- P-001-T-002 已完成两种扑克模式、真实玩家端和只读公共大屏。
- P-001-T-003 已完成生产打包、静态资源、结构化日志、容量、浏览器、目标 Docker 离线及恢复门禁。
- 完成证据以 [phase-001-result.md](execution/initial/phase-001-result.md) 为准；当前权威产品行为以 [effective-requirements.md](effective-requirements.md) 为准。

## 4. 测试与验证

- 交付与验证策略：`relaxed`。
- 验证结论：`passed`。
- `npm run verify:core` 通过：lint、typecheck、platform/server 14/14、poker 14/14、realtime 3/3、生产构建、静态资源检查、Chromium 桌面与 WebKit 手机 4/4。
- `npm run test:capacity` 通过 3/3：15 个账户、2 个房间、15 个玩家 WebSocket、4 个大屏 WebSocket 无串房或私有状态泄露。
- `npm test` 通过：5 个文件、34/34 测试。
- 最终部署归档 SHA-256 为 `57312dcaa3f2f8c83f914ef9d5e7d7631585160b9bed5073516c51de00123b4a`。
- iStoreOS Compose 服务健康、`/healthz` 成功、运行身份 `uid=1000(node)`；命名卷资产跨最终镜像替换保持。
- iStoreOS `--network none` 独立容器保持 `healthy`，无需公网；临时容器与卷已清理。
- 目标 Chrome 加载最终静态资源并通过局域网 HTTP 建房、双玩家/大屏、撤销、结算、重连、关闭兑换及最终资产检查。

## 5. 与路线图及阶段计划的偏差

- 初版客户端和浏览器测试曾以固定演示状态及路由桩通过，目标部署审计发现与权威服务未集成。冻结前已替换为真实 Fastify/WebSocket/SQLite 客户端和生产 E2E，并重跑全部相关门禁。
- 目标局域网非安全 HTTP 暴露 `crypto.randomUUID` 兼容缺陷；加入降级 ID 后由本地与目标 Chrome 验证。
- 标准规则逐条审计追加发现短额大盲与累计短额全押的加注边界；在本记录冻结前修复并增加回归。
- 本地环境没有 Docker CLI/daemon；计划中的容器验证由目标 x86-64 iStoreOS 完成，实际证据覆盖 Compose、命名卷替换、无网络和非 root 运行，未降低门禁。
- 上述偏差均在 P-001 内恢复并关闭，没有新增阶段、需求变更或用户豁免。

## 6. 遗留事项

无开放 `FND-I-*`、未决产品问题或阻塞项；下一个可用初始发现编号保留为 `FND-I-001`，但不会在已冻结的 initial 运行中继续分配。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | 后续需求通过新的 `change-N` 运行处理 |
