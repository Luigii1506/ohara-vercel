// Lectura LOCAL de los logs de OPTCGSim desde el servidor Next.js.
//
// Solo tiene sentido cuando la app corre en la máquina del usuario (localhost):
// el servidor Node lee el disco directamente → cero picker, cero permisos.
// En despliegues (Vercel) se desactiva: el servidor en la nube no ve el disco
// del usuario. Se puede forzar/override la ruta con OPTCGSIM_LOGS_DIR.

import fs from "fs/promises";
import path from "path";
import os from "os";
import { GameSummary, summarizeLog } from "@/lib/replay/summarize";

/** ¿Está disponible el modo local? (localhost / dev, no Vercel). */
export function isLocalEnabled(): boolean {
  if (process.env.OPTCGSIM_LOGS_DIR) return true;
  if (process.env.VERCEL) return false; // desplegado en Vercel
  return process.env.NODE_ENV !== "production";
}

/** Ruta por defecto de CombatLogs según el SO (Unity persistentDataPath). */
export function defaultLogsDir(): string {
  if (process.env.OPTCGSIM_LOGS_DIR) return process.env.OPTCGSIM_LOGS_DIR;
  const home = os.homedir();
  switch (process.platform) {
    case "darwin":
      return path.join(
        home,
        "Library/Application Support/com.Batsu.OPTCGSim/CombatLogs"
      );
    case "win32":
      return path.join(home, "AppData/LocalLow/Batsu/OPTCGSim/CombatLogs");
    default:
      return path.join(home, ".config/unity3d/Batsu/OPTCGSim/CombatLogs");
  }
}

/** Recolecta los .log/.txt tanto en la carpeta base como en AutoSaved/. */
async function collectFiles(
  dir: string
): Promise<{ full: string; name: string; mtime: number }[]> {
  const out: { full: string; name: string; mtime: number }[] = [];
  for (const sub of ["", "AutoSaved"]) {
    const d = sub ? path.join(dir, sub) : dir;
    let names: string[] = [];
    try {
      names = await fs.readdir(d);
    } catch {
      continue;
    }
    for (const n of names) {
      if (!/\.(log|txt)$/i.test(n)) continue;
      const full = path.join(d, n);
      try {
        const st = await fs.stat(full);
        if (st.isFile()) out.push({ full, name: n, mtime: st.mtimeMs });
      } catch {
        // ignorar entradas ilegibles
      }
    }
  }
  return out;
}

/** Lista y resume todas las partidas locales (ordenadas de más reciente a más vieja). */
export async function listLocalGames(): Promise<{ dir: string; games: GameSummary[] }> {
  const dir = defaultLogsDir();
  const files = await collectFiles(dir);
  const games: GameSummary[] = [];
  for (const f of files) {
    try {
      const content = await fs.readFile(f.full, "utf8");
      const summary = summarizeLog(f.name, content, f.mtime);
      if (summary.players.length > 0) games.push(summary);
    } catch {
      // log corrupto/ilegible: saltar
    }
  }
  games.sort((a, b) => b.playedAt - a.playedAt);
  return { dir, games };
}

/** Lee el contenido de un log por nombre (protegido contra path traversal). */
export async function readLocalLog(name: string): Promise<string | null> {
  const base = path.basename(name);
  if (base !== name || !/\.(log|txt)$/i.test(base)) return null;
  const dir = defaultLogsDir();
  for (const sub of ["", "AutoSaved"]) {
    const full = path.join(sub ? path.join(dir, sub) : dir, base);
    try {
      const st = await fs.stat(full);
      if (st.isFile()) return await fs.readFile(full, "utf8");
    } catch {
      // seguir buscando
    }
  }
  return null;
}
