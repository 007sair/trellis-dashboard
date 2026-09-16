---
generated_from_state_version: 25
---

# 验证

## 当前结果

- 结果: **已归档**
- 验证情况: **已完成检查，验证结果已确认**
- 目标周期: 4
- 迭代: 1
- 验证器尝试次数: 1
- 完成时间: 2026-09-16T19:18:44.159Z
- 摘要: 独立读取本轮 brief、完整 A1–A10 详情、源码、测试、README、打包/真实项目冒烟脚本及正式 Runtime 回执后验收通过。Runtime `.comet/runtime/native/changes/trellis-dashboard/state.json` binds candidateId `bd8e62fc-2812-418c-9046-8b4e6e73b880`, inputFingerprint `4140d0799c9082776fc4b94a736cc3002a551bed4e390a7524ea0439fb6bd956`, workspace/worktree `/Users/longchan/orca/projects/trellis-dashboard/.worktrees/trellis-dashboard`, branch `comet/trellis-dashboard`, machine `ZBMAC-bcb59c9e5`, and verifier execution `skill-coordinated:verifier:10f4e5fd-4627-41c5-84c5-fbd04cce74a0`. Its sole formal check is passed with exitCode 0. No scope-qualified, reproducible defect was found.

## 验收

| 编号 | 结果 | 来源 | 验收项 | 原因 |
| --- | --- | --- | --- | --- |
| A1 | passed | brief.md | 安装构建好的本地包后，从含 `.trellis` 的项目根目录或其子目录运行命令，定位最近项目并启动回环地址面板；支持显式目录、端口、不打开浏览器；找不到目录或端口不可用时给出可行动错误，不修改目标项目。 | `bin/trellis-dashboard.mjs` loads built CLI; `src/server/cli.ts` implements nearest-project discovery, --dir/--port/--no-open/help/version and graceful signal shutdown; `src/server/http.ts` binds only 127.0.0.1. Formal Runtime check `dashboard-all-panels-validation` passed, including offline isolated package installation, nested Unicode-project launch, asset/API access, unchanged source, and clean shutdown. |
| A2 | passed | brief.md | 样例的六个任务按真实字段显示；支持活动/归档任务、父子关系、空/null 字段和未知状态；不会把 in_progress 自动视为已验收或已完成。 | `src/server/store.ts` scans active and archive task.json directories without assuming directory=id, preserves raw metadata/unknown statuses/null fields and assigns artifacts to nearest task; `Tasks.tsx` renders board/list/archive and `TaskDetail.tsx` exposes relations and raw metadata. `test/store.test.ts` covers archive, true IDs, relations, null fallbacks and custom status; formal real-project smoke read 6 tasks with diagnostics=0. |
| A3 | passed | brief.md | 用户能在看板/列表中搜索并按状态、优先级、负责人筛选，统计与展示集合一致，清空筛选后恢复全部匹配任务；任务面板标题、统计和工具区紧凑且固定，看板各列卡片独立滚动、列头固定，列表数据区独立滚动、表头固定，内容占满剩余视口；滚动到底部不带动整页或旁列，窄屏看板可横向切列、筛选按需展开后仍可完整操作，无页面级横向或纵向溢出。 | `Tasks.tsx` provides compound query/status/priority/assignee filters, archive scope, sort, list/board switch, clear control, mobile filter dialog and preserved board element/scroll state across snapshot refreshes. `styles.css` implements viewport containment, compact heading/stats, independently scrolling `.lane-cards`, contained horizontal `.board`, independently scrolling `.task-table-wrap`, and sticky table headers. Formal 15/15 Chromium run includes all four `tasks-layout.spec.ts` cases: desktop lane isolation, sticky table/filter behavior, mobile horizontal lanes/full filters, and 1024/760/320 viewport containment. Real-project smoke measured pageHeight 900/844, compact stats 60/62px, board 486/369px and table 533/416px. |
| A4 | passed | brief.md | 任务详情能读取存在的 PRD、设计、执行计划、research 与 JSONL 上下文清单；缺失可选文件不报整个页面失败，完整任务信息和原始元数据仍可访问；默认阅读时次要元信息不挤占正文，1440×900 桌面视口正文滚动区不少于 630px，390×844 移动视口不少于 422px；产物目录与正文独立滚动，弹层头部、产物标签和文档工具栏保持固定。 | `TaskDetail.tsx` and `Documents.tsx` provide task artifacts, JSON/JSONL/Markdown reading, separate information and raw-metadata tabs, separate artifact/body scroll containers, and fixed dialog/document controls; `styles.css` makes the dialog a bounded viewport frame. `reading-layout.spec.ts` verifies long content, independent boundary scrolling, retained task information and actual body heights >=630px desktop and >=422px mobile. Formal real-project smoke measured dialog body 694px desktop and 571px mobile. |
| A5 | passed | brief.md | 计划进度只由 implement.md 的实际复选框计算，并显示已勾选/总数与来源；没有可计算计划时显示未提供，不凭空给出百分比、阶段或验证通过结论。 | `src/server/progress.ts` parses Markdown AST list-item checkboxes only and returns null when no checklist exists; `TaskDetail.tsx` and task cards display the resulting X/Y or 未提供 and explicitly state that plan progress is not acceptance. `shared.test.ts` verifies fenced/indented code is excluded and no-checklist input returns null; the formal Runtime check passed all 21 unit/integration tests. |
| A6 | passed | brief.md | 规范页按真实目录组织所有 Markdown，工作记录页按开发者提供索引与 journal 浏览，兼容样例的 14 份规范及 5 份工作记录文件且缺失可选目录时显示空态；两个页面标题紧凑、右侧提供搜索工具，目录列表与 Markdown 正文独立滚动，不带动整页、标题或工具栏；1440×900 正文滚动区不少于 630px，390×844 默认目录收起且正文不少于 422px，仍可展开目录选择文档，无页面横向溢出。 | `DocumentLibrary` organizes real `spec/` and `workspace/` paths, groups workspace by developer, supplies compact right-side search and an accessible mobile directory; `Documents.tsx` keeps directory/body scroll independently bounded. `reading-layout.spec.ts` verifies both modules' desktop independent scrolling, refresh/anchor retention, 630px body minimum, mobile closed-by-default directory, 422px body minimum and no page overflow. Formal real-project smoke read 14 specs and 5 workspace documents and measured 674px desktop / 569px mobile body heights for both modules. |
| A7 | passed | brief.md | 页面在外部新增、更新、删除任务/文档后五秒内或手动刷新时同步；目录消失或读取失败显示明确错误，不把旧快照冒充新状态。 | `useSnapshot` refreshes every two seconds and supports manual refresh; server scans fresh state rather than serving a retained snapshot, while document refresh keeps the existing scroll container. `dashboard.spec.ts` verifies create/update/delete synchronization, document update/deletion, root-loss stale-data clearing and recovery; `reading-layout.spec.ts` and `tasks-layout.spec.ts` verify unchanged-view refresh preserves reading and task scroll positions. These browser cases passed in the formal Runtime check. |
| A8 | passed | brief.md | 空项目、缺失可选目录、损坏 task.json/JSONL、未识别状态和不支持文件均有可理解反馈；单文件损坏不阻止其他合法任务展示。 | `TrellisStore` isolates invalid metadata into diagnostics, treats missing optional top-level folders as valid empty states, enforces readable/type/size checks, and keeps valid tasks/documents available; `Documents.tsx` gives JSONL per-line and unsupported/read errors visible feedback. `store.test.ts`, `shared.test.ts`, and `dashboard.spec.ts` cover malformed task JSON, empty folders, malformed JSONL, unknown statuses, size/type errors and actionable UI states. Formal Runtime check passed all 21 unit/integration and 15 browser tests. |
| A9 | passed | brief.md | 默认只监听本机回环地址；文件读取限制在获准的 Trellis 内容内；拒绝目录穿越与越界 symlink，Markdown 不执行 HTML/脚本；只读模式下全程不改变目标项目文件。 | `src/server/http.ts` listens on 127.0.0.1, permits GET/HEAD only, validates Host/Origin, and emits restrictive CSP/security headers. `src/server/project.ts` and `store.ts` reject traversal, absolute/hidden paths and out-of-root symlinks, use realpath/inode rechecks, restrict readable content types, and open files read-only; `Documents.tsx` skips raw Markdown HTML, blocks unsafe links and suppresses image loading. `http.test.ts` and `store.test.ts` exercise writes, rebinding/cross-origin reads, traversal and symlink escape; formal real-project smoke hashed 120 source files before/after and reported sourceUnchanged=true. |
| A10 | passed | brief.md | 提供可安装的 CLI 构建产物、README 使用步骤和测试；在独立临时 Trellis fixture 及提供的真实样例上做只读冒烟验证，不将样例业务内容提交进仓库，不声称未执行的检查通过。 | `package.json` declares the CLI and distributable files; `scripts/test-package.mjs` verifies npm pack, offline isolated installation, executable launch and bundled assets; `README.md` documents local-only installation, parameters, constraints and all validation commands without claiming npm publication. Formal Runtime evidence records successful typecheck/build, 21/21 unit-integration tests, 15/15 Chromium tests, package test, and real-project read-only smoke (6 tasks, 14 specs, 5 workspace entries, 51 documents, 120-file unchanged digest). |

