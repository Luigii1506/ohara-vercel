// Acceso a los archivos de log vía File System Access API (Chromium).
//
// Permite: elegir un archivo directamente, o abrir la carpeta CombatLogs/AutoSaved
// una sola vez (el permiso se guarda en IndexedDB) y listar todas las partidas.
// En navegadores sin soporte (Safari/Firefox) se cae al <input type=file>.

import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";

// --- Tipos mínimos de la API (no siempre presentes en lib.dom del target) ---
export interface FSFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
}
export interface FSDirHandle {
  kind: "directory";
  name: string;
  values(): AsyncIterator<FSFileHandle | FSDirHandle> &
    AsyncIterable<FSFileHandle | FSDirHandle>;
  queryPermission?(d: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(d: { mode: "read" | "readwrite" }): Promise<PermissionState>;
}

type PickerWindow = Window & {
  showDirectoryPicker?: (opts?: unknown) => Promise<FSDirHandle>;
  showOpenFilePicker?: (opts?: unknown) => Promise<FSFileHandle[]>;
};

const DIR_HANDLE_KEY = "replay-dir-handle";

export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as PickerWindow).showDirectoryPicker === "function"
  );
}

/** Abre el picker de archivo único y devuelve el File elegido (o null si cancela). */
export async function pickLogFile(startIn?: FSDirHandle): Promise<File | null> {
  const w = window as PickerWindow;
  if (typeof w.showOpenFilePicker !== "function") return null;
  try {
    const [handle] = await w.showOpenFilePicker({
      types: [
        {
          description: "OPTCGSim log",
          accept: { "text/plain": [".log", ".txt"] },
        },
      ],
      excludeAcceptAllOption: false,
      multiple: false,
      ...(startIn ? { startIn } : {}),
    });
    return await handle.getFile();
  } catch {
    return null; // el usuario canceló
  }
}

/** Abre el picker de carpeta, guarda el handle y lo devuelve (o null si cancela). */
export async function pickDirectory(): Promise<FSDirHandle | null> {
  const w = window as PickerWindow;
  if (typeof w.showDirectoryPicker !== "function") return null;
  try {
    const handle = await w.showDirectoryPicker({ mode: "read" });
    await idbSet(DIR_HANDLE_KEY, handle);
    return handle;
  } catch {
    return null;
  }
}

/** Recupera el handle de carpeta guardado (sin pedir permiso todavía). */
export async function getSavedDirectory(): Promise<FSDirHandle | null> {
  try {
    const handle = (await idbGet(DIR_HANDLE_KEY)) as FSDirHandle | undefined;
    return handle ?? null;
  } catch {
    return null;
  }
}

export async function forgetSavedDirectory(): Promise<void> {
  await idbDel(DIR_HANDLE_KEY);
}

/** Consulta el permiso SIN solicitarlo (no requiere gesto; no abre prompt). */
export async function queryReadPermission(
  handle: FSDirHandle
): Promise<PermissionState> {
  try {
    if (handle.queryPermission) {
      return await handle.queryPermission({ mode: "read" });
    }
    return "granted";
  } catch {
    return "prompt";
  }
}

/** Verifica/solicita permiso de lectura. Requiere gesto del usuario para solicitar. */
export async function ensureReadPermission(handle: FSDirHandle): Promise<boolean> {
  try {
    const opts = { mode: "read" as const };
    if (handle.queryPermission) {
      const q = await handle.queryPermission(opts);
      if (q === "granted") return true;
    }
    if (handle.requestPermission) {
      const r = await handle.requestPermission(opts);
      return r === "granted";
    }
    return true;
  } catch {
    return false;
  }
}

/** Lista los .log/.txt de la carpeta (no lee su contenido todavía). */
export async function listLogHandles(dir: FSDirHandle): Promise<FSFileHandle[]> {
  const out: FSFileHandle[] = [];
  const iter = dir.values();
  // Iteración manual para no depender de `for await` (target < es2018).
  while (true) {
    const { value, done } = await iter.next();
    if (done) break;
    if (
      value.kind === "file" &&
      /\.(log|txt)$/i.test(value.name)
    ) {
      out.push(value as FSFileHandle);
    }
  }
  return out;
}
