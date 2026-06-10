# Smoke（Electron offscreen）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `npm run smoke` 改为 Electron offscreen `BrowserWindow` 加载雀魂并 `capturePage()`，继续产出 `artifacts/smoke/majsoul.png` 与 `artifacts/smoke/recognition.json`，并移除 Playwright 依赖与安装流程。

**Architecture:** 以 `electron scripts/smoke-electron.js` 作为入口，主进程创建 offscreen 窗口加载 `getMajsoulUrl()`，捕获 PNG 后复用现有 `decodePngToRgba` + `recognizeFrame` 产物链路；清理 Playwright 相关脚本/测试/依赖，确保全新安装后可直接运行。

**Tech Stack:** Electron（BrowserWindow/webContents）、Node.js fs/promises、pngjs（已用于解码）、现有 `recognizeFrame` pipeline。

---

## Files

- Create: `scripts/smoke-electron.js`
- Modify: `package.json`
- Delete: `scripts/installResources.js`
- Delete: `src/install/playwrightBrowser.js`
- Delete: `test/smokeOnline.test.js`
- Delete: `test/playwrightBrowser.test.js`
- Modify (optional): `README.md`（保持 smoke 命令与产物描述一致）
- Modify: `package-lock.json`（通过 `npm install` 生成的 lock 变更）

---

### Task 1: 新增 Electron smoke 脚本（截图 + 识别 + 产物落盘）

**Files:**
- Create: `scripts/smoke-electron.js`

- [ ] **Step 1: 写一个最小可运行脚本骨架**

目标：Electron 启动后能 `app.whenReady()` 并创建 offscreen `BrowserWindow`，成功退出进程。

```js
const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow } = require('electron');

const { getMajsoulUrl, getMainWindowOptions } = require('../src/config');
const { getDefaultLayout } = require('../src/vision/defaultLayout');
const { decodePngToRgba } = require('../src/vision/pngDecode');
const { recognizeFrame } = require('../src/vision/recognizeFrame');

function withTimeout(promise, ms) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function main() {
  const outDir = path.join(__dirname, '..', 'artifacts', 'smoke');
  await fs.mkdir(outDir, { recursive: true });

  const opts = getMainWindowOptions();
  const win = new BrowserWindow({
    ...opts,
    show: false,
    webPreferences: {
      ...opts.webPreferences,
      offscreen: true,
      backgroundThrottling: false,
    },
  });

  try {
    await withTimeout(win.loadURL(getMajsoulUrl()), 90_000);
    await new Promise((r) => setTimeout(r, 3_000));
    const image = await withTimeout(win.webContents.capturePage(), 30_000);
    const png = image.toPNG();
    await fs.writeFile(path.join(outDir, 'majsoul.png'), png);

    const { bitmap, width, height } = decodePngToRgba(png);
    if (!(width > 0 && height > 0)) throw new Error('invalid png size');

    const result = recognizeFrame({
      bitmap,
      width,
      height,
      bank: { tiles: [], digits: [] },
      layout: getDefaultLayout(),
    });

    await fs.writeFile(path.join(outDir, 'recognition.json'), JSON.stringify(result, null, 2));
  } finally {
    win.destroy();
  }
}

app.whenReady().then(async () => {
  try {
    await withTimeout(main(), 120_000);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
```

- [ ] **Step 2: 本地跑 smoke 验证能产出文件并退出**

Run:

```bash
npm run smoke
```

Expected:
- 进程在超时前退出（0 或 1 均可接受，取决于网络/渲染是否成功）
- 若成功：存在 `artifacts/smoke/majsoul.png` 与 `artifacts/smoke/recognition.json`

- [ ] **Step 3: 加强错误可观察性（只依赖 stderr 输出）**

目标：当 `loadURL`、`capturePage`、解码或识别失败时，stderr 有明确错误来源（Error message + stack）。

实现方式：保持 `console.error(err)`，并确保关键步骤抛出的错误信息语义明确（例如 `invalid png size`、`timeout after ...ms`）。

- [ ] **Step 4: 运行单测确保不受影响**

Run:

```bash
npm test
```

Expected: PASS

- [ ] **Step 5:（可选）提交**

用户未要求自动提交；如需提交：

```bash
git add scripts/smoke-electron.js
git commit -m "feat(smoke): add electron offscreen smoke script"
```

---

### Task 2: 更新 npm scripts，移除 Playwright 安装流程

**Files:**
- Modify: `package.json`
- Delete: `scripts/installResources.js`
- Delete: `src/install/playwrightBrowser.js`

- [ ] **Step 1: 修改 `package.json`**

目标：
- `scripts.smoke` → `electron scripts/smoke-electron.js`
- 移除 `postinstall`
- 移除 `devDependencies.playwright`

- [ ] **Step 2: 删除 Playwright 安装相关文件**

删除：
- `scripts/installResources.js`
- `src/install/playwrightBrowser.js`

- [ ] **Step 3: 确认 `npm install` 不再触发浏览器资源安装**

Run:

```bash
npm install
```

Expected:
- 不再执行 Playwright 安装逻辑（无 chromium 下载输出）

- [ ] **Step 4:（可选）提交**

```bash
git add package.json
git rm scripts/installResources.js src/install/playwrightBrowser.js
git commit -m "chore: remove playwright install flow"
```

---

### Task 3: 移除 Playwright 测试与相关引用

**Files:**
- Delete: `test/smokeOnline.test.js`
- Delete: `test/playwrightBrowser.test.js`

- [ ] **Step 1: 删除 Playwright 测试用例**

删除：
- `test/smokeOnline.test.js`
- `test/playwrightBrowser.test.js`

- [ ] **Step 2: 运行单测确保无残留引用**

Run:

```bash
npm test
```

Expected:
- PASS
- 无 `Cannot find module 'playwright'` 之类错误

- [ ] **Step 3:（可选）提交**

```bash
git rm test/smokeOnline.test.js test/playwrightBrowser.test.js
git commit -m "test: remove playwright-based smoke tests"
```

---

### Task 4: 更新 lockfile 与 README（确保新手体验一致）

**Files:**
- Modify: `package-lock.json`
- Modify (optional): `README.md`

- [ ] **Step 1: 重新生成 lockfile**

Run:

```bash
npm install
```

Expected:
- `package-lock.json` 不再包含 Playwright 相关条目

- [ ] **Step 2:（可选）更新 README 描述**

目标：README 中 `npm run smoke` 的使用方式与产物路径保持一致（命令不变，产物不变）。

- [ ] **Step 3: 最终验收：全新依赖安装后 smoke 可直接运行**

在干净环境（删除 `node_modules` 后）验证：

Run:

```bash
rm -rf node_modules
npm install
npm run smoke
```

Expected:
- 可运行并退出
- 若网络正常：产物齐全

- [ ] **Step 4:（可选）提交**

```bash
git add package-lock.json README.md
git commit -m "chore: update lockfile after removing playwright"
```

---

## Self-Review

- Spec coverage：脚本入口、offscreen window + capturePage、两份产物、移除 Playwright 依赖/安装流程、首次安装可运行均有对应任务。
- Placeholder scan：无 TBD/TODO；每步均给出明确路径与命令。
- Consistency：复用 `src/config`、`decodePngToRgba`、`recognizeFrame` 与现有 smoke 流水线一致。
