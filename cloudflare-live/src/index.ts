/**
 * ohara-live-worker — Realtime del overlay de stream (Cloudflare Worker + Durable Object)
 *
 * ARQUITECTURA
 * ------------
 * - Postgres (Neon) sigue siendo la FUENTE DE VERDAD del estado del overlay.
 *   Este worker NO almacena nada crítico: solo hace el fan-out instantáneo.
 * - Un Durable Object `OverlayRoom` por token de overlay mantiene las conexiones
 *   WebSocket y hace broadcast. Usa la Hibernation API → costo casi cero en reposo.
 *
 * RUTAS
 * -----
 *   GET  /overlay/:token    → upgrade a WebSocket. El cliente (overlay / Live Desk)
 *                             SOLO ESCUCHA. Al conectar recibe el último estado.
 *   POST /broadcast/:token  → lo llama Next.js (server-to-server) tras persistir en
 *                             Postgres. Requiere `Authorization: Bearer <SECRET>`.
 *                             El body es el JSON del estado; se reenvía a todos.
 *   GET  /health            → healthcheck.
 */

export interface Env {
  OVERLAY_ROOM: DurableObjectNamespace;
  LIVE_BROADCAST_SECRET: string;
}

const routeToRoom = (
  request: Request,
  env: Env,
  token: string
): Promise<Response> => {
  const id = env.OVERLAY_ROOM.idFromName(token);
  const stub = env.OVERLAY_ROOM.get(id);
  return stub.fetch(request);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    const parts = url.pathname.split("/").filter(Boolean); // ["overlay", token]
    if (
      parts.length === 2 &&
      (parts[0] === "overlay" || parts[0] === "broadcast") &&
      parts[1]
    ) {
      return routeToRoom(request, env, parts[1]);
    }

    return new Response("Not found", { status: 404 });
  },
};

/**
 * Una "sala" por token de overlay. Mantiene las conexiones WS y reenvía el
 * estado. Guarda el último estado para entregarlo al conectar (así un overlay
 * recién abierto pinta de inmediato sin esperar el siguiente comando).
 */
export class OverlayRoom {
  private state: DurableObjectState;
  private env: Env;
  private lastState: string | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.split("/").filter(Boolean)[0];

    // ---- Suscripción WebSocket (read-only) ----
    if (action === "overlay") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 426 });
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      // Hibernation API: el runtime puede hibernar el DO sin cerrar el socket.
      this.state.acceptWebSocket(server);

      if (this.lastState === null) {
        const stored = await this.state.storage.get<string>("lastState");
        if (stored) this.lastState = stored;
      }
      if (this.lastState) {
        try {
          server.send(this.lastState);
        } catch {
          // ignore
        }
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    // ---- Broadcast (server-to-server, autenticado) ----
    if (action === "broadcast") {
      const auth = request.headers.get("Authorization") || "";
      if (
        !this.env.LIVE_BROADCAST_SECRET ||
        auth !== `Bearer ${this.env.LIVE_BROADCAST_SECRET}`
      ) {
        return new Response("Unauthorized", { status: 401 });
      }

      const body = await request.text();
      this.lastState = body;
      await this.state.storage.put("lastState", body);

      const sockets = this.state.getWebSockets();
      let delivered = 0;
      for (const ws of sockets) {
        try {
          ws.send(body);
          delivered += 1;
        } catch {
          // socket muerto; el runtime lo limpiará
        }
      }

      return new Response(JSON.stringify({ ok: true, clients: delivered }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  }

  // --- Handlers de la Hibernation API ---
  // Los clientes son suscriptores read-only; solo respondemos a un "ping" para
  // keep-alive. Cualquier otro mensaje se ignora.
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (message === "ping") {
      try {
        ws.send("pong");
      } catch {
        // ignore
      }
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    _reason: string,
    _wasClean: boolean
  ) {
    try {
      ws.close(code >= 1000 && code < 5000 ? code : 1000, "closing");
    } catch {
      // ignore
    }
  }

  async webSocketError(_ws: WebSocket, _error: unknown) {
    // ignore; el runtime limpia el socket
  }
}
