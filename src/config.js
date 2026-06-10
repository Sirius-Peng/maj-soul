const { getLauncherConfigPath, readConfigDocument, writeConfigDocument } = require('./configStore');

const PERSISTED_CONFIG_SCHEMA_VERSION = 1;

function buildDefaultLauncherConfig() {
  return {
    majsoulUrl: 'https://game.maj-soul.com/1/',
    advice: {
      enabled: true,
      apiKey: '',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4flash',
      timeoutMs: 6000,
      strategy: 'balanced',
    },
  };
}

function cloneLauncherConfig(config) {
  return {
    majsoulUrl: config.majsoulUrl,
    advice: {
      enabled: config.advice.enabled,
      apiKey: config.advice.apiKey,
      baseUrl: config.advice.baseUrl,
      model: config.advice.model,
      timeoutMs: config.advice.timeoutMs,
      strategy: config.advice.strategy,
    },
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return value;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeHttpUrl(value) {
  if (typeof value !== 'string') {
    return { ok: false, message: 'must be a string' };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, message: 'is required' };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, message: 'must be a valid http(s) URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, message: 'must be a valid http(s) URL' };
  }

  return { ok: true, value: trimmed };
}

function normalizePositiveInteger(value) {
  const n =
    typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : value;

  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, message: 'must be a positive integer' };
  }

  return { ok: true, value: n };
}

function validateLauncherConfig(input = {}) {
  const value = buildDefaultLauncherConfig();
  const errors = {};

  if (input == null) {
    return { ok: true, value, errors };
  }

  if (!isPlainObject(input)) {
    return {
      ok: false,
      value,
      errors: { config: 'launcher config must be an object' },
    };
  }

  if (Object.hasOwn(input, 'majsoulUrl')) {
    const result = normalizeHttpUrl(input.majsoulUrl);
    if (result.ok) {
      value.majsoulUrl = result.value;
    } else {
      errors.majsoulUrl = `majsoulUrl ${result.message}`;
    }
  }

  if (Object.hasOwn(input, 'advice')) {
    if (!isPlainObject(input.advice)) {
      errors.advice = 'advice must be an object';
    } else {
      const { advice } = input;

      if (Object.hasOwn(advice, 'enabled')) {
        if (typeof advice.enabled === 'boolean') {
          value.advice.enabled = advice.enabled;
        } else {
          errors['advice.enabled'] = 'advice.enabled must be a boolean';
        }
      }

      if (Object.hasOwn(advice, 'apiKey')) {
        if (typeof advice.apiKey === 'string') {
          value.advice.apiKey = advice.apiKey.trim();
        } else {
          errors['advice.apiKey'] = 'advice.apiKey must be a string';
        }
      }

      if (Object.hasOwn(advice, 'baseUrl')) {
        const result = normalizeHttpUrl(advice.baseUrl);
        if (result.ok) {
          value.advice.baseUrl = result.value;
        } else {
          errors['advice.baseUrl'] = `advice.baseUrl ${result.message}`;
        }
      }

      if (Object.hasOwn(advice, 'model')) {
        if (typeof advice.model === 'string' && advice.model.trim()) {
          value.advice.model = advice.model.trim();
        } else {
          errors['advice.model'] = 'advice.model is required';
        }
      }

      if (Object.hasOwn(advice, 'timeoutMs')) {
        const result = normalizePositiveInteger(advice.timeoutMs);
        if (result.ok) {
          value.advice.timeoutMs = result.value;
        } else {
          errors['advice.timeoutMs'] = `advice.timeoutMs ${result.message}`;
        }
      }

      if (Object.hasOwn(advice, 'strategy')) {
        if (typeof advice.strategy === 'string' && advice.strategy.trim()) {
          value.advice.strategy = advice.strategy.trim();
        } else {
          errors['advice.strategy'] = 'advice.strategy is required';
        }
      }
    }
  }

  return {
    ok: Object.keys(errors).length === 0,
    value,
    errors,
  };
}

function parseEnvBoolean(value) {
  if (value === undefined) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') {
    return true;
  }
  if (normalized === '0' || normalized === 'false') {
    return false;
  }
  return null;
}

