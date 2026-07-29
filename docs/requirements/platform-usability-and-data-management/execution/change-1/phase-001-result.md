# change-1 P-001 阶段结果：结算退出投影与牌桌刷新主题修复

- 运行编号：`change-1`
- 阶段编号：`P-001`
- 阶段计划：[phase-001-plan.md](phase-001-plan.md)
- 阶段计划修订：`1`
- 父变更计划修订：`1`
- 项目基线：`main@6361b5844e46acf562d58859b13ae5d11952db9f`
- 完成日期：`2026-07-29`
- 状态：`completed`
- 交付与验证策略：`strict`
- 验证结论：`passed`

## 1. 阶段目标与结果

P-001 完成了 RC-1-001 和 RC-1-002。

当前房间投影会根据 `PokerState.departedAccountIds` 过滤已离开账户在
`lastResult.participantAccountIds`、派彩、玩家结果和摊牌玩家中的当前展示身份。
过滤只发生在 `projectRoom()` 生成玩家、观众和匿名 display 投影时；
`PlatformSnapshot.handResults` 的原参与者、结果和摊牌仍完整保留。同账户重新买入后
以新座位成员身份出现，但不会重新绑定为旧结算参与者。

应用现在在布局阶段根据当前视图选择主题 scope：登录和大厅使用 `main`，等待室、
牌桌、结算、带身份观战和匿名公共展示使用 `poker`。应用读取现有 `party-theme`
偏好或系统偏好并调用同一 `applyProductTheme()`，因此刷新和会话恢复不再依赖只存在于
登录/大厅的主题按钮。游戏内仍没有主题切换入口。

两个缺陷均先在未修改生产代码时获得稳定红灯，再用最小生产修复转绿。全部 strict
验收和计划硬门禁通过，无 finding。

## 2. 任务、需求与验收覆盖

| 任务 | 状态 | 覆盖 | 证据 |
| --- | --- | --- | --- |
| P-001-T-001 | completed | RC-1-001–RC-1-002；AC-C1-001–AC-C1-002 red-first | 领域目标测试收到未过滤的两名参与者；生产 E2E 刷新结算后缺失 `data-theme` |
| P-001-T-002 | completed | RC-1-001；FR-001；AC-001；AC-C1-001 core | 领域目标 1/1、platform 26/26、Chromium/WebKit 玩家/display 退出同步与重进通过 |
| P-001-T-002 | completed | RC-1-002；FR-004；AC-005；NFR-003；AC-C1-002 core | Chromium/WebKit 结算刷新后 `dark` + `poker` scope、完整变量、可读计算样式和无主题控件通过 |

AC-C1-001、AC-C1-002 及关联当前 core 验收均通过，没有豁免或验收降级。

## 3. 文件修改

| 文件 | 修改模式 | 主要目的 |
| --- | --- | --- |
| `packages/domain/src/index.ts` | modify | 在当前房间 `lastResult` 投影中过滤 `departedAccountIds`，不改持久化结果 |
| `apps/web/src/ui.tsx` | modify | 导出统一的已存/系统主题读取函数供应用生命周期复用 |
| `apps/web/src/main.tsx` | modify | 在 main/poker scope 变化的布局阶段初始化完整产品色板 |
| `tests/platform.test.ts` | modify | 覆盖退出后实时结算过滤、底层历史保留、派彩/玩家结果/摊牌和同账户重进 |
| `tests/e2e/core.spec.ts` | modify | 覆盖暗色结算刷新、语义变量/计算样式、无游戏内主题控件、玩家/display 退出同步和重进 |
| `AGENTS.md` | modify | 同步 change-1 完成状态、门禁与未部署事实 |
| `execution/change-1/change-plan.md` | add | 保存 RC 增量、strict 策略和单阶段路线图 |
| `execution/change-1/phase-001-plan.md` | add | 保存 red-first 与最小修复任务及门禁 |
| `execution/change-1/execution-state.md` | add/modify | 保存 ready、任务检查点、验证和收口状态 |
| `execution/change-1/phase-001-result.md` | add | 冻结本阶段实现与验证证据 |

没有修改契约、SQLite JSON、扑克引擎、持久化实现、服务命令、样式令牌、运行时依赖、
Docker、部署脚本、真实配置、生成物或冻结历史。

## 4. 测试与验证

| 验证 | 观察结果 |
| --- | --- |
| 领域 red-first 目标测试 | 预期失败：退出后当前 `lastResult.participantAccountIds` 仍包含两人；底层历史保留断言先通过 |
| `npm run test:e2e:core` red-first | 预期失败：Chromium 结算刷新后 `html[data-theme]` 缺失；build/静态资源已通过。随后 WebKit 赛季失败由预期中断遗留开放房间触发，并在修复后完整运行中消失 |
| 领域目标修复后 | 1/1 passed；14 skipped，仅运行目标用例 |
| `npm run lint` | passed |
| `npm run typecheck` | passed |
| `npm run test:platform` | 2 files，26/26 passed |
| `npm run test:realtime` | 1 file，4/4 passed |
| `npm run test:e2e:core` 修复后 | 生产 build 和静态资源检查通过；Chromium desktop / WebKit mobile 6/6 passed |
| E2E 内 `npm run build` | Web/server 构建成功；2 个 HTML/CSS 产物无公网资源引用 |
| `git diff --check` | passed；无空白错误 |

未运行 `test:poker`：没有修改扑克引擎或牌局规则；platform 与真实手牌 E2E 已覆盖投影
组合。未运行 `test:capacity`、`test:deploy` 或 Docker smoke：没有容量、部署、容器、
持久化格式或运行时依赖变化。以上取舍与批准计划一致。

npm 在成功命令后仍报告用户级日志目录 `EPERM` 清理警告；命令退出码、测试、构建和
产物均未受影响，与 initial 中已记录的环境行为一致，不构成 finding。

## 5. 发现项与处置

无 `FND-C1-*`。下一可用编号为 `FND-C1-001`。

| ID | 类别 | 严重程度 | 关联需求/验收 | 观察与证据 | 最终功能影响 | 处置 | 置信度 | 建议后续 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | 无开放发现项 | 无 | — | 高 | — |

## 6. 决策、计划偏差与恢复记录

- 保持用户明确选择的 `strict`，两个缺陷都先获得实际红灯。
- RC-1-001 采用服务端权威投影过滤，而不是 Web 单端隐藏，因此玩家、观众和公共大屏
  一致；持久化历史不改写。
- RC-1-002 复用现有产品主题函数与本地键，不增加组件内硬编码色值或运行时依赖。
- 实际生产文件完全落在计划范围内；无需修改样式文件。
- red-first E2E 中的 WebKit 失败被定位为前一预期失败中断后的夹具级联；修复后完整
  6/6 独立证明其没有产品影响。
- 本阶段未部署、未访问或改变远端正式服务。恢复只需从当前 diff 继续工作流收口，
  不需要数据、容器或服务器回滚。

## 7. 遗留风险与下一阶段进入条件

没有遗留产品风险、开放 finding、未决问题或下一 change-1 阶段。P-001 是唯一阶段，
验证结论为 `passed`。

本结果创建后，`phase-001-plan.md` 和本结果冻结。收口只需生成 `change-1.md`、更新
`effective-requirements.md` 并将执行状态设为 `completed`；任何后续产品变化必须创建
连续的 `change-2`。
