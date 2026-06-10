const fs = require('node:fs/promises');
const path = require('node:path');

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

async function runSmoke() {
  const repoRoot = path.join(__dirname, '..');
  const url = getMajsoulUrl();
  const outDir = path.join(repoRoot, 'artifacts', 'smoke');
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
    await withTimeout(win.loadURL(url), 90_000);
    await new Promise((r) => setTimeout(r, 3_000));

    const image = await withTimeout(win.webContents.capturePage(), 30_000);
    const png = image.toPNG();
    await fs.writeFile(path.join(outDir, 'majsoul.png'), png);

    const { bitmap, width, height } = decodePngToRgba(png);
    if (!(width > 0 && height > 0)) {
      throw new Error(`invalid png size: ${width}x${height}`);
    }

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

async function main() {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('log-level', '3');
  app.disableHardwareAcceleration();
  await app.whenReady();
  await withTimeout(runSmoke(), 120_000);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    app.quit();
  });
