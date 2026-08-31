/**
 * ohara-live-worker — Realtime del overlay de stream (Cloudflare Worker + Durable Object)
 *
 * ARQUITECTURA
 * ------------
 * - Postgres (Neon) sigue siendo la FUENTE DE VERDAD del estado del overlay.
 *   Este worker NO almacena nada crítico: solo hace el fan-out instantáneo.
 * - Un Durable Object `OverlayRoom` por token de overlay mantiene las conexiones
 *   WebSocket y hace broadcast. Usa la Hibernation API → costo casi cero en reposo.
 * - La MISMA sala puede además mantener una conexión saliente al WebSocket en
 *   la nube de Eulerstream (TikTok LIVE), y reenviar cada evento (chat/gift/
 *   follow/like) a Next.js, que decide qué escena disparar y persiste en
 *   Postgres — este worker nunca inventa estado de overlay por su cuenta.
 *
 * RUTAS
 * -----
 *   GET  /overlay/:token           → upgrade a WebSocket. El cliente (overlay /
 *                                    Live Desk) SOLO ESCUCHA. Al conectar recibe
 *                                    el último estado.
 *   POST /broadcast/:token         → lo llama Next.js (server-to-server) tras
 *                                    persistir en Postgres. Requiere
 *                                    `Authorization: Bearer <LIVE_BROADCAST_SECRET>`.
 *                                    El body es el JSON del estado; se reenvía a todos.
 *   POST /tiktok/:token/connect    → body {username}. Abre la conexión a Eulerstream
 *                                    para ese usuario. Mismo secreto que /broadcast.
 *   POST /tiktok/:token/disconnect → cierra la conexión a Eulerstream.
 *   GET  /tiktok/:token/status     → {connected, username}.
 *   GET  /health                  → healthcheck.
 */

export interface Env {
  OVERLAY_ROOM: DurableObjectNamespace;
  LIVE_BROADCAST_SECRET: string;
  EULERSTREAM_API_KEY: string;
  NEXTJS_TIKTOK_EVENT_URL: string;
  TIKTOK_EVENT_SECRET: string;
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

    const parts = url.pathname.split("/").filter(Boolean);

    // ["overlay"|"broadcast", token]
    if (
      parts.length === 2 &&
      (parts[0] === "overlay" || parts[0] === "broadcast") &&
      parts[1]
    ) {
      return routeToRoom(request, env, parts[1]);
    }

    // ["tiktok", token, "connect"|"disconnect"|"status"]
    if (parts.length === 3 && parts[0] === "tiktok" && parts[1]) {
      return routeToRoom(request, env, parts[1]);
    }

    return new Response("Not found", { status: 404 });
  },
};

type TikTokWebcastMessage = { type?: string; data?: Record<string, unknown> };

/**
 * Una "sala" por token de overlay. Mantiene las conexiones WS y reenvía el
 * estado. Guarda el último estado para entregarlo al conectar (así un overlay
 * recién abierto pinta de inmediato sin esperar el siguiente comando).
 */
export class OverlayRoom {
  private state: DurableObjectState;
  private env: Env;
  private lastState: string | null = null;

