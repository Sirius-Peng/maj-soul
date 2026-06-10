# Majsoul Review Assistant

一个面向雀魂 Web 客户端的桌面辅助工程，提供图形化启动器、对局事实采集、会话导出，以及基于 LLM 的实时建议悬浮窗。

## 项目定位

这个项目不是“纯视觉识别脚本”，而是一个以 Electron 为容器的桌面工程：

- 用图形化启动器统一管理启动、参数配置与运行状态
- 用 Electron CDP 抓取 WebSocket 帧并解析 `liqi` 协议
- 在协议事实不足时，再使用视觉识别作为补充证据
- 在可操作时机触发 DeepSeek 建议，并通过悬浮窗展示备选操作与相对概率

当前目标是把它整理成一个可持续演进的工程化仓库，而不是一次性的实验脚本。

## 核心能力

- 图形化启动器：启动雀魂、保存参数、查看当前运行状态
- 事实优先采集：通过 `webContents.debugger` 监听 WebSocket 帧，解析 `liqi protobuf`
- 视觉兜底：识别手牌、宝牌指示牌、四家河和部分局面信息
- 会话落盘：SQLite 增量写入，结束时导出 `session.json` 与可选 CSV
- 实时建议：检测可操作时机，调用 DeepSeek，悬浮窗展示主建议和备选方案
- 启动级验证：覆盖“先进入启动器，再启动雀魂”的真实入口路径

## 系统架构

项目采用“事实优先，视觉兜底”的混合架构：

1. Electron 主进程负责生命周期、窗口管理和 CDP 能力接入
2. 启动器窗口负责配置输入、参数保存和运行状态控制
3. 会话录制器负责截图、关键帧判定、对局生命周期与导出
4. CDP WebSocket Tap 负责采集和解析 `liqi` 事件流
5. 建议链路负责机会检测、LLM 请求、结果持久化和悬浮窗渲染

关键目录：

- `src/main.js`：Electron 应用入口
- `src/launcher/`：图形化启动器、生命周期控制器、启动级 smoke 辅助
- `src/recorder/`：会话录制、导出与页面探测
- `src/net/`：CDP WebSocket 帧采集
- `src/liqi/`：`liqi` 编解码与事件解析
- `src/advice/`：DeepSeek prompt、客户端与建议协调
- `src/overlay/`：悬浮窗 UI
- `src/db/`：SQLite schema、存取与导出
- `test/`：原生 `node --test` 自动化测试

## 快速开始

### 环境要求

- Node.js `>= 22`
- macOS 或 Windows
- 可访问雀魂 Web 客户端

### 安装依赖

```bash
npm install
```

### 启动应用

macOS / Linux:

```bash
./scripts/dev.sh
```

Windows PowerShell:

```powershell
./scripts/dev.ps1
```

也可以直接启动：

```bash
npm run dev
```

## 图形化启动器

应用启动后会先进入图形化启动器，而不是直接打开雀魂页面。

推荐使用流程：

1. 在启动器中填写或调整 `雀魂地址` 与 DeepSeek 参数
2. 点击“保存配置”将参数持久化
3. 点击“启动雀魂”创建主窗口、录制器与悬浮窗
4. 结束当前会话时，点击“停止当前会话”

配置行为说明：

- 最近一次保存的参数会写入 Electron `userData` 目录下的 `launcher-config.json`
- 环境变量依然可用，并且在本次启动时优先覆盖持久化配置
- 如果启用了建议功能但未配置 `DEEPSEEK_API_KEY`，系统会降级为“不启用建议”，但雀魂仍会正常启动

## DeepSeek 建议能力

你可以在启动器里填写参数，也可以通过环境变量覆盖：

```bash
export DEEPSEEK_API_KEY="your_api_key"
export DEEPSEEK_BASE_URL="https://api.deepseek.com"
export DEEPSEEK_MODEL="deepseek-v4flash"
export MAJSOUL_ADVICE_ENABLED="1"
export MAJSOUL_ADVICE_TIMEOUT_MS="6000"
export MAJSOUL_ADVICE_STRATEGY="balanced"
```

