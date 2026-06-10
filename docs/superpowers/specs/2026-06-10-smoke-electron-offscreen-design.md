## 背景

当前 `npm run smoke` 通过 Node 测试执行 Playwright Chromium 打开雀魂并截图，随后将截图输入 `recognizeFrame`，产出：

- `artifacts/smoke/majsoul.png`
- `artifacts/smoke/recognition.json`

同时仓库存在 Playwright Chromium 的安装流程（`postinstall`），导致首次安装依赖时需要额外下载浏览器资源。

## 目标

- 将 `npm run smoke` 改为 Electron 主进程创建 offscreen `BrowserWindow` 加载雀魂，通过 `webContents.capturePage()` 获取 PNG。
- 保持 smoke 产物与内容路径不变：
  - `artifacts/smoke/majsoul.png`
  - `artifacts/smoke/recognition.json`
- 完全移除 Playwright 依赖与资源安装流程，确保首次 `npm install` 后 `npm run smoke` 可直接运行。

## 非目标

- 不保证 smoke 在所有网络环境下稳定通过（仍属于“在线冒烟测试”）。
- 不引入登录、自动化点击、或对游戏状态的确定性等待逻辑，仅保证能加载页面并捕获一帧画面用于识别链路验证。

## 方案概述

### 入口调整

- 新增 `scripts/smoke-electron.js` 作为 Electron 入口脚本。
- `package.json` 的 `scripts.smoke` 改为：`electron scripts/smoke-electron.js`。

### 截图与识别链路

Electron 侧流程：

1. `app.whenReady()`
2. 创建 `BrowserWindow`：
   - `show: false`
   - `webPreferences` 延用现有主窗口安全选项，并启用 `offscreen: true`
3. `await win.loadURL(getMajsoulUrl())`
4. 等待页面初步稳定（固定延迟）
5. `const image = await win.webContents.capturePage()` → `png = image.toPNG()`
6. 写出 `artifacts/smoke/majsoul.png`
7. `decodePngToRgba(png)` → `recognizeFrame({ layout: getDefaultLayout(), bank: { tiles: [], digits: [] } })`
8. 写出 `artifacts/smoke/recognition.json`
9. 清理窗口并 `app.quit()`

### 超时与退出码

- 增加整体超时，避免网络或渲染问题导致进程不退出。
- 失败时：
  - 输出错误信息到 stderr
  - 设置 `process.exitCode = 1`
  - 尽最大努力关闭窗口并 `app.quit()`

## 变更清单

- 新增：`scripts/smoke-electron.js`
- 更新：`package.json`
  - `scripts.smoke` 改为 electron 入口
  - 移除 `postinstall`（不再安装 Playwright Chromium）
  - 移除 `devDependencies.playwright`
- 删除：Playwright 相关安装脚本与测试用例
  - `scripts/installResources.js`
  - `src/install/playwrightBrowser.js`
  - `test/smokeOnline.test.js`
  - `test/playwrightBrowser.test.js`

## 验收标准

- 全新安装依赖（只执行 `npm install`）后，`npm run smoke` 能运行并结束。
- `artifacts/smoke/majsoul.png` 存在且可解码为有效 PNG（宽高 > 0）。
- `artifacts/smoke/recognition.json` 存在，且包含 `recognizeFrame` 的输出结构（例如 `handTiles` 为数组、`rivers` 为对象）。
- 代码库不再包含 Playwright 依赖与 Chromium 安装流程。

## 风险与缓解

- offscreen 渲染在部分平台可能出现白屏或渲染延迟：通过固定等待 + 超时退出降低卡死风险。
- 雀魂页面可能重定向或加载时间波动：保留较长超时并输出清晰错误，便于定位网络问题。
