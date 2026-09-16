# Outcome

在任意包含 `.trellis/` 的项目中，通过一个命令启动本地浏览器 Dashboard。面板直接使用项目现有文件，让用户查看任务、任务产物、规范和工作记录，无须在目标项目安装前端工程或修改 Trellis 本身。

用户已确认本地只读三模块范围。整体屏效以内容为主，覆盖任务面板、任务弹层、规范库和工作记录：固定框架、紧凑工具区、内容独立滚动。当前补齐用户指出遗漏的任务面板布局，保留已经完成的阅读布局；阶段与轮次以 Runtime 状态为准。

# Scope

- 提供独立的 Node.js CLI（拟名 `trellis-dashboard`）及随包构建的 Web UI；一次本地安装后可从其他 Trellis 项目启动。提供本地安装、打包与使用说明，不假设 npm 包已经发布。
- 从当前目录向上定位最近的 `.trellis/`，支持显式项目路径、端口和不自动打开浏览器；只绑定本机回环地址。
- 读取 `.trellis/tasks/*/task.json` 和 `tasks/archive/YYYY-MM/**/task.json`；显示元数据、任务关系、优先级、负责人和归档标识；缺失值与未知状态不伪造。
- 任务看板、列表、统计、关键词搜索和筛选；详情浏览 `prd.md`、`design.md`、`implement.md`、`research/`、JSON/JSONL 等现有产物。
- 任务面板同样采用视口内固定框架：压缩标题、统计卡片和筛选占高，让看板/列表占满剩余空间；各看板列的卡片独立滚动且列头固定，列表数据区独立滚动且表头固定。窄屏看板可在自身区域横向切列，完整筛选可按需展开，不产生页面级溢出。
- 如展示执行计划进度，只统计 `implement.md` 中实际的 Markdown 复选框，并明确标记其来源；不把“文档存在”或任务 `in_progress` 推断成已通过验收。
- 定时同步外部文件变化并提供手动刷新、加载态、空态与局部错误提示。
- 首版只读，包含任务、规范和工作记录三个模块，不提供任务创建、编辑、启动或归档动作。
- 阅读布局修订：任务弹层扩大到接近可用视口，默认优先显示正文；次要任务信息移到独立可访问区域，不堆在 Markdown 上方。规范库/工作记录使用紧凑标题与右侧搜索工具，目录和正文分别滚动，框架与工具栏固定；移动端目录可展开，默认不常驻占高。
- 桌面 1440×900 的默认阅读状态，弹层与两个文档页的 Markdown 滚动视窗均不少于 630px；移动端 390×844 默认阅读不少于 422px。尺寸指排除文档工具栏后的正文容器，不以长文档自身高度冒充可视高度。

## Source coverage

用户给出的目录按“实际数据格式和展示对象”使用，不把其中产品中心的业务 PRD、代码规范或面向其 Agent 的指令当成本 Dashboard 的业务要求。官方仓库按“文件模型、工作流语义和兼容性”使用，不复制其 CLI/脚本实现。

调查事实：样例 `.trellis/.version` 为 `0.6.15`；完整目录清单有 120 个文件，包括 tasks 32、workspace 5、spec 14、scripts 47、agents 2、`.runtime` 14 及 6 个根文件。6 份 `task.json` 均成功解析，现状全部为 `in_progress`，P1 一项、P2 五项；`meta` 均为空，没有结构化的阶段、批次或验收结果字段。阶段/执行步骤存在于工作流和任务 Markdown 中，不能混同为 task.json 的事实字段。

Runtime 已生成并核对 A1–A10（来源均为 brief.md），与下表对应。全部有效来源均已映射到完整 Spec 及验收项；来源背景/非目标不转化为额外实现要求。

