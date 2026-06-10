# Majsoul Review Assistant

## 开发启动

```bash
./scripts/dev.sh
```

Windows PowerShell：

```powershell
./scripts/dev.ps1
```

启动后会先打开图形化启动器，而不是直接进入雀魂页面。当前推荐流程：

1. 在启动器里填写或调整 `雀魂地址` 与 DeepSeek 建议参数
2. 点击“保存配置”以持久化参数
3. 点击“启动雀魂”创建主窗口、录制器与悬浮窗
4. 需要结束当前会话时，点击“停止当前会话”

配置说明：

- 图形化启动器会把最近一次保存的参数写入 Electron `userData` 目录下的 `launcher-config.json`
- 环境变量仍然生效，并且在本次启动时优先覆盖持久化配置
- 如果启用了建议功能但没有填写 `DEEPSEEK_API_KEY`，启动器会提示“建议功能未完整配置，已降级为不启用建议”，雀魂仍可正常启动

### Windows 启动验证（PowerShell）

1) ExecutionPolicy

如果执行脚本时报错：

> `... cannot be loaded because running scripts is disabled on this system.`

在 PowerShell 中执行：

```powershell
Get-ExecutionPolicy -List
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

2) Node.js 版本确认

```powershell
node -v
npm -v
```

建议使用当前 Node.js LTS（过旧版本可能导致 `npm install` 或 Electron 依赖安装失败）。

3) 运行开发脚本

在仓库根目录执行：

```powershell
.\scripts\dev.ps1
```

4) 常见报错

- `npm : 无法加载文件 ...\npm.ps1，因为在此系统上禁止运行脚本。`
  - 处理：同上，设置 `ExecutionPolicy` 为 `RemoteSigned`（`CurrentUser` 作用域）
- `npm error Missing script: "install:resources"`
  - 处理：当前版本可能未提供该 npm script；可先直接执行 `npm run dev`（或在本地调整 `scripts/dev.ps1` 里的对应步骤）
- `Electron failed to install correctly, please delete node_modules/electron and try installing again`
  - 处理：删除 `node_modules` 后重装（或检查杀毒软件/代理导致的下载失败）

## 测试

```bash
npm test
```

## 启动级验证

验证“先打开启动器，再启动雀魂”的新路径：

```bash
npm run smoke:launcher
```

输出：`artifacts/smoke/launcher-start.json`

说明：

- 该验证会启动真实 Electron 应用入口 `electron .`
- 启动器渲染层会通过 `launcherApi.startSession()` 触发 IPC，再进入主进程生命周期控制器
- 成功时，`launcher-start.json` 中的 `state.status.phase` 会是 `running`

## DeepSeek 实时建议

启用建议悬浮窗前，可以在启动器里填写参数，也可以通过环境变量覆盖：

```bash
export DEEPSEEK_API_KEY="your_api_key"
export DEEPSEEK_BASE_URL="https://api.deepseek.com"
export DEEPSEEK_MODEL="deepseek-v4flash"
export MAJSOUL_ADVICE_ENABLED="1"
export MAJSOUL_ADVICE_TIMEOUT_MS="6000"
export MAJSOUL_ADVICE_STRATEGY="balanced"
```

说明：

- `DEEPSEEK_API_KEY`：建议填写；若留空且 `MAJSOUL_ADVICE_ENABLED=1`，启动器会提示建议功能降级，但雀魂主流程仍可运行
- `DEEPSEEK_BASE_URL`：默认 `https://api.deepseek.com`
- `DEEPSEEK_MODEL`：默认 `deepseek-v4flash`
- `MAJSOUL_ADVICE_ENABLED`：`1` 开启，`0` 关闭
- `MAJSOUL_ADVICE_TIMEOUT_MS`：建议请求超时毫秒数
- `MAJSOUL_ADVICE_STRATEGY`：建议风格，如 `balanced` / `defensive` / `aggressive`

运行后：

- 主窗口继续加载雀魂页面
- 检测到“轮到你操作”时会自动请求建议
- 透明悬浮窗会显示主建议、备选方案和相对概率
- 建议与请求结果会写入 SQLite，并随 `session.json` 一起导出

## 基准测试

```bash
npm run bench
```

输出：`artifacts/bench/report.md`、`artifacts/bench/report.json`

## 在线冒烟测试（可选）

```bash
npm run smoke
```

输出：`artifacts/smoke/majsoul.png`、`artifacts/smoke/recognition.json`、`artifacts/smoke/liqi_events.json`
