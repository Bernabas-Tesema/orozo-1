/**
 * WebSocket signaling for ORZO interpretation WebRTC call rooms.
 *
 * Mirrors the Eliotel language-school signaling-server protocol so the same
 * mesh / data-plane patterns can be used alongside LiveKit SFU media.
 *
 * Protocol:
 *   - Clients connect to:  /ws/call/<roomId>/
 *   - First message should be join with peerId
 *   - Point-to-point: offer | answer | candidate include { from, to }
 *   - Broadcast (no to): join | here | chat | media-state | session-ended | handoff
 *   - On disconnect: { type: "peer-left", peerId }
 *
 * Room ids should match Orzo portal rooms, e.g. orzo-REQ-2026-ABC123
 * (see frontend/src/shared/callRoom.ts and backend portal_dispatch.resolve_call_room).
 *
 * In-memory rooms only — fine for interpretation call size (up to MAX_PER_ROOM).
 */

"use strict";

const http = require("http");
const { WebSocketServer } = require("ws");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3001;
const MAX_PER_ROOM = Number(process.env.MAX_PER_ROOM) || 8;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** @type {Map<string, Set<import("ws").WebSocket>>} */
const rooms = new Map();

// Allow word chars, dots, and hyphens (orzo-<requestReference> rooms).
const ROOM_PATH = /^\/ws\/call\/([\w.-]+)\/?$/;

function roomOf(ws) {
  return ws.roomId || null;
}

function addToRoom(roomId, ws) {
  let set = rooms.get(roomId);
  if (!set) {
    set = new Set();
    rooms.set(roomId, set);
  }
  set.add(ws);
  ws.roomId = roomId;
}

function removeFromRoom(ws) {
  const roomId = roomOf(ws);
  if (!roomId) return;
  const set = rooms.get(roomId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) rooms.delete(roomId);
}

function findPeer(roomId, peerId) {
  const set = rooms.get(roomId);
  if (!set || !peerId) return null;
  for (const peer of set) {
    if (peer.peerId === peerId && peer.readyState === 1) return peer;
  }
  return null;
}

function roomRoster(roomId, exceptWs) {
  const set = rooms.get(roomId);
  if (!set) return [];
  const list = [];
  for (const peer of set) {
    if (peer === exceptWs || peer.readyState !== 1 || !peer.peerId) continue;
    list.push({
      peerId: peer.peerId,
      name: peer.displayName || "Peer",
      role: peer.role || "client",
    });
  }
  return list;
}

function relay(sender, text) {
  const roomId = roomOf(sender);
  if (!roomId) return;
  const set = rooms.get(roomId);
  if (!set) return;
  for (const peer of set) {
    if (peer !== sender && peer.readyState === 1) {
      try {
        peer.send(text);
      } catch (err) {
        console.warn("relay send failed:", err.message);
      }
    }
  }
}

function sendTo(roomId, peerId, text) {
  const peer = findPeer(roomId, peerId);
  if (!peer) return false;
  try {
    peer.send(text);
    return true;
  } catch (err) {
    console.warn("direct send failed:", err.message);
    return false;
  }
}

function notifyPeerLeft(ws) {
  if (!ws.peerId) {
    relay(ws, JSON.stringify({ type: "peer-left" }));
    return;
  }
  relay(
    ws,
    JSON.stringify({
      type: "peer-left",
      peerId: ws.peerId,
      name: ws.displayName || null,
      role: ws.role || null,
    })
  );
}

function originAllowed(origin) {
  if (ALLOWED_ORIGINS.length === 0) return true;
  if (!origin) return true;
  const o = String(origin).trim().replace(/\/$/, "");
  return ALLOWED_ORIGINS.some((allowed) => {
    const a = String(allowed).trim().replace(/\/$/, "");
    if (!a || a === "*") return true;
    if (a === o) return true;
    if (a === o.replace(/^https?:\/\//, "")) return true;
    if (`https://${a}` === o || `http://${a}` === o) return true;
    return false;
  });
}

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "orzo-signaling",
        mode: "interpretation-mesh",
        maxPerRoom: MAX_PER_ROOM,
        rooms: rooms.size,
        uptime: Math.floor(process.uptime()),
        originsRestricted: ALLOWED_ORIGINS.length > 0,
        originsCount: ALLOWED_ORIGINS.length,
      })
    );
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found. WebSocket endpoint: /ws/call/<roomId>/");
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const origin = req.headers.origin || "";
  if (!originAllowed(origin)) {
    console.warn(
      `WS rejected origin=${origin || "(none)"} allowed=${ALLOWED_ORIGINS.join(",") || "*"}`
    );
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  let pathname = "/";
  try {
    pathname = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname;
  } catch {
    socket.destroy();
    return;
  }

  const match = ROOM_PATH.exec(pathname);
  if (!match) {
    console.warn(`WS rejected path=${pathname}`);
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }

  const roomId = match[1];
  const existing = rooms.get(roomId);
  if (existing && existing.size >= MAX_PER_ROOM) {
    socket.write("HTTP/1.1 503 Room Full\r\n\r\n");
    socket.destroy();
    console.log(`room full (${roomId}), rejected new connection`);
    return;
  }

  console.log(`WS upgrade ok origin=${origin || "(none)"} room=${roomId}`);
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req, roomId);
  });
});