| 来源条目与位置 | 读取状态 | 需要保留的内容 | Spec 位置 | 验收 ID | 覆盖状态 | 理由或替代关系 |
| --- | --- | --- | --- | --- | --- | --- |
| S01：用户原始请求 | complete | 在已有 `.trellis` 的项目运行命令即可启动面板 | `specs/dashboard/spec.md` R1 | A1、A10 | covered | 核心目标，不要求改造目标项目 |
| S02：官方 README，介绍与 Why Trellis 表格 | complete | tasks、spec、workspace 是三类持久化项目内容 | R2、R5 | A2、A4、A6 | covered | 用户已确认三个模块全部纳入首版 |
| S03：官方 README，Prerequisites / Quick Start | complete | Trellis 是独立 CLI；已有项目通过 init 形成目录 | R1、R8 | A1、A10 | covered | Dashboard 不重新 init，也不替换 `trellis` 命令；Trellis 的 Python 需求不转嫁给只读面板 |
| S04：官方 README，How to Use / How It Works | complete | Plan / Implement / Verify / Finish 是流程，不等同于 task.json 的四个状态 | R2、R4 | A2、A5 | covered | 不凭文档存在推断 Verify 或完成 |
| S05：官方 README，Resources / FAQ（scoped specs、平台、团队、journals） | complete | 规范可自定义，日志按开发者分开，面板不绑定某 AI 平台 | R2、R5 | A2、A6 | covered | 用户已确认规范与工作记录浏览；平台安装本身是背景 |
| S06：官方 README，ablate / restore / uninstall FAQ | complete | Trellis 内容可能敏感；移走目录后不得展示为仍然有效 | R6、R7 | A7、A9 | covered | 只实现只读状态/错误处理；不实现移除/恢复或恢复事务 |
| S07：官方 README，图片、徽章、社区、Star History、License、链接导航 | complete | 项目来源与 AGPL-3.0 许可信息 | R8 | A10 | background | 不复制源码或品牌素材，不做社区或包管理功能；导航链接不是待实现功能 |
| S08：官方 How It Works，§1–2、§4、§7 | complete | 持久化路径、任务元数据、planning → in_progress、会话指针与任务状态区别 | R2、R4 | A2、A5 | covered | 会话指针不能证明进程存活；不执行 hooks |
| S09：官方 How It Works，§5–6、§8–10 | complete | 任务产物可选，JSONL 是上下文清单而非执行计划，spec 为长期规范 | R3、R5 | A4、A6 | covered | 任务产物及规范页均已纳入范围 |
| S10：官方 How It Works，§11–12、What survives | complete | 归档路径为 tasks/archive/YYYY-MM；日志为 workspace/<developer>/journal-N.md | R2、R5 | A2、A6 | covered | 归档只读浏览和日志浏览均纳入；不自动提交 Git |
| S11：官方 How It Works，流程图、平台表、任务许可与 agent 调度细节 | complete | 用于解释来源语义，不移植其执行工作流 | — | — | non-goal | Dashboard 不运行 AI、提交、归档脚本或平台安装器 |
| S12：本地 `.trellis/.version`、完整目录清单 | complete | 0.6.15 样例、缺失目录的容错、文件是数据源 | R2、R6 | A2、A8 | covered | 不能硬编码 product-center 路径或任务 |
| S13：本地 tasks 下全部六份 task.json | complete | id/name 可与目录名不同；status、priority、creator/assignee、日期、subtasks/children/parent、relatedFiles、notes、meta；null 与空数组合法 | R2、R3 | A2、A4 | covered | 已逐份解析；保留原值，不用目录名覆盖真实 title/id |
| S14：本地 tasks 的 prd/design/implement/research 与 JSONL 文件清单 | complete | 同一任务的产物集合不同，轻量任务无 design/implement 合法 | R3、R4 | A4、A5 | covered | 文件名、类型和存在性为需求依据；具体业务内容仅是待浏览数据，不属于待实现需求 |
| S15：本地 workflow.md，Core Principles / Trellis System / Phase Index / Planning Artifacts / Parent-Child / Customizing | complete | 目录布局、计划复选框来源、父子任务非依赖图、未知自定义 status、finish 与 archive 的差异 | R2、R3、R4 | A2、A4、A5 | covered | 完整读取；不伪造依赖关系、验收状态或运行中 agent |
| S16：本地 workflow.md，各阶段执行指南、分平台路由、hooks、commit 许可 | complete | 这些是产品中心 Agent 的运行指令，而非本项目指令 | — | — | background | 本项目遵循 Comet；绝不执行参考目录的脚本/命令 |
| S17：本地 config.yaml，全部注释、默认值、monorepo、hooks、channel、context 配置 | complete | 多层 spec/多包数据合法；脚本可能触发 hooks 或自动提交；路径与内容可敏感 | R5、R7 | A6、A9 | covered | 按文件读取、不运行来源脚本；不把受信任目录配置自动升级为面板文件访问权限 |
| S18：本地 spec 下全部 14 个文件的目录/类型 | complete | frontend 与 guides 两种目录；不能只支持固定 package/layer 深度 | R5 | A6 | covered | 用户已选择规范浏览；文档内的产品中心编码约束是展示数据，不是本项目编码约束 |
| S19：本地 workspace 下全部 5 个文件的目录/类型 | complete | 根索引、多个开发者 index 与 journal 文件 | R5 | A6 | covered | 用户已选择工作记录浏览；日志是历史记录，不宣称实时 AI 对话或 agent 活跃度 |
| S20：本地 scripts、agents、`.runtime`、`.developer`、`.template-hashes.json`、`.gitignore` 清单 | complete | 系统文件与用户内容有边界 | R7 | A9 | background | 不执行/修改/拷贝脚本、agents、模板、缓存；不提供任意文件系统浏览器；非 Dashboard 需求来源 |
| S21：用户验收反馈“弹层的 markdown 区域预览的高度太小” | complete | 默认阅读时正文获得主要可用高度，次要信息不挤占正文；完整信息仍可访问 | R3、R8 | A4 | covered | 在原任务产物阅读功能上补充布局要求 |
| S22：用户验收反馈“规范库、工作记录区域标题右侧区域空白很多” | complete | 收紧标题区，在右侧安排搜索工具，把更多空间留给文档 | R5、R8 | A6 | covered | 仅调整已有模块的空间布局 |
| S23：用户验收反馈“只滚动我想看的列表或者 markdown…现在是右侧整体在滚动” | complete | 目录列表和正文各自滚动；全局框架、标题与文档工具栏固定；边界滚动不传到整页 | R3、R5、R6、R8 | A4、A6 | covered | 修订滚动容器与移动端目录呈现，保留原数据及安全行为 |
| S24：用户验收反馈“任务面板也要改呢”及此前“整体屏效…例如” | complete | 整体屏效优化也覆盖任务面板，不只覆盖阅读页；紧凑统计/工具、看板列及列表独立滚动、固定导航/列头/表头、窄屏操作可用 | R2、R6、R8 | A3 | covered | 补齐上一轮对整体屏效范围理解过窄的遗漏，不新增模块或写操作 |