  // --- Ingesta de TikTok LIVE (Eulerstream) ---
  private token: string | null = null;
  private tiktokWs: WebSocket | null = null;
  private tiktokUsername: string | null = null;
  private tiktokStopped = true;
  private tiktokReconnectAttempts = 0;
  private tiktokReconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const action = parts[0];

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
      if (!this.isAuthorized(request)) {
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

    // ---- TikTok LIVE ingest (server-to-server, autenticado) ----
    if (action === "tiktok") {
      const token = parts[1];
      const subAction = parts[2];

      if (!this.isAuthorized(request)) {
        return new Response("Unauthorized", { status: 401 });
      }

      if (subAction === "connect") {
        const body = (await request.json().catch(() => ({}))) as {
          username?: string;
        };
        const username = String(body?.username || "").trim();
        if (!username) {
          return new Response("username required", { status: 400 });
        }
        this.token = token;
        await this.connectTikTok(username);
        return new Response(JSON.stringify({ ok: true, username }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (subAction === "disconnect") {
        this.disconnectTikTok();
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (subAction === "status") {
        return new Response(
          JSON.stringify({
            ok: true,
            connected: !!this.tiktokWs,
            username: this.tiktokUsername,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("Not found", { status: 404 });
    }

    return new Response("Not found", { status: 404 });
  }

  private isAuthorized(request: Request): boolean {
    const auth = request.headers.get("Authorization") || "";
    return (
      !!this.env.LIVE_BROADCAST_SECRET &&
      auth === `Bearer ${this.env.LIVE_BROADCAST_SECRET}`
    );
  }

  // --- Handlers de la Hibernation API (clientes del overlay) ---
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

  // ===========================================================================
  // TikTok LIVE ingest (Eulerstream cloud WebSocket)
  // ---------------------------------------------------------------------------
  // Conexión SALIENTE (no usa la Hibernation API — se mantiene mientras el
  // socket esté abierto). Cada evento normalizado se reenvía a Next.js, que es
  // quien decide qué escena disparar y persiste en Postgres (fuente de verdad).
  // Reconexión con backoff simple si se corta; no sobrevive a que el propio DO
  // sea desalojado durante el backoff (caso raro: solo pasa si además no hay
  // ningún cliente de overlay conectado en ese instante).
  // ===========================================================================

  private disconnectTikTok() {
    this.tiktokStopped = true;
    if (this.tiktokReconnectTimer) {
      clearTimeout(this.tiktokReconnectTimer);
      this.tiktokReconnectTimer = null;
    }
    if (this.tiktokWs) {
      try {
        this.tiktokWs.close();
      } catch {
        // ignore
      }
      this.tiktokWs = null;
    }
    this.tiktokUsername = null;
  }

  private scheduleTikTokReconnect() {
    if (this.tiktokStopped || !this.tiktokUsername) return;
    this.tiktokReconnectAttempts += 1;
    const delay = Math.min(
      30000,
      2000 * Math.pow(2, Math.min(this.tiktokReconnectAttempts, 4))
    );
    this.tiktokReconnectTimer = setTimeout(() => {
      if (this.tiktokUsername && !this.tiktokStopped) {
        this.connectTikTok(this.tiktokUsername).catch(() => {
          // el próximo intento lo reprograma scheduleTikTokReconnect
        });
      }
    }, delay);
  }

  private async connectTikTok(username: string) {
    this.tiktokStopped = false;
    this.tiktokUsername = username;
    if (this.tiktokWs) {
      try {
        this.tiktokWs.close();
      } catch {
        // ignore
      }
      this.tiktokWs = null;
    }

    const wsUrl = `https://ws.eulerstream.com?uniqueId=${encodeURIComponent(
      username
    )}&apiKey=${encodeURIComponent(this.env.EULERSTREAM_API_KEY)}`;

    let resp: Response;
    try {
      resp = await fetch(wsUrl, { headers: { Upgrade: "websocket" } });
    } catch {
      this.scheduleTikTokReconnect();
      return;
    }

    const ws = (resp as unknown as { webSocket?: WebSocket }).webSocket;
    if (!ws) {
      this.scheduleTikTokReconnect();
      return;
    }

    ws.accept();
    this.tiktokWs = ws;
    this.tiktokReconnectAttempts = 0;

    ws.addEventListener("message", (evt: MessageEvent) => {
      this.handleTikTokMessage(String(evt.data)).catch(() => {
        // un mensaje mal formado no debe tumbar la conexión
      });
    });

    ws.addEventListener("close", () => {
      if (this.tiktokWs === ws) this.tiktokWs = null;
      this.scheduleTikTokReconnect();
    });

    ws.addEventListener("error", () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    });
  }

  private async handleTikTokMessage(raw: string) {
    let parsed: { messages?: TikTokWebcastMessage[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const messages = Array.isArray(parsed?.messages) ? parsed.messages : [];
    for (const m of messages) {
      const event = this.mapTikTokEvent(m);
      if (event) await this.forwardTikTokEvent(event);
    }
  }

  /** Traduce un mensaje crudo de Eulerstream a un evento normalizado, o null si se ignora. */
  private mapTikTokEvent(
    m: TikTokWebcastMessage
  ): Record<string, unknown> | null {
    const data = m?.data as Record<string, any> | undefined;
    if (!data) return null;

    switch (m.type) {
      case "WebcastChatMessage":
        return {
          type: "chat",
          user: data.user?.uniqueId || "",
          text: data.comment || "",
        };

      case "WebcastLikeMessage":
        return { type: "like", total: Number(data.totalLikeCount) || 0 };

      case "WebcastSocialMessage":
        // action "1" = follow (confirmado empíricamente). Otros valores
        // (share, etc.) se ignoran por ahora.
        if (String(data.action) === "1") {
          return { type: "follow", user: data.user?.uniqueId || "" };
        }
        return null;

      case "WebcastGiftMessage": {
        const repeatCount = Number(data.repeatCount) || 1;
        const repeatEnd = Number(data.repeatEnd);
        // Mientras el combo de un mismo regalo sigue subiendo, esperamos a
        // que termine el streak (repeatEnd === 1) para no spamear alertas.
        if (repeatCount > 1 && repeatEnd !== 1) return null;
        return {
          type: "gift",
          user: data.user?.uniqueId || "",
          giftName: data.gift?.name || "",
          giftId: data.giftId || "",
          repeatCount,
        };
      }

      default:
        return null;
    }
  }

  private async forwardTikTokEvent(event: Record<string, unknown>) {
    if (
      !this.token ||
      !this.env.NEXTJS_TIKTOK_EVENT_URL ||
      !this.env.TIKTOK_EVENT_SECRET
    ) {
      return;
    }
    try {
      await fetch(this.env.NEXTJS_TIKTOK_EVENT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.env.TIKTOK_EVENT_SECRET}`,
        },
        body: JSON.stringify({ token: this.token, ...event }),
      });
    } catch {
      // best-effort; el próximo evento puede llegar bien
    }
  }
}
