const { createAdviceClient } = require('../advice/deepseekClient');
const { createAdviceCoordinator } = require('../advice/adviceCoordinator');
const { getAdviceRuntimeState } = require('../config');
const { createOverlayWindow } = require('../overlay/overlayWindow');

function bindOverlayUpdate(overlay) {
  return (payload) => {
    if (!overlay || !payload) {
      return;
    }

    if (payload.type === 'loading') {
      overlay.showLoading({ turnId: payload.turnId });
      return;
    }

    if (payload.type === 'ready') {
      overlay.showReady({
        turnId: payload.turnId,
        result: payload.result,
        latencyMs: payload.result?.latencyMs ?? null,
      });
      return;
    }

    overlay.showError({
      turnId: payload.turnId,
      error: payload.error,
    });
  };
}

function createAdviceRuntime({
  configSnapshot,
  createAdviceClientImpl = createAdviceClient,
  createAdviceCoordinatorImpl = createAdviceCoordinator,
  createOverlayWindowImpl = createOverlayWindow,
} = {}) {
  const runtimeState = getAdviceRuntimeState(configSnapshot);
  if (!runtimeState.available) {
    return {
      warning: runtimeState.warning,
      overlay: null,
      services: null,
    };
  }

  const overlay = createOverlayWindowImpl({ configSnapshot });
  const client = createAdviceClientImpl(configSnapshot.advice);
  const coordinator = createAdviceCoordinatorImpl({
    client,
    onUpdate: bindOverlayUpdate(overlay),
  });

  return {
    warning: null,
    overlay,
    services: { coordinator },
  };
}

module.exports = {
  createAdviceRuntime,
};
