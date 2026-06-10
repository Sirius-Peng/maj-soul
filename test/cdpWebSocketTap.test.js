const test = require('node:test');
const assert = require('node:assert/strict');

const { CdpWebSocketTap } = require('../src/net/cdpWebSocketTap');
const { LiqiParser } = require('../src/liqi/liqiParser');

test('CdpWebSocketTap: ignores liqi parse failures and keeps WS capture alive', async () => {
  const originalCreate = LiqiParser.create;
  const listeners = new Map();
  const frames = [];
  const events = [];
  let onLiqiEventCalls = 0;

  LiqiParser.create = async () => ({
    parseFrame() {
      throw new Error('decode failed');
    },
  });

  const webContents = {
    debugger: {
      attach() {},
      async sendCommand() {},
      on(event, listener) {
        listeners.set(event, listener);
      },
      off(event) {
        listeners.delete(event);
      },
      detach() {},
    },
  };
  const db = {
    insertWsFrame(payload) {
      frames.push(payload);
      return 7;
    },
    insertLiqiEvent(payload) {
      events.push(payload);
      return 8;
    },
  };

  const tap = new CdpWebSocketTap({
    webContents,
    db,
    onLiqiEvent: async () => {
      onLiqiEventCalls += 1;
    },
  });
  tap.setSessionId('session-1');

  try {
    await tap.start();
    const listener = listeners.get('message');
    assert.equal(typeof listener, 'function');

    await listener(null, 'Network.webSocketFrameReceived', {
      response: {
        opcode: 1,
        payloadData: '{"broken":true}',
        url: 'wss://example.invalid/socket',
      },
    });

    assert.equal(frames.length, 1);
    assert.equal(events.length, 0);
    assert.equal(onLiqiEventCalls, 0);
  } finally {
    await tap.stop();
    LiqiParser.create = originalCreate;
  }
});