布局复测基线（1440×900，首轮真实项目预览）：任务弹层正文可视高度 514px；规范库正文从 y=258 开始，整页高度 1849px；在正文滚轮后 window.scrollY=758、标题 y=-659，确认存在整页滚动。对比截图仅保留于被忽略的 test-results/layout-before-*.png。

任务面板复测基线（1440×900）：标题区 83px、统计区 124px，首卡片从 y=535 开始，整页高度 2038px，卡片列 overflow-y 为 visible。本轮将内容约束在剩余视口内，不再依赖整个右侧页面滚动。

资料链接：
- https://github.com/mindfold-ai/Trellis （README 完整读取）
- https://docs.trytrellis.app/start/how-it-works.md （完整读取）
- 官方 Quick Start、Spec Templates、文档索引用于导航和交叉检查，不引入额外产品功能。

# Non-goals

- 不改动 `/Users/longchan/Desktop/workspace/product-center` 的数据、脚本或 Git 状态。
- 不移植 Trellis Agent 工作流，不启动 AI/sub-agent，不执行项目 hooks，不运行任意 shell。
- 不做云端账户、远程共享、联网数据上报、多项目集中服务器或替代 IDE。
- 不做 Git commit/push/PR，不发布 npm 包；是否归档本 Comet change 按后续明确授权办理。
- 不把计划勾选比例宣传为代码完成率、测试通过率或正式验收结论。
- 不创建、编辑、启动或归档目标项目的任务，不更改生命周期状态。

# Acceptance examples

- 安装构建好的本地包后，从含 `.trellis` 的项目根目录或其子目录运行命令，定位最近项目并启动回环地址面板；支持显式目录、端口、不打开浏览器；找不到目录或端口不可用时给出可行动错误，不修改目标项目。
- 样例的六个任务按真实字段显示；支持活动/归档任务、父子关系、空/null 字段和未知状态；不会把 in_progress 自动视为已验收或已完成。
- 用户能在看板/列表中搜索并按状态、优先级、负责人筛选，统计与展示集合一致，清空筛选后恢复全部匹配任务；任务面板标题、统计和工具区紧凑且固定，看板各列卡片独立滚动、列头固定，列表数据区独立滚动、表头固定，内容占满剩余视口；滚动到底部不带动整页或旁列，窄屏看板可横向切列、筛选按需展开后仍可完整操作，无页面级横向或纵向溢出。
- 任务详情能读取存在的 PRD、设计、执行计划、research 与 JSONL 上下文清单；缺失可选文件不报整个页面失败，完整任务信息和原始元数据仍可访问；默认阅读时次要元信息不挤占正文，1440×900 桌面视口正文滚动区不少于 630px，390×844 移动视口不少于 422px；产物目录与正文独立滚动，弹层头部、产物标签和文档工具栏保持固定。
- 计划进度只由 implement.md 的实际复选框计算，并显示已勾选/总数与来源；没有可计算计划时显示未提供，不凭空给出百分比、阶段或验证通过结论。
- 规范页按真实目录组织所有 Markdown，工作记录页按开发者提供索引与 journal 浏览，兼容样例的 14 份规范及 5 份工作记录文件且缺失可选目录时显示空态；两个页面标题紧凑、右侧提供搜索工具，目录列表与 Markdown 正文独立滚动，不带动整页、标题或工具栏；1440×900 正文滚动区不少于 630px，390×844 默认目录收起且正文不少于 422px，仍可展开目录选择文档，无页面横向溢出。
- 页面在外部新增、更新、删除任务/文档后五秒内或手动刷新时同步；目录消失或读取失败显示明确错误，不把旧快照冒充新状态。
- 空项目、缺失可选目录、损坏 task.json/JSONL、未识别状态和不支持文件均有可理解反馈；单文件损坏不阻止其他合法任务展示。
- 默认只监听本机回环地址；文件读取限制在获准的 Trellis 内容内；拒绝目录穿越与越界 symlink，Markdown 不执行 HTML/脚本；只读模式下全程不改变目标项目文件。
- 提供可安装的 CLI 构建产物、README 使用步骤和测试；在独立临时 Trellis fixture 及提供的真实样例上做只读冒烟验证，不将样例业务内容提交进仓库，不声称未执行的检查通过。

