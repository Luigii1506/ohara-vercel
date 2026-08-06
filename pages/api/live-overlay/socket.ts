import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as NetServer } from "node:http";
import type { Socket } from "node:net";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { getLiveOverlayState, subscribeToLiveOverlay } from "@/lib/live-overlay/store";
import { isLiveOverlayTokenValid } from "@/lib/live-overlay/token";
import type { LiveOverlayMessage } from "@/lib/live-overlay/types";

type LiveOverlaySocketServer = NetServer & {
  liveOverlayWss?: WebSocketServer;
  liveOverlayUpgradeBound?: boolean;
};

type NextApiResponseWithSocket = NextApiResponse & {
  socket: Socket & {
    server: LiveOverlaySocketServer;
  };
};

const SOCKET_PATH = "/api/live-overlay/socket";

const sendJson = (ws: WebSocket, message: LiveOverlayMessage) => {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(message));
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(
  request: NextApiRequest,
  response: NextApiResponseWithSocket
) {
  const server = response.socket.server;

  if (!server.liveOverlayWss) {
    const wss = new WebSocketServer({ noServer: true });

    wss.on("connection", (ws: WebSocket, req: NextApiRequest) => {
      const url = new URL(req.url ?? SOCKET_PATH, `http://${req.headers.host}`);
      const token = url.searchParams.get("token");

      if (!token || !isLiveOverlayTokenValid(token)) {
        ws.close(1008, "Invalid token");
        return;
      }

      sendJson(ws, {
        type: "connected",
        state: getLiveOverlayState(token),
      });

      const unsubscribe = subscribeToLiveOverlay(token, (state) => {
        sendJson(ws, { type: "state", state });
      });

      ws.on("close", unsubscribe);
      ws.on("message", (_data: RawData) => {
        // Read-only channel for the MVP.
      });

      ws.on("error", (error: Error) => {
        console.error("[live-overlay] websocket error:", error);
      });
    });

    server.liveOverlayWss = wss;
  }

  if (!server.liveOverlayUpgradeBound) {
    server.on("upgrade", (req, socket, head) => {
      const host = req.headers.host ?? "localhost";
      const url = new URL(req.url ?? SOCKET_PATH, `http://${host}`);

      if (url.pathname !== SOCKET_PATH) {
        return;
      }

      const token = url.searchParams.get("token");
      if (!token || !isLiveOverlayTokenValid(token)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      server.liveOverlayWss?.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        server.liveOverlayWss?.emit("connection", ws, req);
      });
    });

    server.liveOverlayUpgradeBound = true;
  }

  response.status(200).json({ ok: true, path: SOCKET_PATH });
}
