const { LiqiParser } = require('../liqi/liqiParser');

function nowIso() {
  return new Date().toISOString();
}

class CdpWebSocketTap {
  constructor({ webContents, db, onLiqiEvent = null }) {
    this.webContents = webContents;
    this.db = db;
    this.onLiqiEvent = onLiqiEvent;
    this.sessionId = null;
    this.parser = null;
    this.attached = false;
    this.boundOnMessage = null;
  }

  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }

  async start() {
    if (this.attached) return;
    this.parser = await LiqiParser.create();
    this.webContents.debugger.attach('1.3');
    await this.webContents.debugger.sendCommand('Network.enable');
    this.boundOnMessage = async (_event, method, params) => {
      if (!this.sessionId) return;
      if (method !== 'Network.webSocketFrameReceived' && method !== 'Network.webSocketFrameSent') return;

      const direction = method === 'Network.webSocketFrameSent' ? 'sent' : 'recv';
      const frame = params?.response ?? params?.frame ?? null;
      if (!frame) return;
      const opcode = frame.opcode ?? 1;
      const url = params?.response?.url ?? params?.url ?? null;
      const capturedAt = nowIso();
      const payloadData = frame.payloadData ?? '';
      const payloadBuf =
        opcode === 2 ? Buffer.from(payloadData, 'base64') : Buffer.from(String(payloadData), 'utf8');
      const payloadBase64 = payloadBuf.toString('base64');

      const frameId = this.db.insertWsFrame({
        sessionId: this.sessionId,
        capturedAt,
        direction,
        url,
        opcode,
        payloadBase64,
      });

      const liqi = this.parser.parseFrame(payloadBuf);
      if (!liqi) return;
      this.db.insertLiqiEvent({
        sessionId: this.sessionId,
        frameId,
        capturedAt,
        msgType: liqi.msgType,
        method: liqi.method,
        step: liqi.step ?? null,
        actionName: liqi.actionName ?? null,
        data: liqi.data ?? null,
      });

      if (typeof this.onLiqiEvent === 'function') {
        try {
          await this.onLiqiEvent({
            sessionId: this.sessionId,
            frameId,
            capturedAt,
            ...liqi,
          });
        } catch {}
      }
    };
    this.webContents.debugger.on('message', this.boundOnMessage);
    this.attached = true;
  }

  async stop() {
    this.sessionId = null;
    if (!this.attached) return;
    if (this.boundOnMessage) this.webContents.debugger.off('message', this.boundOnMessage);
    this.boundOnMessage = null;
    try {
      this.webContents.debugger.detach();
    } catch {}
    this.attached = false;
  }
}

module.exports = {
  CdpWebSocketTap,
};
