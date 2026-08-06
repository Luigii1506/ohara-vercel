# ohara-live-worker

Realtime del overlay de stream: un Cloudflare Worker con un **Durable Object**
(`OverlayRoom`) que mantiene las conexiones WebSocket y hace broadcast del estado
del overlay al instante (<100ms).

Postgres (Neon) sigue siendo la **fuente de verdad**; este worker solo hace el
fan-out. Ver `../lib/live-overlay/` en el repo principal.

## Flujo

```
Live Desk / iPad / Móvil
  → POST comando a Next.js (auth + valida + PERSISTE en Postgres)
    → Next.js hace POST /broadcast/:token a este worker (secreto compartido)
      → el Durable Object reenvía por WebSocket a todos los conectados
        → Overlay (OBS/TikTok) renderiza al instante
```

## Rutas

- `GET  /overlay/:token`   — upgrade a WebSocket (suscriptor read-only). Al
  conectar recibe el último estado guardado.
- `POST /broadcast/:token` — server-to-server desde Next.js. Header
  `Authorization: Bearer <LIVE_BROADCAST_SECRET>`. Body = JSON del estado.
- `GET  /health`           — healthcheck.

## Deploy (una vez)

Requiere el **Workers Paid plan** (ya lo tienes por el worker de imágenes). Los
Durable Objects vienen incluidos.

```bash
cd cloudflare-live
npm install
npx wrangler login                 # si no lo estás ya
npx wrangler secret put LIVE_BROADCAST_SECRET   # pega un secreto largo aleatorio
npm run deploy
```

Al terminar, `wrangler` imprime la URL:
`https://ohara-live-worker.<tu-subdominio>.workers.dev`

## Variables de entorno en Vercel (Next.js)

Con esa URL y el mismo secreto, define en Vercel:

- `LIVE_WORKER_BROADCAST_URL` = `https://ohara-live-worker.<tu-subdominio>.workers.dev`
- `LIVE_BROADCAST_SECRET`     = el mismo secreto que pusiste con `wrangler secret put`
- `NEXT_PUBLIC_LIVE_WS_URL`   = `wss://ohara-live-worker.<tu-subdominio>.workers.dev`

Si estas variables NO están definidas, el sistema **degrada con gracia**: el
overlay y el Live Desk siguen funcionando por polling (como antes), solo que sin
el empujón instantáneo del socket. Es decir, puedes desplegar Next.js antes de
tener el worker arriba sin romper nada.

## Costo

Plan Paid ($5/mes que ya pagas) + uso. Para 1–2 conexiones por token con
WebSocket Hibernation, el costo incremental es de centavos.
