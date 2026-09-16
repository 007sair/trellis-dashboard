# Trellis Dashboard

一个本地、只读的 [Trellis](https://github.com/mindfold-ai/Trellis) 项目面板。**安装一次，在任意包含 `.trellis/` 的项目里运行 `trellis-dashboard` 即可打开。**

不需要数据库、Python 或 AI 服务，不修改目标项目，不执行它的脚本与 hooks。前端和服务端都随安装包构建，无须向目标项目添加依赖。

> 当前是本地交付版本，**没有发布到 npm**。请使用下面的本地安装方式，不要假设 `npx trellis-dashboard` 已指向本项目。

## 快速开始

运行环境：Node.js **18.18+**。开发和浏览器测试推荐 Node.js **22 LTS**，本项目在 Node.js 22 / macOS 上验证。

### 1. 在 Dashboard 源码目录安装一次

```bash
npm install
npm run build
npm install --global .
```

或者生成独立分发包再安装（不依赖源码目录持续存在）：

```bash
npm pack
npm install --global ./trellis-dashboard-0.1.0.tgz
```

全局安装目录需在 PATH 中；若没有全局写权限，可以使用自己的 npm prefix，或使用下面的“免全局安装”方式。不需要 `sudo` 修改目标项目。

### 2. 在你的 Trellis 项目启动

```bash
cd /path/to/your-project
trellis-dashboard
```

默认打开 `http://127.0.0.1:4317`。按 **Ctrl+C** 停止。也可以从项目子目录运行，自动向上找到最近的 `.trellis`。

```bash
# 显式指定项目；路径可以包含空格和中文
trellis-dashboard --dir "/path/to/your project"

# 换一个端口，不自动打开浏览器
trellis-dashboard --port 4320 --no-open

# 自动分配空闲端口，以终端打印的 URL 为准
trellis-dashboard --dir /path/to/project --port 0

trellis-dashboard --help
trellis-dashboard --version
```

**免全局安装**（先在源码目录完成 `npm install && npm run build`）：

```bash
node /absolute/path/to/trellis-dashboard/bin/trellis-dashboard.mjs \
  --dir /path/to/your-project --no-open
```

### 开发时启动

```bash
npm run dev -- --dir /path/to/your-project --no-open
```

此命令先构建再启动，不向目标项目写文件。修改 Dashboard 源码后重新构建/启动即可。

## 面板内容

### 任务面板

- 看板 / 列表、关键词搜索、状态 / 优先级 / 负责人组合筛选、最近更新 / 创建时间 / 优先级排序。
- 活动、归档及全部视图；统计与当前筛选集合一致。
- 紧凑统计、固定导航与搜索筛选；每个看板列独立滚动，列表数据区独立滚动且表头保持可见，不再由任务数量撑高整页。
- 窄屏看板可在内部横向切列；点击筛选按钮可展开完整状态/优先级/负责人筛选，支持关闭和 Escape。相同视图自动刷新时保留滚动位置。
- 支持 `planning`、`in_progress`、`completed`；未知状态保留原值，不会被错当成完成。
- 查看父子关系、基础信息、备注和完整原始元数据；目录名可以不同于 `id` / `name`。
- 阅读 `prd.md`、`design.md`、`implement.md`、`research/` 与 JSON/JSONL 等文本产物。可选文档不存在时正常显示。
- JSONL 跳过 `_example` 模板行，单独标记损坏行，保留其他有效记录。

**执行计划进度**仅统计 `implement.md` 中真正的 Markdown 任务复选框，排除代码示例。没有可计算计划时显示“未提供”。它不是代码完成率、测试通过率或正式验收结论；`in_progress` 不被强行拆成实现/检查/收尾。

### 规范库

按 `.trellis/spec/` 的实际目录阅读 Markdown，兼容 `frontend/`、`guides/` 以及多包、多层组织方式；支持安全的内部文档链接。

### 工作记录

按 `.trellis/workspace/<developer>/` 查看索引与 `journal-N.md`，也支持根工作区索引。这里是历史记录，不是 Agent 在线状态或实时对话。

### 阅读空间与滚动

- 任务详情采用接近满屏的阅读布局；默认展示文档，完整说明、关系和备注移到“任务信息”页签，原始 JSON 仍在“原始元数据”中。
- 规范库和工作记录的文件搜索位于紧凑标题栏右侧。目录、正文分别滚动，导航、页签和文档工具栏不跟随正文移动；滚到边界也不会继续带动整页。
- 移动端文档目录默认收起，点击标题右侧的目录按钮展开；选中文档后返回阅读。支持 Escape 收起目录。
- 内部锚点只定位正文；每两秒刷新不会无故把当前阅读位置重置到顶部。
- 默认阅读状态的浏览器回归标准：1440×900 下正文视窗不少于 630px，390×844 下不少于 422px。测试用长目录和长 Markdown 验证真实滚动，而非只比较静态截图。

### 数据同步与异常

前端每 **2 秒**读取本地快照，常规项目的变化在 **5 秒内**可见；也可手动刷新。打开的文档会同步更新。目录消失时明确显示不可用，不把旧快照冒充最新状态。

单个损坏任务、未知字段、缺失可选目录、超限文档不会让其他合法数据不可用；读取提示会说明被跳过的路径和原因。

## 读取范围与安全

- 服务只绑定 **127.0.0.1**，没有 `--host 0.0.0.0` 选项。没有账户、远程共享、遥测、云端上传或数据库。
- 只有 GET / HEAD 接口，校验 Host / Origin；没有任务创建、编辑、启动、归档或任意命令接口。
- 文件接口仅开放 `tasks/` 的 Markdown、JSON、JSONL、TXT、YAML 文本，以及 `spec/` / `workspace/` 的 Markdown。`.version` 只用于显示版本。
- 不开放 `.developer`、`.runtime`、`.env`、项目源码、`scripts/`、agents 或任意文件系统路径。
- 拒绝目录穿越、隐藏路径和越界符号链接；仅允许仍位于获准内容范围内的链接。顶层 `.trellis` 指向项目外的链接也会被拒绝，不继承 Trellis 的额外受信任目录配置。
- Markdown 不执行原始 HTML/脚本。外部链接须用户点击才打开；不自动加载 Markdown 图片，包括远程跟踪图片。
- 不执行目标项目的 Python、shell、hooks、Git 或 AI 工具；不修改 `.trellis`、package.json、Git 索引或任务状态。

### 有界读取

为避免单个本地文件拖垮面板，设置如下上限；达到上限时明确提示，不将截断数据冒充完整结果：

| 项目 | 上限 |
| --- | --- |
| 单份文档 | 1 MiB |
| 单份 task.json | 256 KiB |
| 单次任务/计划读取预算 | 8 MiB |
| 单次扫描目录项 | 10,000 |
| 任务数 | 1,000 |
| 目录嵌套深度 | 32 |
| JSONL 结构化展示 | 前 2,000 行，仍可展开文件完整原文 |

超大型项目可能需要缩小内容规模；面板不是后台索引服务器。目录文件布局兼容基于官方说明及 Trellis **0.6.15** 样例验证，不承诺未知未来版本的所有扩展语义。

## 验证与测试

```bash
npm run typecheck
npm test                       # 构建 + 单元 / 文件系统 / HTTP / CLI 集成测试
npm exec -- playwright install chromium
npm run test:e2e                # 先完成 build；真实 Chromium 浏览器测试
npm run test:package            # pack → 离线临时全局安装 → 在另一项目启动
npm run check                  # 完整检查（需要已安装 Chromium）
```

测试使用临时合成项目，不依赖开发者私有路径。覆盖任务兼容性、解析、实时刷新、异常、只读摘要对比、路径/符号链接保护、跨源防护、安装后的命令、桌面/移动端交互以及 Markdown 脚本和远程资源隔离；另用长列表/长文档验证阅读高度、定向滚轮、边界隔离、固定工具栏、移动目录及锚点/刷新位置。测试中的安装使用临时 prefix，不污染实际全局 npm 安装。

浏览器截图和失败 trace 存在 `test-results/`，不纳入安装包。

## 常见问题

- **找不到 `.trellis`**：进入已经初始化的 Trellis 项目或传 `--dir`；本命令不会自动执行 `trellis init`。
- **最近的 `.trellis` 损坏/是普通文件**：先修复该目录；不会偷偷改为打开上层项目。
- **4317 被占用**：换 `--port 4320` 或 `--port 0`；不会结束别人的进程。
- **浏览器没打开**：直接访问终端中的 URL；自动打开失败不会结束已启动的服务。
- **缺少前端资产**：在源码目录执行 `npm run build`，或重新安装生成的 `.tgz`；不能只拷贝启动脚本。
- **任务状态不符合预期**：面板显示磁盘上的 task.json 原值；`finish` 只清除会话指针不一定改变状态，归档和 completed 也不是同一个概念。
- **跨目录 symlink 被拒绝**：这是面板的只读安全边界；不通过配置文件隐式授予其他目录权限。

## 实现结构

```text
bin/                  可安装的命令入口
src/server/           项目发现、有界文件读取、本地 HTTP 服务
src/shared/           DTO、筛选、JSONL 与安全链接规则
src/client/           React 界面、文档阅读器、响应式样式
test/                 合成 fixture、单元/集成/浏览器测试
scripts/              构建与隔离安装验证
dist/                 构建后随包分发的服务端和前端资产
```

运行期不需要第三方 Node 依赖，前端与 Markdown 解析器在构建时打包。React、Vite、TypeScript、Playwright 等只用于开发/构建。

## 来源与边界

本项目独立实现文件读取与 UI，参考 Trellis 的公开文件语义，不是官方 Trellis CLI 的修改版，不复制其脚本、Agent 定义、品牌图片或用户业务内容。

- [Trellis 官方仓库](https://github.com/mindfold-ai/Trellis)
- [How It Works](https://docs.trytrellis.app/start/how-it-works)

上游 Trellis 使用 AGPL-3.0；本地数据不会被纳入 Dashboard 分发包。此仓库当前为未公开发布的交付版本。
