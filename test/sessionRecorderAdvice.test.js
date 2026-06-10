const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startSessionRecorder } = require('../src/recorder/sessionRecorder');

function createFakeWindow() {
  const listeners = new Map();
  return {
    webContents: {
      async capturePage() {
        return {
          getSize() {
            return { width: 2, height: 2 };
          },
          toBitmap() {
            return Buffer.alloc(2 * 2 * 4);
          },
          toPNG() {
            return Buffer.from([0x89, 0x50, 0x4e, 0x47]);
          },
        };
      },
    },
    getBounds() {
      return { width: 1280, height: 720 };
    },
    on(event, listener) {
      listeners.set(event, listener);
    },
    emit(event) {
      const listener = listeners.get(event);
      if (listener) listener();
    },
  };
}

test('startSessionRecorder: attaches core db to advice coordinator when available', async () => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'majsoul-recorder-advice-'));
  const win = createFakeWindow();
  const attached = [];

  const recorder = await startSessionRecorder({
    win,
    userDataDir,
    configSnapshot: { majsoulUrl: 'https://game.maj-soul.com/1/' },
    adviceServices: {
      coordinator: {
        setDb(db) {
          attached.push(db);
        },
      },
    },
  });

  try {
    assert.equal(attached.length, 1);
    assert.equal(typeof attached[0].insertAdviceResult, 'function');
  } finally {
    await recorder.stop();
  }
});
