"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveOverlayState } from "@/lib/live-overlay/types";

// Base wss:// del worker de realtime (ohara-live-worker). Si no está definida,
// el hook queda inerte y el llamador degrada a polling.
const WS_BASE = process.env.NEXT_PUBLIC_LIVE_WS_URL || "";

/**
 * Suscripción WebSocket al estado del overlay. Read-only: recibe el estado y lo
 * entrega por onState. Reconecta con backoff exponencial y manda un ping de
 * keep-alive. Devuelve `connected` para que el llamador ajuste su polling de
 * respaldo (lento cuando hay socket, rápido cuando no).
 */
export function useOverlaySocket(opts: {
  token: string | null;
  onState: (state: LiveOverlayState) => void;
  enabled?: boolean;
}): { connected: boolean; configured: boolean } {
  const { token, enabled = true } = opts;
  const onStateRef = useRef(opts.onState);
  onStateRef.current = opts.onState;
  const [connected, setConnected] = useState(false);
  const configured = Boolean(WS_BASE);

  useEffect(() => {
    if (!configured || !enabled || !token) return;

    let closedByUs = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let pingTimer: number | undefined;
    let attempt = 0;

    const scheduleReconnect = () => {
      attempt += 1;
      const delay = Math.min(1000 * 2 ** Math.min(attempt, 4), 15000); // 2s..15s
      reconnectTimer = window.setTimeout(connect, delay);
    };

    const connect = () => {
      try {
        ws = new WebSocket(
          `${WS_BASE.replace(/\/$/, "")}/overlay/${encodeURIComponent(token)}`
        );
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
        pingTimer = window.setInterval(() => {
          try {
            ws?.send("ping");
          } catch {
            // ignore
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== "string" || event.data === "pong") return;
        try {
          const state = JSON.parse(event.data) as LiveOverlayState;
          onStateRef.current(state);
        } catch {
          // payload inválido, ignora
        }
      };

      ws.onclose = () => {
        setConnected(false);
        window.clearInterval(pingTimer);
        if (!closedByUs) scheduleReconnect();
      };

      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          // onclose se encargará del reconnect
        }
      };
    };

    connect();

    return () => {
      closedByUs = true;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(pingTimer);
      try {
        ws?.close();
      } catch {
        // ignore
      }
      setConnected(false);
    };
  }, [token, enabled, configured]);

  return { connected, configured };
}