# Constraints and invariants

- 工作区：`/Users/longchan/orca/projects/trellis-dashboard/.worktrees/trellis-dashboard`。
- 分支：`comet/trellis-dashboard`，目标分支 `main`；保留原目录已有未提交文件。
- 遵循 `.comet/config.yaml` 的 Native、中文、Batch 澄清模式。
- 数据来源是用户的本地文件，不是远程数据库；所有用户内容视为不可信输入。
- UI 文案默认中文，保留文件名、原始 status、开发者标识等真实信息。
- 标准 task status 与工作流步骤分开；parent/children 不自动等同于执行依赖。
- 不要求在目标项目安装开发依赖，不写入其 package.json、`.trellis` 或 Git 索引。
- 无业务写 API；所有任务生命周期和源文件编辑继续由用户现有 Trellis 工具负责。

# Decisions

- D1（用户已确认）：使用 C，独立 worktree 开发。
- D2（调查结论）：当前仓库没有业务工程，使用独立 CLI + 内置前端资产，不修改上游 Trellis CLI。
- D3（来源边界）：本地产品中心材料是数据格式和浏览体验参考，不执行其中业务任务或 Agent 指令。
- D4（实现组织）：CLI、文件读取和 UI 是同一个本地产品的紧密集成，保持单个 Native change，不拆 Supervisor 子任务；实现后按 Comet 进行独立只读验收。
- D5（用户已确认原始范围）：本地优先、无后台数据库、不需要云端、中文 UI、可选不打开浏览器、端口冲突可诊断。
- D6（用户已确认 Q1）：只读浏览，不修改 `.trellis`，不触发脚本或 Git 操作。
- D7（用户已确认 Q2）：完整浏览，首版包含任务看板与产物、规范库、按开发者分组的工作记录。
- D8（用户已提出的修订）：提高阅读区屏幕利用率，缩小非内容区，目录和正文独立滚动；用户尚未接受首轮结果，不执行归档或工作区收尾。
- D9（用户已确认的阅读布局）：默认文档阅读优先，次要任务信息集中到独立页签；文档页搜索并入紧凑标题工具区；移动端目录按需展开。保持同一个 Native change，不改变后端数据和只读边界。
- D10（用户明确补充）：任务面板也必须纳入整体屏效改进。本轮补齐紧凑统计/筛选和看板/列表独立滚动，保留 D9 及 A4/A6 的已完成效果，不把“例如”误解为只调整列举的阅读区域。

# Open questions

无待澄清的用户问题；本轮只需确认修订后的完整 Shape，保留此前已确认且未改变的范围。

# Verification expectations

- 文件模型/状态兼容测试：活动与归档、目录名与 id 不一致、空值、未知状态、父子关系、计划勾选、JSONL、缺失及损坏内容。
- 安全测试：目录穿越、URL 编码、越界符号链接、脚本注入、非获准文件、只读目标文件不变。
- CLI 集成测试：根目录/子目录/显式路径、没有 `.trellis`、端口占用、退出、`--help`、安装构建资产定位。
- 浏览器验证：主要页面、筛选、详情、Markdown、响应式空态/错误态、同步更新；不可用时记录阻塞，不代替为通过。
- 阅读布局回归：桌面和移动端测量实际正文视窗高度；使用长目录与长 Markdown，在目录或正文滚轮时仅对应容器滚动，顶部框架/标题/文档工具栏位置不变，边界滚动不传给整页；验证内部锚点、自动刷新和目录展开/选文档仍正常。
- 任务面板布局回归：用多列长任务列表检查定向滚轮、旁列位置不变、固定全局工具/列头、边界隔离和列表粘性表头；桌面与窄屏均无整页溢出，搜索/完整筛选/归档切换/排序/视图切换仍可操作，自动刷新不重置未改变视图的滚动位置。
- 构建、类型检查、自动化测试和 npm 打包验证；独立只读 Verifier 判断全部最终验收项。
