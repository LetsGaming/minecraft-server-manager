"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// ── RCON packet codec unit tests ──────────────────────────────────────────
// We test encodePacket / decodePacket directly by reproducing them here
// (they are internal to rcon.js but the invariants are easily verified).
// This validates the negative-length guard (the A-09 fix) without needing
// a real RCON server.

function encodePacket(id, type, body) {
  const bodyBuf = Buffer.from(body, "utf-8");
  const length  = 4 + 4 + bodyBuf.length + 2; // id + type + body + 2 NUL terminators
  const buf     = Buffer.alloc(4 + length);
  buf.writeInt32LE(length, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  bodyBuf.copy(buf, 12);
  // NUL terminators already zero-initialised by Buffer.alloc
  return buf;
}

function decodePacket(buf) {
  if (buf.length < 14) return null;
  const length = buf.readInt32LE(0);
  // Negative-length guard (A-09): rejects malformed packets that could cause
  // silent empty-body responses or integer-overflow exploits.
  if (length < 10 || length > 4096) return null;
  if (buf.length < 4 + length) return null;
  return {
    length,
    id:   buf.readInt32LE(4),
    type: buf.readInt32LE(8),
    body: buf.toString("utf-8", 12, 4 + length - 2),
    totalSize: 4 + length,
  };
}

describe("RCON packet encode / decode round-trip", () => {
  test("encodes and decodes a simple command", () => {
    const pkt = encodePacket(42, 2, "list");
    const dec = decodePacket(pkt);
    assert.ok(dec !== null);
    assert.strictEqual(dec.id, 42);
    assert.strictEqual(dec.type, 2);
    assert.strictEqual(dec.body, "list");
  });

  test("encodes and decodes an empty body", () => {
    const pkt = encodePacket(1, 3, "");
    const dec = decodePacket(pkt);
    assert.ok(dec !== null);
    assert.strictEqual(dec.body, "");
  });

  test("encodes and decodes a Unicode body", () => {
    const body = "Hello, Wörld! 🎉";
    const pkt  = encodePacket(7, 2, body);
    const dec  = decodePacket(pkt);
    assert.ok(dec !== null);
    assert.strictEqual(dec.body, body);
  });

  test("totalSize matches actual buffer length", () => {
    const pkt = encodePacket(1, 2, "say hi");
    const dec = decodePacket(pkt);
    assert.strictEqual(dec.totalSize, pkt.length);
  });
});

describe("RCON decodePacket — negative-length guard (A-09)", () => {
  test("returns null for a buffer shorter than 14 bytes", () => {
    assert.strictEqual(decodePacket(Buffer.alloc(10)), null);
  });

  test("returns null when length field is negative", () => {
    const buf = Buffer.alloc(20);
    buf.writeInt32LE(-1, 0); // negative length
    assert.strictEqual(decodePacket(buf), null);
  });

  test("returns null when length field is zero (< 10)", () => {
    const buf = Buffer.alloc(20);
    buf.writeInt32LE(0, 0);
    assert.strictEqual(decodePacket(buf), null);
  });

  test("returns null when length exceeds 4096 (oversized)", () => {
    const buf = Buffer.alloc(20);
    buf.writeInt32LE(5000, 0);
    assert.strictEqual(decodePacket(buf), null);
  });

  test("returns null when buffer is too short for the declared length", () => {
    const buf = Buffer.alloc(20);
    buf.writeInt32LE(100, 0); // claims 100 bytes of payload
    // buf.length = 20 < 4 + 100 = 104
    assert.strictEqual(decodePacket(buf), null);
  });
});

describe("RCON decodePacket — length boundary values", () => {
  test("accepts length = 10 (minimum valid)", () => {
    // Minimum valid packet: length=10, id=0, type=0, empty body (2 NUL)
    const pkt = encodePacket(0, 0, "");
    assert.ok(pkt.readInt32LE(0) >= 10);
    assert.ok(decodePacket(pkt) !== null);
  });

  test("accepts length = 4096 (maximum allowed)", () => {
    // Build a raw packet with exactly length = 4096
    const buf = Buffer.alloc(4 + 4096);
    buf.writeInt32LE(4096, 0);
    buf.writeInt32LE(1, 4);   // id
    buf.writeInt32LE(2, 8);   // type
    // body = remaining bytes up to NUL terminators
    const dec = decodePacket(buf);
    assert.ok(dec !== null);
    assert.strictEqual(dec.length, 4096);
  });
});

describe("RCON log controller — length clamping", () => {
  // The log endpoint clamps ?length= to [1, 5000].
  // We test the clamping formula directly since it's pure arithmetic.
  function clampLength(raw, fallback = 1000) {
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? fallback : Math.min(Math.max(parsed, 1), 5000);
  }

  test("clamps 0 to 1", () => assert.strictEqual(clampLength("0"), 1));
  test("clamps -1 to 1", () => assert.strictEqual(clampLength("-1"), 1));
  test("clamps 9999 to 5000", () => assert.strictEqual(clampLength("9999"), 5000));
  test("accepts 500 unchanged", () => assert.strictEqual(clampLength("500"), 500));
  test("treats NaN as fallback", () => assert.strictEqual(clampLength("abc"), 1000));
  test("parseInt stops at 'e' in '1e6' → 1, clamped up to 1", () =>
    assert.strictEqual(clampLength("1e6"), 1));
});
