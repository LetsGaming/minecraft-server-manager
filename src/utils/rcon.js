const net = require("net");
const config = require("../config");

const PACKET_TYPE = { AUTH: 3, AUTH_RESPONSE: 2, COMMAND: 2 };

function encodePacket(id, type, body) {
  const bodyBuf = Buffer.from(body, "utf-8");
  const length = 4 + 4 + bodyBuf.length + 2;
  const buf = Buffer.alloc(4 + length);
  buf.writeInt32LE(length, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  bodyBuf.copy(buf, 12);
  buf[12 + bodyBuf.length] = 0;
  buf[13 + bodyBuf.length] = 0;
  return buf;
}

function decodePacket(buf) {
  if (buf.length < 14) return null;
  const length = buf.readInt32LE(0);
  if (buf.length < 4 + length) return null;
  return {
    length,
    id: buf.readInt32LE(4),
    type: buf.readInt32LE(8),
    body: buf.toString("utf-8", 12, 4 + length - 2),
    totalSize: 4 + length,
  };
}

// ── Persistent RCON connection ──
// Keeps a single TCP connection alive instead of opening one per command.
// Reconnects automatically when the connection drops.

let _client = null;
let _authenticated = false;
let _connecting = false;
let _commandId = 10;
let _pendingCallbacks = new Map(); // id -> { resolve, reject, timer }
let _dataBuf = Buffer.alloc(0);
let _authResolve = null;
let _authReject = null;

function _cleanup() {
  _authenticated = false;
  _connecting = false;
  if (_client) {
    _client.removeAllListeners();
    _client.destroy();
    _client = null;
  }
  // Reject all pending commands
  for (const [, cb] of _pendingCallbacks) {
    clearTimeout(cb.timer);
    cb.reject(new Error("RCON connection lost"));
  }
  _pendingCallbacks.clear();
  _dataBuf = Buffer.alloc(0);
  if (_authReject) {
    _authReject(new Error("RCON connection lost during auth"));
    _authResolve = null;
    _authReject = null;
  }
}

function _connect() {
  return new Promise((resolve, reject) => {
    if (_authenticated && _client && !_client.destroyed) {
      return resolve();
    }

    if (_connecting) {
      // Wait for the in-progress connection
      const wait = setInterval(() => {
        if (_authenticated) { clearInterval(wait); resolve(); }
        if (!_connecting) { clearInterval(wait); reject(new Error("RCON connection failed")); }
      }, 50);
      return;
    }

    _cleanup();
    _connecting = true;
    _authResolve = resolve;
    _authReject = reject;

    const { RCON_HOST, RCON_PORT, RCON_PASSWORD } = config;

    _client = new net.Socket();
    _client.setKeepAlive(true, 30000);

    const authTimer = setTimeout(() => {
      _cleanup();
      reject(new Error("RCON auth timeout"));
    }, 10000);

    _client.connect(RCON_PORT, RCON_HOST, () => {
      _client.write(encodePacket(1, PACKET_TYPE.AUTH, RCON_PASSWORD));
    });

    _client.on("data", (data) => {
      _dataBuf = Buffer.concat([_dataBuf, data]);

      while (true) {
        const packet = decodePacket(_dataBuf);
        if (!packet) break;
        _dataBuf = _dataBuf.slice(packet.totalSize);

        // Auth response
        if (!_authenticated) {
          clearTimeout(authTimer);
          if (packet.id === -1) {
            _connecting = false;
            _cleanup();
            reject(new Error("RCON auth failed — wrong password"));
            return;
          }
          if (packet.id === 1 && packet.type === PACKET_TYPE.AUTH_RESPONSE) {
            _authenticated = true;
            _connecting = false;
            if (_authResolve) { _authResolve(); _authResolve = null; _authReject = null; }
          }
          continue;
        }

        // Command response
        const cb = _pendingCallbacks.get(packet.id);
        if (cb) {
          clearTimeout(cb.timer);
          _pendingCallbacks.delete(packet.id);
          cb.resolve(packet.body);
        }
      }
    });

    _client.on("error", () => _cleanup());
    _client.on("close", () => _cleanup());
  });
}

async function sendRconCommand(command, timeoutMs = 5000) {
  if (!config.RCON_PASSWORD) {
    throw new Error("RCON password not configured");
  }

  await _connect();

  const id = _commandId++;
  if (_commandId > 2000000000) _commandId = 10; // Prevent overflow

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      _pendingCallbacks.delete(id);
      reject(new Error("RCON command timeout"));
    }, timeoutMs);

    _pendingCallbacks.set(id, { resolve, reject, timer });
    _client.write(encodePacket(id, PACKET_TYPE.COMMAND, command));
  });
}

function isRconAvailable() {
  return config.USE_RCON && !!config.RCON_PASSWORD;
}

module.exports = { sendRconCommand, isRconAvailable };
