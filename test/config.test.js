const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  createRuntimeConfigSnapshot,
  getAdviceRuntimeState,
  getAdviceConfig,
  getLauncherConfigPath,
  getMajsoulUrl,
  getMainWindowOptions,
  readPersistedLauncherConfig,
  validateLauncherConfig,
  writePersistedLauncherConfig,
} = require('../src/config');

async function withEnv(overrides, fn) {
  const prev = {};
  for (const [key, value] of Object.entries(overrides)) {
    prev[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('getMajsoulUrl: default', () => {
  assert.equal(getMajsoulUrl(), 'https://game.maj-soul.com/1/');
});

test('getMainWindowOptions: security defaults', () => {
  const options = getMainWindowOptions();

  assert.equal(options.webPreferences.nodeIntegration, false);
  assert.equal(options.webPreferences.contextIsolation, true);
});

test('createRuntimeConfigSnapshot: uses defaults without persisted config', async () => {
  await withEnv(
    {
      MAJSOUL_URL: undefined,
      MAJSOUL_ADVICE_ENABLED: undefined,
      DEEPSEEK_API_KEY: undefined,
      DEEPSEEK_BASE_URL: undefined,
      DEEPSEEK_MODEL: undefined,
      MAJSOUL_ADVICE_TIMEOUT_MS: undefined,
      MAJSOUL_ADVICE_STRATEGY: undefined,
    },
    async () => {
      const snapshot = createRuntimeConfigSnapshot();

      assert.equal(snapshot.majsoulUrl, 'https://game.maj-soul.com/1/');
      assert.deepEqual(snapshot.advice, {
        enabled: true,
        apiKey: '',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4flash',
        timeoutMs: 6000,
        strategy: 'balanced',
      });
      assert.equal(Object.isFrozen(snapshot), true);
      assert.equal(Object.isFrozen(snapshot.advice), true);
    }
  );
});

test('createRuntimeConfigSnapshot: environment overrides persisted config', async () => {
  const persistedConfig = {
    majsoulUrl: 'https://persisted.example/',
    advice: {
      enabled: false,
      apiKey: 'persisted-key',
      baseUrl: 'https://persisted-api.example',
      model: 'persisted-model',
      timeoutMs: 9000,
      strategy: 'persisted-strategy',
    },
  };

  await withEnv(
    {
      MAJSOUL_URL: 'https://env.example/',
      MAJSOUL_ADVICE_ENABLED: '1',
      DEEPSEEK_API_KEY: 'env-key',
      DEEPSEEK_BASE_URL: 'https://env-api.example',
      DEEPSEEK_MODEL: 'env-model',
      MAJSOUL_ADVICE_TIMEOUT_MS: '1200',
      MAJSOUL_ADVICE_STRATEGY: 'env-strategy',
    },
    async () => {
      const snapshot = createRuntimeConfigSnapshot({ persistedConfig });

      assert.equal(snapshot.majsoulUrl, 'https://env.example/');
      assert.deepEqual(snapshot.advice, {
        enabled: true,
        apiKey: 'env-key',
        baseUrl: 'https://env-api.example',
        model: 'env-model',
        timeoutMs: 1200,
        strategy: 'env-strategy',
      });
    }
  );
});

test('createRuntimeConfigSnapshot: remains stable after environment changes', async () => {
  await withEnv(
    {
      MAJSOUL_URL: 'https://first.example/',
    },
    async () => {
      const snapshot = createRuntimeConfigSnapshot();
      process.env.MAJSOUL_URL = 'https://second.example/';

      assert.equal(snapshot.majsoulUrl, 'https://first.example/');
    }
  );
});

test('validateLauncherConfig: rejects invalid fields', () => {
  const result = validateLauncherConfig({
    majsoulUrl: 'not-a-url',
    advice: {
      enabled: 'yes',
      baseUrl: 'ftp://invalid.example',
      model: '   ',
      timeoutMs: 0,
      strategy: '',
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.majsoulUrl, /http/i);
  assert.match(result.errors['advice.enabled'], /boolean/i);
  assert.match(result.errors['advice.baseUrl'], /http/i);
  assert.match(result.errors['advice.model'], /required/i);
  assert.match(result.errors['advice.timeoutMs'], /positive integer/i);
  assert.match(result.errors['advice.strategy'], /required/i);
});

test('writePersistedLauncherConfig/readPersistedLauncherConfig: roundtrip with schema versioned document', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'majsoul-config-'));
  const filePath = path.join(dir, 'launcher-config.json');

  const persisted = {
    majsoulUrl: 'https://persisted.example/',
    advice: {
      enabled: false,
      apiKey: 'persisted-key',
      baseUrl: 'https://persisted-api.example',
      model: 'persisted-model',
      timeoutMs: 9000,
      strategy: 'persisted-strategy',
    },
  };

  await writePersistedLauncherConfig(filePath, persisted);
  const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));

  assert.equal(raw.schemaVersion, 1);
  assert.deepEqual(raw.launcher, persisted);

  const readBack = await readPersistedLauncherConfig(filePath);
  assert.deepEqual(readBack, persisted);
});

test('getLauncherConfigPath: stores launcher config under user data dir', () => {
  assert.equal(
    getLauncherConfigPath({ userDataDir: '/tmp/majsoul-user-data' }),
    path.join('/tmp/majsoul-user-data', 'launcher-config.json')
  );
});

test('getAdviceConfig: still maps snapshot advice config for legacy callers', async () => {
  await withEnv(
    {
      MAJSOUL_ADVICE_ENABLED: '0',
      DEEPSEEK_API_KEY: 'legacy-key',
      DEEPSEEK_BASE_URL: 'https://legacy-api.example',
      DEEPSEEK_MODEL: 'legacy-model',
      MAJSOUL_ADVICE_TIMEOUT_MS: '4321',
      MAJSOUL_ADVICE_STRATEGY: 'legacy-strategy',
    },
    async () => {
      assert.deepEqual(getAdviceConfig(), {
        enabled: false,
        apiKey: 'legacy-key',
        baseUrl: 'https://legacy-api.example',
        model: 'legacy-model',
        timeoutMs: 4321,
        strategy: 'legacy-strategy',
      });
    }
  );
});

test('getAdviceRuntimeState: reports degraded warning when advice is enabled without api key', () => {
  const snapshot = createRuntimeConfigSnapshot({
    persistedConfig: {
      majsoulUrl: 'https://game.maj-soul.com/1/',
      advice: {
        enabled: true,
        apiKey: '',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4flash',
        timeoutMs: 6000,
        strategy: 'balanced',
      },
    },
    env: {},
  });

  assert.deepEqual(getAdviceRuntimeState(snapshot), {
    available: false,
    degraded: true,
    warning: '建议功能未完整配置，已降级为不启用建议',
  });
});
