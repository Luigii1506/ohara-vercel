"use client";

// ============================================
// OFFLINE SESSION MANAGEMENT
// ============================================

import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "ohara-session-db";
const STORE_NAME = "sessions";
const SESSION_KEY = "current-session";
const SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 días

interface CachedSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  expires: string;
  cachedAt: number;
}

let db: IDBPDatabase | null = null;

// Inicializar base de datos
async function initDB() {
  if (db) return db;

  const { openDB } = await import("idb");

  db = await openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });

  return db;
}

// Guardar sesión en IndexedDB
export async function cacheSession(session: any) {
  if (!session || !session.user) {
    console.log("[OfflineSession] No session to cache");
    return;
  }

  try {
    const database = await initDB();

    const cachedSession: CachedSession = {
      user: {
        id: session.user.id || session.user.email || "unknown",
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      },
      expires: session.expires,
      cachedAt: Date.now(),
    };

    await database.put(STORE_NAME, cachedSession, SESSION_KEY);

    console.log("[OfflineSession] Session cached:", cachedSession.user.email);

    // También guardar en localStorage como backup
    localStorage.setItem(
      "ohara-session-backup",
      JSON.stringify(cachedSession)
    );
  } catch (error) {
    console.error("[OfflineSession] Error caching session:", error);
  }
}

// Obtener sesión cacheada
export async function getCachedSession(): Promise<CachedSession | null> {
  try {
    const database = await initDB();
    const cached = await database.get(STORE_NAME, SESSION_KEY);

    if (!cached) {
      // Intentar desde localStorage
      const backup = localStorage.getItem("ohara-session-backup");
      if (backup) {
        return JSON.parse(backup);
      }
      return null;
    }

    // Verificar expiración
    const now = Date.now();
    const cacheAge = now - cached.cachedAt;

    if (cacheAge > SESSION_EXPIRY) {
      console.log("[OfflineSession] Cached session expired");
      await clearCachedSession();
      return null;
    }

    console.log("[OfflineSession] Using cached session:", cached.user.email);
    return cached;
  } catch (error) {
    console.error("[OfflineSession] Error getting cached session:", error);

    // Fallback a localStorage
    try {
      const backup = localStorage.getItem("ohara-session-backup");
      if (backup) {
        return JSON.parse(backup);
      }
    } catch (e) {
      console.error("[OfflineSession] Backup failed too:", e);
    }

    return null;
  }
}

// Limpiar sesión cacheada
export async function clearCachedSession() {
  try {
    const database = await initDB();
    await database.delete(STORE_NAME, SESSION_KEY);
    localStorage.removeItem("ohara-session-backup");
    console.log("[OfflineSession] Session cache cleared");
  } catch (error) {
    console.error("[OfflineSession] Error clearing session:", error);
  }
}

// Verificar si hay sesión cacheada válida
export async function hasValidCachedSession(): Promise<boolean> {
  const cached = await getCachedSession();
  return cached !== null;
}

// Obtener sesión (online o cacheada)
export async function getSession(
  onlineSession: any
): Promise<CachedSession | null> {
  // Si hay sesión online, cachearla y usarla
  if (onlineSession && onlineSession.user) {
    await cacheSession(onlineSession);
    return {
      user: onlineSession.user,
      expires: onlineSession.expires,
      cachedAt: Date.now(),
    };
  }

  // Si no hay sesión online, intentar usar la cacheada
  const cachedSession = await getCachedSession();

  if (cachedSession) {
    console.log("[OfflineSession] Using offline session");
    return cachedSession;
  }

  return null;
}

// Verificar si estamos offline
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}