## 检查

| 检查 | 命令 | 工作目录 | 状态 | 退出码 | 耗时 |
| --- | --- | --- | --- | ---: | ---: |
| 完整屏效回归：21 项单元集成、15 项浏览器、安装及真实项目所有面板/只读检查 | --noprofile --norc -c npm run check && node scripts/smoke-project.mjs --dir /Users/longchan/Desktop/workspace/product-center --expect-tasks 6 --expect-specs 14 --expect-workspace 5 --screenshot test-results/real-project.png | . | passed | 0 | 59229 ms |

### Builder 报告的证据

以下为 Builder 报告，不等同于 Runtime 检查凭据或独立验收结果。

- npm run check: passed — typecheck/build、21/21 单元集成、15/15 Chromium、离线临时全局安装全部通过
- node scripts/smoke-project.mjs --dir <provided-project> --expect-tasks 6 --expect-specs 14 --expect-workspace 5 --screenshot test-results/real-project.png: passed — 真实项目任务面板及全部阅读区域的桌面/移动尺寸与只读检查通过
- npm pack --ignore-scripts --json: passed — 更新后的本地包仅含 8 项分发文件
- 已知限制: 实测 macOS + Node.js 22 + Chromium；Windows/Linux、Node.js 18.18、Safari 和移动实机未验证
- 已知限制: 布局回归覆盖 1440×900、1024×768、760×800、390×844、320×640；原阅读高度阈值依已确认的桌面/移动视口
- 已知限制: 仍为只读本地交付，未发布 npm 或执行 Git/工作区收尾