参数说明：

- `DEEPSEEK_API_KEY`：建议填写；留空时会触发降级提示
- `DEEPSEEK_BASE_URL`：默认 `https://api.deepseek.com`
- `DEEPSEEK_MODEL`：默认 `deepseek-v4flash`
- `MAJSOUL_ADVICE_ENABLED`：`1` 开启，`0` 关闭
- `MAJSOUL_ADVICE_TIMEOUT_MS`：建议请求超时毫秒数
- `MAJSOUL_ADVICE_STRATEGY`：建议风格，如 `balanced` / `defensive` / `aggressive`

当前建议功能边界：

- 已支持自动检测“轮到你操作”的基础时机
- 已支持建议请求、落库、导出与悬浮窗展示
- 尚未完成更复杂局面下的全量操作语义覆盖与长期稳定性验证

## 数据目录与导出

会话数据采用双重存储：

- SQLite：运行中增量写入
- 文件导出：会话结束时写入 `sessions/<sessionId>/`

主要输出包括：

- `session.json`
- `keyframes/`
- `frames/`
- 可选 CSV 导出

启动级验证和 smoke 产物默认位于：

- `artifacts/smoke/launcher-start.json`
- `artifacts/smoke/majsoul.png`
- `artifacts/smoke/recognition.json`
- `artifacts/smoke/liqi_events.json`

## 开发命令

```bash
npm run dev
npm run test
npm run check
npm run bench
npm run smoke
npm run smoke:launcher
```

命令说明：

- `npm run test`：运行全部自动化测试
- `npm run check`：当前等价于测试校验，供本地提交前使用
- `npm run bench`：运行识别基准测试
- `npm run smoke`：离屏加载雀魂页面并导出识别/协议 smoke 结果
- `npm run smoke:launcher`：验证真实 Electron 入口是否能走通“启动器 -> 启动雀魂”路径

## 测试与验证

### 自动化测试

```bash
npm test
```

### 启动级验证

```bash
npm run smoke:launcher
```

成功时：

- 会启动真实 `electron .` 入口
- 启动器渲染层通过 `launcherApi.startSession()` 触发 IPC
- `artifacts/smoke/launcher-start.json` 中的 `state.status.phase` 为 `running`

### 在线 smoke

```bash
npm run smoke
```

## Windows 启动说明

如果 PowerShell 执行脚本时报错：

> `... cannot be loaded because running scripts is disabled on this system.`

请执行：

```powershell
Get-ExecutionPolicy -List
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

然后确认：

```powershell
node -v
npm -v
```

常见问题：

- `npm : 无法加载文件 ...\npm.ps1`
  - 处理：设置 `ExecutionPolicy` 为 `RemoteSigned`
- `Electron failed to install correctly`
  - 处理：删除 `node_modules` 后重新 `npm install`

## 常见问题

### 为什么不是只做视觉识别？

因为纯视觉识别在复杂对局状态下稳定性不足。当前项目优先使用 CDP + WebSocket + `liqi` 协议解析，再把视觉识别作为证据补偿。

### 为什么启动器里保存了参数，但这次运行不一致？

因为环境变量在本次启动时优先级高于持久化配置。若设置了相关环境变量，它们会覆盖 `launcher-config.json` 中的值。

### 为什么没有配置 API Key 也能启动？

这是刻意设计的降级路径：建议功能不是主流程硬依赖，未配置完整时会提示降级，但不会阻塞雀魂启动与会话采集。

## 当前边界与风险

- 当前 Electron 依赖仍处于较旧版本，后续建议单独做一轮升级与兼容验证
- DeepSeek 建议功能仍处于可用但偏早期阶段，未完成全量策略优化
- 项目目前更适合作为内部工具/研发原型，还未完成安装包、自动更新、隐私条款和正式发布流程

## 路线图

- 扩大图形化配置面板可调参数范围
- 增强对 `liqi` 操作语义的覆盖率
- 加入更完整的错误日志与诊断能力
- 补齐发布流程、版本策略和 CI/CD
