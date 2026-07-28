# P-001 阶段结果：平台数据管理、共享易用性与扑克生命周期

- 运行编号：`initial`
- 阶段编号：`P-001`
- 阶段计划：[phase-001-plan.md](phase-001-plan.md)
- 阶段计划修订：`1`
- 父路线图修订：`1`
- 开始基线：干净的 `main@d55c2568abcb2b67871c58b53559d7b05a32232c`
- 完成基线：上述提交加本结果第 3 节列出的工作区差异
- 完成日期：`2026-07-29`
- 状态：`completed`
- 交付与验证策略：`relaxed`
- 验证结论：`passed`

## 1. 阶段目标与结果

P-001 在一个展开阶段内完成了全部 initial 需求。

平台现在通过游戏无关的参赛事实生成当前排行榜和新历史快照；仅正常、未撤销的持久化
结果会产生资格。排行榜使用单一可访问赛季下拉，新赛季允许为空，已有历史快照保持
原语义。

账户管理支持逐个删除（含自删）和原子批量删除其他账户。服务端在无开放房间、有效
控制租约和最新平台版本下执行删除；退役流水使当前赛季满足“净发行 = 账户资产 +
桌上资产”，旧租约同时失效。保留历史使用随机公开 ID、稳定匿名序号和中性展示身份，
不保存原用户名/头像副本，不向普通投影暴露内部映射；同名重建产生完全独立账户。
赛季管理支持逐个或批量永久删除历史赛季及其排行榜、手牌和流水，当前赛季始终受
保护。

德州扑克完整结算后的当前成员和筹码以 `Room.seats` 为权威。退出会结清筹码、移除
座位与准备并标记旧手牌参与者只作历史用途；同一账户可按新买入重新加入，下一手不会
再读取旧零筹码。结算时座位筹码与扑克结果同步；有人退出后禁止撤销该结算，避免恢复
已经兑换的旧成员资产。

Web 新增独立平台组件承载排行榜、账户管理和赛季管理，不导入扑克状态或扑克视图。
语言/主题入口只保留在登录和大厅；游戏等待、玩家牌桌、观战、结算和公共大屏不再
显示这些控件。现有静音按钮和 `party-muted` 生效已移除，阶段提示音仍在浏览器允许时
播放。移动座位分别显示带标签的剩余筹码与本轮下注，300px 顶部操作、房间名和账户名
互不重叠。正常同步静默清理缓存，真实错误显示友好双语说明和稳定诊断码。

最终本地分层、生产浏览器、容量、构建、静态资源和真实 iStoreOS 隔离 Docker smoke
全部通过。远端测试只使用随机临时镜像、容器、端口和命名卷；正式单容器、运行镜像、
release SHA、固定业务卷和唯一备份指纹在测试前后完全不变，临时资源已清零。本结果不
表示正式发布。

## 2. 任务、需求与验收覆盖

| 任务 | 完成结果 | 需求范围 | 主要证据 |
| --- | --- | --- | --- |
| P-001-T-001 | completed | FR-001、FR-005–FR-012；AC-001–AC-002、AC-006–AC-013、AC-015、AC-018；数据/隐私/恢复/并发 NFR | typecheck；platform 25/25；poker 15/15；realtime 4/4 |
| P-001-T-002 | completed | FR-002–FR-004、FR-007–FR-008、FR-010、FR-013；AC-003–AC-005、AC-008–AC-009、AC-011、AC-014、AC-016–AC-019；Web/离线/容量 NFR | lint；生产 Chromium/WebKit 6/6；capacity 4/4；生产 build/静态资源；远端 Docker smoke；差异审计 |

| 验收范围 | 层级 | 通过证据 |
| --- | --- | --- |
| AC-001–AC-002 | core | platform/server/E2E/Docker 覆盖 complete 退出、重进、新买入、下一手、版本重放与重启 |
| AC-003–AC-006 | core | Chromium/WebKit 与源码检查覆盖声音、移动座位、共享控件所有权、300px 顶部和友好错误 |
| AC-007–AC-008 | core | platform 与 E2E 覆盖有效/作废/撤销/仅观战资格、空榜、单一下拉、倒序和删除回退 |
| AC-009–AC-012 | core | platform/server/realtime/E2E 覆盖自删、批量保护、匿名化、会话失效、赛季保护、房间门禁、事务和幂等 |
| AC-013–AC-016 | core | 旧 JSON、Docker 三次重启、私牌隔离、双语/300px、完整核心回归和离线构建全部通过 |
| AC-017–AC-019 | supplemental | Chromium/WebKit 6/6、结构化拒绝测试、15 账户/双房间/20 历史赛季容量场景通过 |

