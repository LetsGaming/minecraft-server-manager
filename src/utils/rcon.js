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

function sendRconCommand(command, timeoutMs = 5000) {
  const { RCON_HOST, RCON_PORT, RCON_PASSWORD } = config;
  
  return new Promise((resolve, reject) => {
    if (!RCON_PASSWORD) {
      return reject(new Error("RCON password not configured"));
    }

    const client = new net.Socket();
    let buf = Buffer.alloc(0);
    let authenticated = false;
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      client.destroy();
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error("RCON timeout"));
    }, timeoutMs);

    client.connect(RCON_PORT, RCON_HOST, () => {
      client.write(encodePacket(1, PACKET_TYPE.AUTH, RCON_PASSWORD));
    });

    client.on("data", (data) => {
      buf = Buffer.concat([buf, data]);
      while (true) {
        const packet = decodePacket(buf);
        if (!packet) break;
        buf = buf.slice(packet.totalSize);

        if (!authenticated) {
          if (packet.id === -1) { cleanup(); reject(new Error("RCON auth failed")); return; }
          if (packet.id === 1) { authenticated = true; client.write(encodePacket(2, PACKET_TYPE.COMMAND, command)); }
        } else if (packet.id === 2) {
          cleanup();
          resolve(packet.body);
        }
      }
    });

    client.on("error", (err) => { cleanup(); reject(err); });
  });
}

function isRconAvailable() {
  return config.USE_RCON && !!config.RCON_PASSWORD;
}

module.exports = { sendRconCommand, isRconAvailable };
