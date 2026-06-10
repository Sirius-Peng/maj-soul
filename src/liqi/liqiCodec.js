const keys = [0x84, 0x5e, 0x4e, 0x42, 0x39, 0xa2, 0x1f, 0x60, 0x1c];

function xorCodec(buf) {
  const out = Buffer.from(buf);
  for (let i = 0; i < out.length; i += 1) {
    const u = ((23 ^ out.length) + 5 * i + keys[i % keys.length]) & 255;
    out[i] ^= u;
  }
  return out;
}

function decodeLiqiEnvelope(payload) {
  let offset = 0;
  let method = null;
  let data = null;

  function readVarint() {
    let result = 0;
    let shift = 0;
    while (offset < payload.length) {
      const b = payload[offset++];
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return result >>> 0;
      shift += 7;
    }
    return null;
  }

  function readBytes(len) {
    const end = offset + len;
    if (end > payload.length) return null;
    const b = payload.subarray(offset, end);
    offset = end;
    return b;
  }

  while (offset < payload.length) {
    const tag = readVarint();
    if (tag == null) break;
    const field = tag >>> 3;
    const wire = tag & 7;
    if (wire !== 2) return { method: null, data: null };
    const len = readVarint();
    if (len == null) return { method: null, data: null };
    const bytes = readBytes(len);
    if (!bytes) return { method: null, data: null };
    if (field === 1) method = bytes.toString('utf8');
    if (field === 2) data = Buffer.from(bytes);
  }

  return { method, data };
}

module.exports = {
  xorCodec,
  decodeLiqiEnvelope,
};