FR-001–FR-013、AC-001–AC-019 和 NFR-001–NFR-011 均已覆盖，没有验收降级、
用户豁免或报告后放行。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/contracts/src/index.ts` | modify | 增加退役身份、匿名历史、参赛事实、管理摘要、删除结果和两手间离开标记契约 |
| `packages/domain/src/index.ts` | modify | 实现排行榜资格、账户/赛季删除、匿名化、资产退役、不变量、旧状态归一化及座位筹码权威 |
| `apps/server/src/app.ts` | modify | 增加四类删除命令、租约事务分发、下一手座位选择、结算同步和离开后撤销保护 |
| `apps/web/src/platform-ui.tsx` | add | 提供游戏无关排行榜、账户管理、赛季管理和显式确认流程 |
| `apps/web/src/main.tsx` | modify | 接入平台组件、自删会话清理、共享控件规则、声音、移动座位和错误呈现 |
| `apps/web/src/styles.css`、`apps/web/src/locales.ts` | modify | 增加管理 modal、单一下拉、空/保护/危险状态、300px 布局和完整双语文案 |
| `tests/platform.test.ts` | modify | 覆盖参赛筛选、匿名化、同名重建、退役守恒、赛季清理和旧状态 |
| `tests/server.test.ts` | modify | 覆盖删除命令、重放/过期、租约失效及完整结算退出重进 |
| `tests/realtime.test.ts` | modify | 覆盖匿名历史投影、内部映射隔离和公共隐私 |
| `tests/e2e/core.spec.ts` | modify | 覆盖桌面/手机平台管理、赛季保护、自删、共享控件、声音和 300px 牌桌 |
| `tests/capacity.test.ts` | modify | 覆盖 15 账户、双房间、20 历史赛季和批量删除的有界投影 |
| `tests/docker-smoke.mjs` | modify | 覆盖旧 JSON、牌局/私牌、账户匿名化、用户名复用和三次容器重启 |
| `AGENTS.md` | modify | 同步 2026-07-29 项目阶段快照 |
| `requirements.md`、`implementation-plan.md`、`workflow-contract.md` | add | 保留批准需求、路线图和 schema-v3.2 合同 |
| `execution/initial/phase-001-plan.md`、`execution-state.md`、本结果 | add | 保留即时计划、可恢复执行证据和不可变阶段结果 |

`apps/web/src/ui.tsx` 无需修改，既有 `SelectField` 和 `ConfirmDialog` 已满足计划接口。
没有修改 `packages/poker`、`packages/persistence`、`Dockerfile`、`.dockerignore`、
`deploy/**`、其他冻结功能历史或生成目录。

## 4. 测试与验证

| 验证 | 观察结果 |
| --- | --- |
| `npm run lint` | 通过；最终 TypeScript/TSX/JS/MJS 无 ESLint 错误 |
| `npm run typecheck` | 通过；共享契约、领域、服务和 Web 使用一致 |
| `npm run test:platform` | 通过；2 个文件，25/25 测试 |
| `npm run test:poker` | 通过；1 个文件，15/15 规则回归 |
| `npm run test:realtime` | 通过；1 个文件，4/4；匿名投影与玩家/观众/display 私牌隔离成立 |
| `npm run test:e2e:core` | 通过；生产 Chromium desktop 与 WebKit mobile 共 6/6；包含显式 300px 场景 |
| E2E 内 `npm run build` / 静态资源检查 | 通过；Web/server 生产构建成功，2 个 HTML/CSS 产物无公网引用 |
| `npm run test:capacity` | 通过；1 个文件，4/4；15 在线账户、双房间、20 历史赛季和批量管理 |
| iStoreOS 隔离 `npm run test:docker-smoke` | 通过；Docker 29.6.2 client / 27.3.1 server / linux amd64；离线、非 root、health、旧 JSON、牌局/私牌、匿名化、用户名复用和重启指纹均通过 |
| Docker 前后只读审计 | 通过；正式单容器 ID、运行镜像、healthy、release SHA、固定卷和唯一备份指纹不变；随机 smoke 容器/卷/镜像为 0 |
| `git diff --check` / 最终差异审计 | 通过；无空白错误，实际范围不含部署接口、真实配置、冻结历史或生成目录 |

`npm run verify:core` 在最终源码一次性串行执行 lint、typecheck、platform、poker、
realtime 和生产 E2E，退出码为 0。npm 在成功命令后报告无法清理用户级日志目录的
`EPERM` 警告；测试、构建和命令退出码均未受影响，因此不构成 finding。

计划未要求且未运行 `npm run test:deploy`，因为部署接口没有变化。隔离远端观察只证明
候选镜像在真实 iStoreOS Docker 环境可运行，不是正式发布证据。

## 5. 发现项与处置

无 `FND-I-*` 报告项；下一可用编号仍为 `FND-I-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

## 6. 决策、计划偏差与恢复记录

- 保持用户选择的 `relaxed` 策略；全部 core、硬门禁和 supplemental 实际通过，没有
  使用 `passed_with_findings`。
- 平台参赛边界采用最小游戏无关事实；当前扑克结果仅作适配来源。平台 UI 文件没有
  导入扑克状态、底池、下注、牌型或扑克视图。
- 按批准计划采用 JSON 加法归一化，没有新增 SQL migration；SQLite 事务和命令重放
  边界已由现有 `PlatformStore.execute()` 满足。
- T2 未修改预期可复用的 `apps/web/src/ui.tsx`，因为现有控件已满足可访问选择和确认
  流程；这是缩小实际范围，不改变需求或验证。
- 本机没有 Docker CLI/daemon。按批准计划使用临时、校验过 SHA-256 的 Docker 官方
  29.6.2 CLI，经现有 SSH 边界连接远端 daemon；工具和日志在验证后从工作区清理。
- 远端测试没有调用 `deploy/deploy.ps1`，没有进入正式发布目录或挂载固定卷/备份；
  前后指纹相同且临时资源为零。

## 7. 遗留风险与下一阶段进入条件

没有阻止交付的遗留风险、未决产品问题、开放 finding 或下一 initial 阶段。P-001 是
路线图唯一阶段。

initial 收口完成后，`requirements.md`、路线图、阶段计划/结果、completed 状态和
`change-0.md` 均冻结；后续产品需求必须从 `effective-requirements.md` 发起连续的
`change-N` 运行。

正式发布不是本阶段的一部分。用户已在本次目标中另行明确授权：从干净且已提交的候选
HEAD 使用 `deploy/deploy.ps1` 发布，并用浏览器实测后再推送；该发布结果应作为本次
交付说明，不回写本阶段的隔离 smoke 历史。
