# Majsoul Review Assistant

## 开发启动

```bash
./scripts/dev.sh
```

Windows PowerShell：

```powershell
./scripts/dev.ps1
```

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

## 基准测试

```bash
npm run bench
```

输出：`artifacts/bench/report.md`、`artifacts/bench/report.json`

## 在线冒烟测试（可选）

```bash
npm run smoke
```

输出：`artifacts/smoke/majsoul.png`、`artifacts/smoke/recognition.json`
