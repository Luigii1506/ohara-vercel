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
  private static readonly TIKTOK_HEALTH_CHECK_MS = 20000; // chequeo de rutina cuando todo anda bien
  private static readonly TIKTOK_STALE_MS = 45000; // sin mensajes en esto = asumir socket zombie

  private state: DurableObjectState;
  private env: Env;
  private lastState: string | null = null;

  // --- Ingesta de TikTok LIVE (Eulerstream) ---
  private token: string | null = null;
  private tiktokWs: WebSocket | null = null;
  private tiktokUsername: string | null = null;
  private tiktokStopped = true;
  private tiktokReconnectAttempts = 0;
  private giftCatalog: Map<number, { name: string; diamondCount: number }> | null = null;
  // Cola de reenvío a Next.js: procesa un evento a la vez, EN ORDEN, aunque
  // lleguen varias tandas de mensajes casi juntas. Evita que dos escrituras
  // concurrentes a la misma fila de Postgres (leer→sumar→guardar) se pisen
  // entre sí y se pierda una suma — sin bloquear la lectura del socket.
  private tiktokForwardQueue: Promise<void> = Promise.resolve();
  // --- Salud de la conexión (diagnóstico) ---
  private tiktokConnectedAt: number | null = null;
  private tiktokLastMessageAt: number | null = null;
  private tiktokReconnectCount = 0;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    // Si Cloudflare recicla este Durable Object (poco frecuente pero pasa),
    // los campos en memoria (tiktokUsername, token, etc.) se pierden — pero
    // el Alarm que programamos SÍ sobrevive y va a disparar `alarm()` en la
    // instancia nueva. Sin esto, esa instancia nueva no sabría a quién debía
    // estar reconectándose. blockConcurrencyWhile pausa cualquier fetch()
    // entrante hasta que termine de restaurar el estado.
    this.state.blockConcurrencyWhile(async () => {
      const [savedToken, savedUsername] = await Promise.all([
        this.state.storage.get<string>("tiktokToken"),
        this.state.storage.get<string>("tiktokUsername"),
      ]);
      if (savedToken) this.token = savedToken;
      if (savedUsername) {
        this.tiktokUsername = savedUsername;
        this.tiktokStopped = false;
      }
    });
  }

  /**
   * Disparado por Cloudflare cuando llega la hora del Alarm programado (ver
   * scheduleTikTokReconnect / connectTikTok). A diferencia de setTimeout/
   * setInterval, esto se garantiza que corre aunque el Durable Object haya
   * sido reciclado en el medio — es el único mecanismo que realmente
   * sobrevive, así que TODA la lógica de reconexión pasa por acá.
   */
  async alarm() {
    if (this.tiktokStopped || !this.tiktokUsername) return;

    const isMissing = !this.tiktokWs;
    const isStale =
      !!this.tiktokLastMessageAt &&
      Date.now() - this.tiktokLastMessageAt > OverlayRoom.TIKTOK_STALE_MS;

    if (isMissing || isStale) {
      console.error("[tiktok] alarm detectó problema, reconectando", { isMissing, isStale });
      const result = await this.connectTikTok(this.tiktokUsername).catch((err) => ({
        connected: false,
        error: String(err),
      }));
      if (!result.connected) {
        // connectTikTok ya programó el próximo alarm (con backoff) si falló.
        return;
      }
    }

    // Todo bien (o se acaba de reconectar): programa el próximo chequeo de rutina.
    if (!this.tiktokStopped && this.tiktokUsername) {
      await this.state.storage.setAlarm(Date.now() + OverlayRoom.TIKTOK_HEALTH_CHECK_MS);
    }
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
        await this.state.storage.put("tiktokToken", token);
        await this.state.storage.put("tiktokUsername", username);
        const result = await this.connectTikTok(username);
        return new Response(
          JSON.stringify({ ok: result.connected, username, error: result.error }),
          {
            status: result.connected ? 200 : 502,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (subAction === "disconnect") {
        await this.disconnectTikTok();
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
            connectedSince: this.tiktokConnectedAt,
            lastMessageAt: this.tiktokLastMessageAt,
            reconnectCount: this.tiktokReconnectCount,
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
  // TODA la reconexión (backoff Y el chequeo de "¿sigo vivo?") pasa por
  // Alarms de Cloudflare (ver alarm() arriba), no por setTimeout/setInterval,
  // así sobrevive aunque el Durable Object se recicle en el medio.
  // ===========================================================================

  private async disconnectTikTok() {
    this.tiktokStopped = true;
    await this.state.storage.deleteAlarm();
    await this.state.storage.delete(["tiktokToken", "tiktokUsername"]);
    if (this.tiktokWs) {
      try {
        this.tiktokWs.close();
      } catch {
        // ignore
      }
      this.tiktokWs = null;
    }
    this.tiktokUsername = null;
    this.tiktokConnectedAt = null;
    this.tiktokLastMessageAt = null;
    this.tiktokReconnectCount = 0;
  }

  /** Programa el próximo intento de reconexión (backoff exponencial) vía Alarm. */
  private async scheduleTikTokReconnect() {
    if (this.tiktokStopped || !this.tiktokUsername) return;
    this.tiktokReconnectAttempts += 1;
    this.tiktokReconnectCount += 1;
    const delay = Math.min(
      30000,
      2000 * Math.pow(2, Math.min(this.tiktokReconnectAttempts, 4))
    );
    await this.state.storage.setAlarm(Date.now() + delay);
  }

  private async connectTikTok(
    username: string
  ): Promise<{ connected: boolean; error?: string }> {
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

    if (!this.env.EULERSTREAM_API_KEY) {
      const error = "EULERSTREAM_API_KEY no configurada en el worker";
      console.error("[tiktok]", error);
      return { connected: false, error };
    }

    await this.ensureGiftCatalog();

    const wsUrl = `https://ws.eulerstream.com?uniqueId=${encodeURIComponent(
      username
    )}&apiKey=${encodeURIComponent(this.env.EULERSTREAM_API_KEY)}`;

    let resp: Response;
    try {
      resp = await fetch(wsUrl, { headers: { Upgrade: "websocket" } });
    } catch (err) {
      const error = `fetch a Eulerstream falló: ${String(err)}`;
      console.error("[tiktok]", error);
      await this.scheduleTikTokReconnect();
      return { connected: false, error };
    }

    const ws = (resp as unknown as { webSocket?: WebSocket }).webSocket;
    if (!ws) {
      let bodyText = "";
      try {
        bodyText = await resp.text();
      } catch {
        // ignore
      }
      const error = `Eulerstream no devolvió upgrade a WebSocket (status ${resp.status}): ${bodyText.slice(0, 300)}`;
      console.error("[tiktok]", error);
      await this.scheduleTikTokReconnect();
      return { connected: false, error };
    }

    ws.accept();
    this.tiktokWs = ws;
    this.tiktokReconnectAttempts = 0;
    this.tiktokConnectedAt = Date.now();
    // Sembramos lastMessageAt al conectar: si nunca llega ni un mensaje, el
    // próximo chequeo de rutina (alarm) lo detecta igual como silencio.
    this.tiktokLastMessageAt = Date.now();
    await this.state.storage.setAlarm(Date.now() + OverlayRoom.TIKTOK_HEALTH_CHECK_MS);
    console.log("[tiktok] conectado a Eulerstream para", username);

    ws.addEventListener("message", (evt: MessageEvent) => {
      this.tiktokLastMessageAt = Date.now();
      this.handleTikTokMessage(String(evt.data)).catch((err) => {
        console.error("[tiktok] error procesando mensaje:", String(err));
      });
    });

    ws.addEventListener("close", (evt: CloseEvent) => {
      console.log("[tiktok] socket cerrado", evt.code, evt.reason);
      if (this.tiktokWs === ws) this.tiktokWs = null;

      // Eulerstream cierra con este motivo cuando el live YA TERMINÓ — no es
      // un corte transitorio, así que no tiene sentido seguir reintentando
      // en loop (eso solo hacía parpadear el estado a "conectado" un
      // instante en cada intento). Queda desconectado limpio.
      const streamEnded =
        evt.code === 4404 || /not currently live/i.test(evt.reason || "");
      if (streamEnded) {
        console.log("[tiktok] el live terminó — no se reintenta más");
        this.disconnectTikTok().catch((err) => {
          console.error("[tiktok] error limpiando tras fin de live:", String(err));
        });
        return;
      }

      this.scheduleTikTokReconnect().catch((err) => {
        console.error("[tiktok] no se pudo programar la reconexión:", String(err));
      });
    });

    ws.addEventListener("error", () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    });

    return { connected: true };
  }

  /**
   * Catálogo GLOBAL de regalos de TikTok (id → nombre + valor en diamantes),
   * gratis vía la API de Eulerstream (no requiere plan Business). Se cachea en
   * memoria una sola vez por conexión — no cambia seguido.
   */
  private async ensureGiftCatalog(): Promise<void> {
    if (this.giftCatalog) return;
    try {
      const listResp = await fetch(
        `https://api.eulerstream.com/webcast/gifts?apiKey=${encodeURIComponent(
          this.env.EULERSTREAM_API_KEY
        )}`
      );
      const listJson = (await listResp.json()) as { url?: string };
      if (!listJson.url) return;

      const fileResp = await fetch(listJson.url);
      const file = (await fileResp.json()) as {
        data?: { gifts?: Array<{ id: number; name: string; diamond_count: number }> };
      };
      const gifts = file.data?.gifts ?? [];
      const map = new Map<number, { name: string; diamondCount: number }>();
      for (const g of gifts) {
        if (typeof g.id === "number") {
          map.set(g.id, { name: g.name || "", diamondCount: g.diamond_count || 0 });
        }
      }
      this.giftCatalog = map;
      console.log("[tiktok] catálogo de regalos cacheado:", map.size, "regalos");
    } catch (err) {
      console.error("[tiktok] no se pudo cargar el catálogo de regalos:", String(err));
    }
  }

  /** Extrae la primera URL de avatar disponible, sin importar la forma exacta del campo. */
  private extractAvatar(user: Record<string, any> | undefined): string {
    if (!user) return "";
    const pic = user.profilePicture;
    if (typeof pic === "string") return pic;
    if (Array.isArray(pic?.url) && pic.url[0]) return pic.url[0];
    if (Array.isArray(pic?.urlList) && pic.urlList[0]) return pic.urlList[0];
    if (Array.isArray(user.avatarThumb?.urlList) && user.avatarThumb.urlList[0]) {
      return user.avatarThumb.urlList[0];
    }
    return "";
  }

  private async handleTikTokMessage(raw: string) {
    let parsed: { messages?: TikTokWebcastMessage[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const messages = Array.isArray(parsed?.messages) ? parsed.messages : [];
    console.log(
      "[tiktok] recibidos",
      messages.length,
      "mensajes:",
      messages.map((m) => m.type).join(",")
    );
    for (const m of messages) {
      const event = this.mapTikTokEvent(m);
      if (event) this.queueTikTokForward(event);
    }
  }

  /**
   * Encola el reenvío a Next.js sin bloquear la lectura del socket: cada
   * llamada se ejecuta recién cuando la anterior terminó, así los writes a
   * Postgres quedan en orden estricto (uno a la vez) en vez de competir.
   */
  private queueTikTokForward(event: Record<string, unknown>) {
    this.tiktokForwardQueue = this.tiktokForwardQueue.then(() =>
      this.forwardTikTokEvent(event)
    );
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
          userAvatar: this.extractAvatar(data.user),
          text: data.comment || "",
        };

      case "WebcastLikeMessage": {
        const uniqueId = data.user?.uniqueId || "";
        // DEBUG temporal: confirmar si el evento llega SIN usuario (issue
        // documentado en la librería tiktok-live-connector #300) en vez de
        // no llegar directamente.
        if (!uniqueId) {
          console.error(
            "[tiktok][debug-like-no-user]",
            JSON.stringify({ hasUser: !!data.user, userKeys: data.user ? Object.keys(data.user) : null, count: data.likeCount })
          );
        }
        return {
          type: "like",
          total: Number(data.totalLikeCount) || 0,
          user: uniqueId,
          userAvatar: this.extractAvatar(data.user),
          count: Number(data.likeCount) || 0,
        };
      }

      case "WebcastSocialMessage": {
        const avatar = this.extractAvatar(data.user);
        // action "1" = follow (confirmado empíricamente). Un share no trae
        // followCount pero sí shareCount/shareType distinto de "0".
        if (String(data.action) === "1") {
          return { type: "follow", user: data.user?.uniqueId || "", userAvatar: avatar };
        }
        if (Number(data.shareCount) > 0 || String(data.shareType ?? "0") !== "0") {
          return { type: "share", user: data.user?.uniqueId || "", userAvatar: avatar };
        }
        return null;
      }

      case "WebcastGiftMessage": {
        const repeatCount = Number(data.repeatCount) || 1;
        const repeatEnd = Number(data.repeatEnd);
        // Mientras el combo de un mismo regalo sigue subiendo, esperamos a
        // que termine el streak (repeatEnd === 1) para no spamear alertas.
        if (repeatCount > 1 && repeatEnd !== 1) return null;
        const giftId = Number(data.giftId) || 0;
        const catalogEntry = this.giftCatalog?.get(giftId);
        return {
          type: "gift",
          user: data.user?.uniqueId || "",
          userAvatar: this.extractAvatar(data.user),
          giftName: catalogEntry?.name || data.gift?.name || "",
          giftId: data.giftId || "",
          diamondCount: catalogEntry?.diamondCount ?? 0,
          repeatCount,
        };
      }

      case "roomInfo": {
        const viewers = Number((data as any).roomInfo?.currentViewers);
        if (!Number.isFinite(viewers)) return null;
        return { type: "viewerCount", count: viewers };
      }

      case "WebcastRoomUserSeqMessage": {
        const viewers = Number(data.total);
        if (!Number.isFinite(viewers)) return null;
        return { type: "viewerCount", count: viewers };
      }

      default:
        return null;
    }
  }

  /**
   * Reenvía un evento a Next.js con reintentos cortos: una red lenta o un
   * cold start de Vercel no debería perder el evento en silencio. No
   * reintenta indefinidamente (el orden de la cola no debe trabarse mucho
   * tiempo por un solo evento problemático).
   */
  private async forwardTikTokEvent(event: Record<string, unknown>) {
    if (
      !this.token ||
      !this.env.NEXTJS_TIKTOK_EVENT_URL ||
      !this.env.TIKTOK_EVENT_SECRET
    ) {
      console.error(
        "[tiktok] forward abortado: falta token/NEXTJS_TIKTOK_EVENT_URL/TIKTOK_EVENT_SECRET",
        { hasToken: !!this.token }
      );
      return;
    }

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const resp = await fetch(this.env.NEXTJS_TIKTOK_EVENT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.env.TIKTOK_EVENT_SECRET}`,
          },
          body: JSON.stringify({ token: this.token, ...event }),
        });
        if (resp.ok) {
          console.log("[tiktok] forward", event.type, "->", resp.status);
          return;
        }
        console.error(
          "[tiktok] forward respondió",
          resp.status,
          `(intento ${attempt}/${maxAttempts})`,
          event.type
        );
      } catch (err) {
        console.error(
          `[tiktok] forward falló (intento ${attempt}/${maxAttempts}):`,
          String(err)
        );
      }
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    }
    console.error("[tiktok] forward ABANDONADO tras", maxAttempts, "intentos:", event.type);
  }
}
