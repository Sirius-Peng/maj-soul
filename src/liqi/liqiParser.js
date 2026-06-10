const fs = require('node:fs');
const path = require('node:path');
const protobuf = require('protobufjs');

const { xorCodec, decodeLiqiEnvelope } = require('./liqiCodec');

function loadAssetsPath(...parts) {
  return path.join(__dirname, '..', '..', 'assets', 'liqi_proto', ...parts);
}

function msgTypeOfByte(b) {
  if (b === 1) return 'notify';
  if (b === 2) return 'req';
  if (b === 3) return 'res';
  return 'unknown';
}

class LiqiParser {
  constructor({ root, rpcMap }) {
    this.root = root;
    this.rpcMap = rpcMap;
    this.resType = new Map();
  }

  static async create() {
    const protoPath = loadAssetsPath('liqi.proto');
    const jsonPath = loadAssetsPath('liqi.json');
    const root = await protobuf.load(protoPath);
    const rpcMap = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    return new LiqiParser({ root, rpcMap });
  }

  parseFrame(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 2) return null;
    const typeByte = buf[0];
    const msgType = msgTypeOfByte(typeByte);
    if (msgType === 'unknown') return null;

    if (msgType === 'notify') {
      const { method, data } = decodeLiqiEnvelope(buf.subarray(1));
      if (!method || !data) return null;
      const messageName = method.split('.').pop();
      const Msg = this.root.lookupType(`lq.${messageName}`);
      const decoded = Msg.decode(data);
      const obj = Msg.toObject(decoded, { defaults: true, bytes: String });

      if (messageName === 'ActionPrototype' && typeof obj?.data === 'string' && typeof obj?.name === 'string') {
        const innerBytes = xorCodec(Buffer.from(obj.data, 'base64'));
        let innerObj = null;
        try {
          const Inner = this.root.lookupType(`lq.${obj.name}`);
          const innerDecoded = Inner.decode(innerBytes);
          innerObj = Inner.toObject(innerDecoded, { defaults: true, bytes: String });
        } catch {
          innerObj = { _rawBase64: innerBytes.toString('base64') };
        }

        return {
          msgType,
          method,
          step: obj.step ?? null,
          actionName: obj.name,
          data: innerObj,
        };
      }

      return { msgType, method, data: obj };
    }

    const msgId = buf.readUInt16LE(1);
    const { method, data } = decodeLiqiEnvelope(buf.subarray(3));
    if (!method || !data) return null;

    if (msgType === 'req') {
      const [, lq, service, rpc] = method.split('.');
      const domain = this.rpcMap?.nested?.[lq]?.nested?.[service]?.methods?.[rpc];
      if (!domain) return { msgType, method, msgId, data: null };
      const Req = this.root.lookupType(`lq.${domain.requestType}`);
      const decoded = Req.decode(data);
      const obj = Req.toObject(decoded, { defaults: true, bytes: String });
      this.resType.set(msgId, { method, responseType: domain.responseType });
      return { msgType, method, msgId, data: obj };
    }

    const ctx = this.resType.get(msgId);
    if (!ctx) return { msgType, method, msgId, data: null };
    this.resType.delete(msgId);
    const Res = this.root.lookupType(`lq.${ctx.responseType}`);
    const decoded = Res.decode(data);
    const obj = Res.toObject(decoded, { defaults: true, bytes: String });
    return { msgType, method: ctx.method, msgId, data: obj };
  }
}

module.exports = {
  LiqiParser,
};

