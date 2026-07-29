# 平台易用性与数据管理增强：修改记录 1

- 修改编号：`1`
- 修改类型：`需求变更（缺陷修复）`
- 原始需求：[requirements.md](requirements.md)
- 初始路线图：[implementation-plan.md](implementation-plan.md)，修订 `1`
- 变更计划：[execution/change-1/change-plan.md](execution/change-1/change-plan.md)，修订 `1`
- 执行状态：[execution/change-1/execution-state.md](execution/change-1/execution-state.md)
- 项目基线：`main@6361b5844e46acf562d58859b13ae5d11952db9f`
- 完成日期：`2026-07-29`

## 1. 原始需求变更项目

| 变更项 | 变更类型 | 关联原始需求或历史变更 | 变更前 | 变更后 | 验收影响 |
| --- | --- | --- | --- | --- | --- |
| RC-1-001 | modify | FR-001；AC-001 | complete 退出已移除 `Room.seats`，但当前 `lastResult` 投影仍展示退出者 | 玩家、带身份观众和匿名 display 的当前结算身份按 `departedAccountIds` 立即过滤；持久化 `handResults` 完整保留，重进不重新绑定旧结果 | AC-C1-001 core |
| RC-1-002 | modify | FR-004；AC-005；NFR-003 | 主题色板依赖登录/大厅 `ThemeToggle` 的 effect，刷新无主题控件的牌桌/结算时变量未初始化 | 应用在布局阶段按视图初始化 main/poker scope 和已存/系统主题；游戏内仍无切换入口，刷新/恢复后内容可读 | AC-C1-002 core |

## 2. 实现概述

change-1 使用用户明确选择的 `strict` 策略，在修改生产代码前分别复现了两个缺陷。

领域投影现在使用当前扑克状态的 `departedAccountIds` 过滤
`lastResult.participantAccountIds`、派彩、玩家结果和摊牌玩家。过滤只影响当前房间的
HTTP/WebSocket/display 投影；原始手牌结果、参与者、派彩和摊牌仍保存在
`PlatformSnapshot.handResults`。同账户退出后重新买入时只以新座位身份参与后续流程，
不会重新附着到旧结算身份。

Web 把主题初始化从按钮组件副作用提升为应用生命周期。登录/大厅使用 `main` scope，
等待室、牌桌、结算、带身份观战和匿名公共展示使用 `poker` scope；模式继续读取
`party-theme` 或系统偏好，并复用既有产品色板函数。游戏内语言/主题控件所有权规则
保持不变。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/domain/src/index.ts` | modify | 过滤当前房间结算投影中的已离开身份，不改持久化历史 |
| `apps/web/src/ui.tsx` | modify | 导出统一主题偏好读取函数 |
| `apps/web/src/main.tsx` | modify | 根据当前 main/poker scope 在布局阶段初始化主题 |
| `tests/platform.test.ts` | modify | red-first 覆盖投影过滤、历史保留、派彩/摊牌和重进 |
| `tests/e2e/core.spec.ts` | modify | red-first 覆盖结算刷新色板、可读样式、退出同步和 display |
| `AGENTS.md` | modify | 更新 change-1 完成与尚未部署状态 |
| `execution/change-1/change-plan.md` | add | 保存 RC-1-001–RC-1-002、strict 策略和路线图 |
| `execution/change-1/phase-001-plan.md` | add | 保存 P-001 red-first 与修复任务 |
| `execution/change-1/phase-001-result.md` | add | 冻结阶段实现和验证证据 |
| `execution/change-1/execution-state.md` | add | 保存可恢复检查点和 completed 状态 |
| `change-1.md` | add | 保存本连续修改记录 |
| `effective-requirements.md` | modify | 应用 RC-1-001–RC-1-002 并推进权威快照 |

没有修改 initial、`change-0.md`、其他冻结工作流、契约、扑克引擎、持久化 schema、
服务命令、主题令牌、依赖、Docker 或部署接口。

## 4. 需求、阶段与任务完成情况

| 范围 | 状态 | 完成证据 |
| --- | --- | --- |
| RC-1-001；AC-C1-001 core | completed / passed | 领域目标断言、platform 26/26、Chromium/WebKit 玩家与 display 结算退出同步 |
| RC-1-002；AC-C1-002 core | completed / passed | Chromium/WebKit 结算刷新后的 theme/scope、语义变量、计算样式及无控件断言 |
| P-001-T-001 | completed | 两个缺陷均在未改生产代码时获得与用户报告一致的红灯 |
| P-001-T-002 | completed | 最小领域/Web 修复和全部 strict 门禁通过 |
| P-001 | completed / passed | 唯一阶段结果 [phase-001-result.md](execution/change-1/phase-001-result.md) 已冻结 |

FR-001、FR-004、AC-001、AC-005 和 NFR-003 的当前语义由本记录对应 RC 增量更新；
其余有效需求不变。

## 5. 测试与验证

- 交付与验证策略：`strict`。
- 验证结论：`passed`。
- red-first：
  - 领域目标测试退出码 1，当前投影仍收到两名参与者；
  - `npm run test:e2e:core` 退出码 1，Chromium 结算刷新后缺失
    `html[data-theme]`。预期中断造成的 WebKit 房间门禁级联在修复后完整运行中消失。
- 修复后：
  - 领域目标 1/1 passed；
  - `npm run lint` passed；
  - `npm run typecheck` passed；
  - `npm run test:platform` 2 files、26/26 passed；
  - `npm run test:realtime` 1 file、4/4 passed；
  - `npm run test:e2e:core` 完成生产 build/静态资源检查，Chromium desktop /
    WebKit mobile 6/6 passed；
  - `git diff --check` passed。
- 未运行 poker、capacity、deploy 或 Docker smoke：实际差异没有修改扑克规则、容量
  路径、部署接口、容器、持久化格式或依赖；该取舍与变更计划一致。

全部 core、strict 与硬门禁通过，没有豁免、降级或 `passed_with_findings`。

## 6. 与变更计划及阶段计划的偏差

- 没有改变 RC、验收、阶段数、任务顺序、strict 策略或阻塞门禁。
- `styles.css` 无需修改；现有产品色板在正确初始化后已提供可读结算样式，实际范围比
  计划允许范围更小。
- red-first E2E 的预期中断使同一临时运行中的 WebKit 新赛季遇到开放房间门禁；完整
  修复后运行 6/6 通过，证明该级联不是额外产品缺陷。
- 本运行没有部署、提交、推送或访问正式服务器。

## 7. 遗留事项

没有开放 `FND-C1-*`、未决问题、阻塞或已知交付缺口。下一可用 finding ID 为
`FND-C1-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

本记录创建后，`execution/change-1/`、本记录及应用至本记录的有效需求快照冻结。
后续产品变化必须创建连续的 `change-2` 运行。
