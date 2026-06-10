const test = require('node:test');
const assert = require('node:assert/strict');
const protobuf = require('protobufjs');
const path = require('node:path');

const { xorCodec } = require('../src/liqi/liqiCodec');
const { LiqiParser } = require('../src/liqi/liqiParser');

function encodeVarint(n) {
  const out = [];
  let v = n >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
  return Buffer.from(out);
}

function encodeEnvelope(method, data) {
  const m = Buffer.from(method, 'utf8');
  const parts = [];
  parts.push(encodeVarint((1 << 3) | 2));
  parts.push(encodeVarint(m.length));
  parts.push(m);
  parts.push(encodeVarint((2 << 3) | 2));
  parts.push(encodeVarint(data.length));
  parts.push(data);
  return Buffer.concat(parts);
}

test('LiqiParser: parses notify ActionPrototype and decodes inner action', async () => {
  const protoPath = path.join(__dirname, '..', 'assets', 'liqi_proto', 'liqi.proto');
  const root = await protobuf.load(protoPath);

  const ActionMJStart = root.lookupType('lq.ActionMJStart');
  const actionBytes = ActionMJStart.encode(ActionMJStart.create({})).finish();
  const encryptedBytes = xorCodec(Buffer.from(actionBytes));

  const ActionPrototype = root.lookupType('lq.ActionPrototype');
  const apBytes = ActionPrototype.encode(
    ActionPrototype.create({
      step: 1,
      name: 'ActionMJStart',
      data: encryptedBytes,
    }),
  ).finish();

  const frame = Buffer.concat([
    Buffer.from([1]),
    encodeEnvelope('.lq.ActionPrototype', Buffer.from(apBytes)),
  ]);

  const parser = await LiqiParser.create();
  const msg = parser.parseFrame(frame);
  assert.equal(msg.msgType, 'notify');
  assert.equal(msg.method, '.lq.ActionPrototype');
  assert.equal(msg.step, 1);
  assert.equal(msg.actionName, 'ActionMJStart');
  assert.ok(msg.data && typeof msg.data === 'object');
});