## 阻塞项

_无。_

## 风险与跳过的工作

- Formal browser/layout evidence was executed on macOS, Node.js 22 and Chromium only. Windows, Linux, Node.js 18.18, Safari, and physical mobile-device behavior were not independently exercised in this verification.

## 之前的迭代

| 目标周期 | 迭代 | 尝试 | 结果 | 未解决项 | 摘要 | 完成时间 |
| ---: | ---: | ---: | --- | --- | --- | --- |
| 1 | 0 | 0 | recovery | — | Native Shape artifacts changed | 2026-09-16T16:38:30.351Z |
| 2 | 1 | 1 | pass | — | 独立读取完整需求、状态与正式 Runtime 回执后，直接审查 CLI、服务端受限读取/HTTP、共享逻辑、客户端、测试、打包脚本、README 和锁文件。Runtime candidateId、工作区、分支、机器及 verifier execution 信息与本轮绑定值一致；正式全量检查已通过。A1–A10 均有代码与正式检查证据支持，未发现范围内可证实缺陷。 | 2026-09-16T17:29:15.354Z |
| 2 | 1 | 1 | recovery | — | 用户尚未接受结果，补充阅读布局要求：任务弹层 Markdown 可见高度不足；规范库和工作记录标题右侧空白过多；滚动时应仅滚动目标目录列表或 Markdown，不带动整个右侧页面。仅修订阅读布局和对应验收标准，保持本地只读、三个模块及所有数据/安全行为不变。 | 2026-09-16T17:41:41.056Z |
| 3 | 1 | 1 | pass | — | 已重新独立读取本轮完整 brief、Spec、state、候选源码、全部测试/打包脚本、README 与 Runtime 正式日志；未复用前候选结论。Runtime state.json 的 candidateId、inputFingerprint=28c1ac3601366b03b7137a17a31274bc194698b4dc616e495eb1e2e7d2e0030a、projectRoot/worktreeRoot、branch=comet/trellis-dashboard、machineId=ZBMAC-bcb59c9e5 和 verifier executionId 均与本轮绑定一致。dashboard-reading-validation 在该工作区以 exitCode 0 完成；A1–A10 均有当前源码和正式检查证据支持，未发现本范围内可证实缺陷。 | 2026-09-16T18:23:25.567Z |
| 3 | 1 | 1 | recovery | — | 用户指出整体屏效优化还应覆盖任务面板，上一轮只调整了任务弹层、规范库和工作记录。补齐任务面板的紧凑标题/统计/筛选、看板各列及列表独立滚动、固定导航/工具/表头与窄屏操作，扩展 A3，保留已完成的 A4/A6 阅读布局和全部只读/数据功能。用户尚未接受结果，不进入归档。 | 2026-09-16T18:33:46.684Z |
| 4 | 1 | 1 | pass | — | 独立读取本轮 brief、完整 A1–A10 详情、源码、测试、README、打包/真实项目冒烟脚本及正式 Runtime 回执后验收通过。Runtime `.comet/runtime/native/changes/trellis-dashboard/state.json` binds candidateId `bd8e62fc-2812-418c-9046-8b4e6e73b880`, inputFingerprint `4140d0799c9082776fc4b94a736cc3002a551bed4e390a7524ea0439fb6bd956`, workspace/worktree `/Users/longchan/orca/projects/trellis-dashboard/.worktrees/trellis-dashboard`, branch `comet/trellis-dashboard`, machine `ZBMAC-bcb59c9e5`, and verifier execution `skill-coordinated:verifier:10f4e5fd-4627-41c5-84c5-fbd04cce74a0`. Its sole formal check is passed with exitCode 0. No scope-qualified, reproducible defect was found. | 2026-09-16T19:18:44.159Z |



## 结论

独立读取本轮 brief、完整 A1–A10 详情、源码、测试、README、打包/真实项目冒烟脚本及正式 Runtime 回执后验收通过。Runtime `.comet/runtime/native/changes/trellis-dashboard/state.json` binds candidateId `bd8e62fc-2812-418c-9046-8b4e6e73b880`, inputFingerprint `4140d0799c9082776fc4b94a736cc3002a551bed4e390a7524ea0439fb6bd956`, workspace/worktree `/Users/longchan/orca/projects/trellis-dashboard/.worktrees/trellis-dashboard`, branch `comet/trellis-dashboard`, machine `ZBMAC-bcb59c9e5`, and verifier execution `skill-coordinated:verifier:10f4e5fd-4627-41c5-84c5-fbd04cce74a0`. Its sole formal check is passed with exitCode 0. No scope-qualified, reproducible defect was found.