wss.on("connection", (ws, _req, roomId) => {
  addToRoom(roomId, ws);
  ws.peerId = null;
  ws.displayName = null;
  ws.role = null;
  console.log(`socket room=${roomId} peers=${rooms.get(roomId)?.size || 0}`);

  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (data, isBinary) => {
    if (isBinary) return;
    const text = typeof data === "string" ? data : data.toString("utf8");
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      console.warn(`malformed JSON from room=${roomId}`);
      return;
    }
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "ping") {
      try {
        ws.send(JSON.stringify({ type: "pong" }));
      } catch (_) {
        /* ignore */
      }
      return;
    }

    if (msg.type === "join") {
      const peerId = String(msg.peerId || msg.peer_id || "").trim();
      if (!peerId) {
        console.warn(`join without peerId room=${roomId}`);
        return;
      }
      // Replace duplicate peerId (same user refreshed).
      const set = rooms.get(roomId);
      if (set) {
        for (const other of [...set]) {
          if (other !== ws && other.peerId === peerId) {
            try {
              other.close();
            } catch (_) {
              /* ignore */
            }
            set.delete(other);
          }
        }
      }
      ws.peerId = peerId;
      ws.displayName = String(msg.name || "Peer");
      // Orzo roles: client | interpreter | supervisor | platform_admin | host
      ws.role = String(msg.role || "client");
      console.log(
        `joined room=${roomId} peer=${peerId} role=${ws.role} peers=${rooms.get(roomId)?.size || 0}`
      );

      try {
        ws.send(
          JSON.stringify({
            type: "roster",
            peers: roomRoster(roomId, ws),
            roomId,
          })
        );
      } catch (_) {
        /* ignore */
      }

      relay(
        ws,
        JSON.stringify({
          type: "join",
          peerId,
          name: ws.displayName,
          role: ws.role,
          micOn: msg.micOn !== false,
          cameraOn: msg.cameraOn !== false,
        })
      );
      return;
    }

    // Direct signaling (offer/answer/candidate) — must target one peer.
    const to = msg.to || msg.toPeerId || msg.to_peer_id;
    if (to) {
      if (!msg.from && ws.peerId) {
        msg.from = ws.peerId;
        const patched = JSON.stringify(msg);
        sendTo(roomId, String(to), patched);
        return;
      }
      sendTo(roomId, String(to), text);
      return;
    }

    // Host / interpreter ends call — broadcast first, then drop other sockets.
    if (msg.type === "session-ended") {
      relay(ws, text);
      const set = rooms.get(roomId);
      if (set) {
        setTimeout(() => {
          for (const peer of [...set]) {
            if (peer === ws) continue;
            try {
              peer.close();
            } catch (_) {
              /* ignore */
            }
          }
        }, 250);
      }
      return;
    }

    // Broadcast everything else to the room.
    if (ws.peerId && !msg.peerId && (msg.type === "here" || msg.type === "media-state")) {
      msg.peerId = ws.peerId;
      relay(ws, JSON.stringify(msg));
      return;
    }
    relay(ws, text);
  });

  ws.on("close", () => {
    notifyPeerLeft(ws);
    removeFromRoom(ws);
    console.log(`left room=${roomId} peer=${ws.peerId || "?"} peers=${rooms.get(roomId)?.size || 0}`);
  });

  ws.on("error", (err) => {
    console.warn(`socket error room=${roomId}:`, err.message);
  });
});

const heartbeat = setInterval(() => {
  for (const set of rooms.values()) {
    for (const ws of set) {
      if (ws.isAlive === false) {
        try {
          ws.terminate();
        } catch (_) {
          /* ignore */
        }
        continue;
      }
      ws.isAlive = false;
      try {
        if (ws.readyState === 1) ws.ping();
      } catch (_) {
        /* ignore */
      }
    }
  }
}, 25000);

server.on("close", () => clearInterval(heartbeat));

server.listen(PORT, "0.0.0.0", () => {
  console.log(`orzo signaling listening on 0.0.0.0:${PORT}`);
  console.log(`WebSocket path: /ws/call/<roomId>/ (interpretation mesh, max ${MAX_PER_ROOM})`);
  if (ALLOWED_ORIGINS.length) {
    console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  } else {
    console.log("Allowed origins: * (set ALLOWED_ORIGINS to restrict)");
  }
});