function applyEnvOverrides(config, env = process.env) {
  const value = cloneLauncherConfig(config);

  if (env.MAJSOUL_URL !== undefined) {
    const result = normalizeHttpUrl(String(env.MAJSOUL_URL));
    if (result.ok) {
      value.majsoulUrl = result.value;
    }
  }

  const adviceEnabled = parseEnvBoolean(env.MAJSOUL_ADVICE_ENABLED);
  if (adviceEnabled !== null) {
    value.advice.enabled = adviceEnabled;
  }

  if (env.DEEPSEEK_API_KEY !== undefined) {
    value.advice.apiKey = String(env.DEEPSEEK_API_KEY).trim();
  }

  if (env.DEEPSEEK_BASE_URL !== undefined) {
    const result = normalizeHttpUrl(String(env.DEEPSEEK_BASE_URL));
    if (result.ok) {
      value.advice.baseUrl = result.value;
    }
  }

  if (env.DEEPSEEK_MODEL !== undefined) {
    const model = String(env.DEEPSEEK_MODEL).trim();
    if (model) {
      value.advice.model = model;
    }
  }

  if (env.MAJSOUL_ADVICE_TIMEOUT_MS !== undefined) {
    const result = normalizePositiveInteger(env.MAJSOUL_ADVICE_TIMEOUT_MS);
    if (result.ok) {
      value.advice.timeoutMs = result.value;
    }
  }

  if (env.MAJSOUL_ADVICE_STRATEGY !== undefined) {
    const strategy = String(env.MAJSOUL_ADVICE_STRATEGY).trim();
    if (strategy) {
      value.advice.strategy = strategy;
    }
  }

  return value;
}

function createRuntimeConfigSnapshot({ persistedConfig, env = process.env } = {}) {
  const validatedPersisted = validateLauncherConfig(persistedConfig).value;
  const snapshot = applyEnvOverrides(validatedPersisted, env);
  return deepFreeze(snapshot);
}

function getMajsoulUrl(options = {}) {
  return createRuntimeConfigSnapshot(options).majsoulUrl;
}

function getMainWindowOptions() {
  return {
    width: 1280,
    height: 720,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  };
}

function getAdviceConfig(options = {}) {
  return createRuntimeConfigSnapshot(options).advice;
}

function getAdviceRuntimeState(configSnapshot = createRuntimeConfigSnapshot()) {
  const advice = {
    ...buildDefaultLauncherConfig().advice,
    ...(configSnapshot?.advice ?? {}),
  };

  if (!advice.enabled) {
    return {
      available: false,
      degraded: false,
      warning: null,
    };
  }

  if (!advice.apiKey) {
    return {
      available: false,
      degraded: true,
      warning: '建议功能未完整配置，已降级为不启用建议',
    };
  }

  return {
    available: true,
    degraded: false,
    warning: null,
  };
}

async function readPersistedLauncherConfig(filePath) {
  const doc = await readConfigDocument(filePath);
  if (!doc || !isPlainObject(doc)) {
    return buildDefaultLauncherConfig();
  }

  const source = isPlainObject(doc.launcher) ? doc.launcher : {};
  return validateLauncherConfig(source).value;
}

async function writePersistedLauncherConfig(filePath, config) {
  const result = validateLauncherConfig(config);
  if (!result.ok) {
    const detail = Object.entries(result.errors)
      .map(([field, message]) => `${field}: ${message}`)
      .join('; ');
    throw new Error(`invalid launcher config: ${detail}`);
  }

  await writeConfigDocument(filePath, {
    schemaVersion: PERSISTED_CONFIG_SCHEMA_VERSION,
    launcher: result.value,
  });

  return cloneLauncherConfig(result.value);
}

module.exports = {
  createRuntimeConfigSnapshot,
  getAdviceRuntimeState,
  getAdviceConfig,
  getLauncherConfigPath,
  getMajsoulUrl,
  getMainWindowOptions,
  readPersistedLauncherConfig,
  validateLauncherConfig,
  writePersistedLauncherConfig,
};
