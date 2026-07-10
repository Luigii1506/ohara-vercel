"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FolderOpen,
  FileUp,
  RefreshCw,
  Trophy,
  Upload,
  HardDrive,
  Copy,
  Check,
} from "lucide-react";
import {
  isFileSystemAccessSupported,
  pickDirectory,
  getSavedDirectory,
  ensureReadPermission,
  queryReadPermission,
  listLogHandles,
  forgetSavedDirectory,
  FSDirHandle,
} from "@/lib/replay/fileAccess";
import { GameSummary, summarizeLog } from "@/lib/replay/summarize";
import { fetchCardMap, CardMap } from "@/lib/replay/hydrate";
import { cn } from "@/lib/utils";

interface ReplayLibraryProps {
  onPick: (file: File) => void;
}

// Ruta por defecto de CombatLogs por SO (Unity persistentDataPath). Se muestra en
// la UI para copiar/pegar en el diálogo del navegador, porque en macOS la carpeta
// vive dentro de ~/Library (oculta) y no se puede navegar a mano.
const LOG_PATHS = {
  mac: "~/Library/Application Support/com.Batsu.OPTCGSim/CombatLogs",
  win: "%USERPROFILE%\\AppData\\LocalLow\\Batsu\\OPTCGSim\\CombatLogs",
  linux: "~/.config/unity3d/Batsu/OPTCGSim/CombatLogs",
};

const detectOsPath = (): string => {
  if (typeof navigator === "undefined") return LOG_PATHS.mac;
  const p = `${navigator.platform || ""} ${navigator.userAgent || ""}`;
  if (/Win/i.test(p)) return LOG_PATHS.win;
  if (/Linux/i.test(p) && !/Android/i.test(p)) return LOG_PATHS.linux;
  return LOG_PATHS.mac; // mac por defecto (incluye iPad/desktop Safari)
};

const isMacPath = (path: string) => path.startsWith("~/Library");

/** Una partida en la lista + cómo obtener su File al hacer clic. */
interface Entry {
  summary: GameSummary;
  open: () => Promise<File>;
}

const ReplayLibrary: React.FC<ReplayLibraryProps> = ({ onPick }) => {
  // El soporte de la API depende del navegador → NO decidir el render inicial con
  // él (rompería la hidratación server/cliente). Arranca en false y se detecta al
  // montar. La lógica (efectos/handlers) sí usa la detección real directamente.
  const [supported, setSupported] = useState(false);
  // Ruta se resuelve en cliente (evita mismatch de hidratación por navigator).
  const [logsPath, setLogsPath] = useState(LOG_PATHS.mac);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setSupported(isFileSystemAccessSupported());
    setLogsPath(detectOsPath());
  }, []);

  const copyPath = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(logsPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard bloqueado: el usuario puede seleccionar el texto a mano */
    }
  }, [logsPath]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [leaderMap, setLeaderMap] = useState<CardMap>({});
  const [sourceLabel, setSourceLabel] = useState<string>(""); // carpeta local o elegida
  const [localMode, setLocalMode] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resuelve las imágenes de los líderes de una lista de partidas.
  const resolveLeaders = useCallback(async (games: GameSummary[]) => {
    const codes = Array.from(
      new Set(games.flatMap((g) => g.leaders.map((l) => l.code)))
    );
    setLeaderMap(await fetchCardMap(codes));
  }, []);

  // ── Modo LOCAL: el servidor (en tu Mac) lee la carpeta directo. Cero clics. ──
  const loadLocal = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/replay/local");
      const data = await res.json();
      if (!data?.available || !Array.isArray(data.games) || data.games.length === 0) {
        return false;
      }
      const games = data.games as GameSummary[];
      setEntries(
        games.map((summary) => ({
          summary,
          open: async () => {
            const r = await fetch(
              `/api/replay/local?file=${encodeURIComponent(summary.name)}`
            );
            const text = await r.text();
            return new File([text], summary.name, { type: "text/plain" });
          },
        }))
      );
      setLocalMode(true);
      setSourceLabel(data.dir ?? "carpeta local");
      await resolveLeaders(games);
      return true;
    } catch {
      return false;
    }
  }, [resolveLeaders]);

  // ── Modo PICKER: File System Access API (elegir carpeta manualmente). ──
  const loadFromDir = useCallback(
    async (dir: FSDirHandle) => {
      setLoading(true);
      setError(null);
      try {
        const ok = await ensureReadPermission(dir);
        if (!ok) {
          setError("Permiso de lectura denegado.");
          return;
        }
        const handles = await listLogHandles(dir);
        const parsed = await Promise.all(
          handles.map(async (handle) => {
            const file = await handle.getFile();
            const text = await file.text();
            return {
              summary: summarizeLog(handle.name, text, file.lastModified),
              open: () => handle.getFile(),
            } as Entry;
          })
        );
        const valid = parsed
          .filter((e) => e.summary.players.length > 0)
          .sort((a, b) => b.summary.playedAt - a.summary.playedAt);
        setEntries(valid);
        setLocalMode(false);
        setSourceLabel(dir.name);
        await resolveLeaders(valid.map((e) => e.summary));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error leyendo la carpeta");
      } finally {
        setLoading(false);
      }
    },
    [resolveLeaders]
  );

  // Al montar: primero intenta el modo local (auto). Si no, intenta reabrir la
  // carpeta recordada solo si el permiso sigue vigente.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const usedLocal = await loadLocal();
      if (cancelled) return;
      if (!usedLocal && isFileSystemAccessSupported()) {
        const h = await getSavedDirectory();
        if (h && !cancelled) {
          setSavedName(h.name);
          const perm = await queryReadPermission(h);
          if (perm === "granted" && !cancelled) await loadFromDir(h);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLocal, loadFromDir]);

  const openDirectory = async () => {
    const dir = await pickDirectory();
    if (dir) loadFromDir(dir);
  };
  const reopenSaved = async () => {
    const dir = await getSavedDirectory();
    if (dir) loadFromDir(dir);
  };
  // Construye la biblioteca a partir de Files sueltos (input clásico o arrastrar).
  // Este camino NO usa la File System Access API, así que funciona con archivos de
  // ~/Library (que Chrome bloquea para el picker de carpeta).
  const loadFromFiles = useCallback(
    async (files: File[]) => {
      const logs = files.filter((f) => /\.(log|txt)$/i.test(f.name));
      if (!logs.length) {
        setError("Esos archivos no son .log de OPTCGSim.");
        return;
      }
      // Un solo archivo → abrir el replay directo.
      if (logs.length === 1) {
        onPick(logs[0]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const parsed = await Promise.all(
          logs.map(async (file) => {
            const text = await file.text();
            return {
              summary: summarizeLog(file.name, text, file.lastModified),
              open: async () => file,
            } as Entry;
          })
        );
        const valid = parsed
          .filter((e) => e.summary.players.length > 0)
          .sort((a, b) => b.summary.playedAt - a.summary.playedAt);
        if (!valid.length) {
          setError("No encontré partidas válidas en esos archivos.");
          return;
        }
        setEntries(valid);
        setLocalMode(false);
        setSourceLabel(`${valid.length} archivos`);
        await resolveLeaders(valid.map((e) => e.summary));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error leyendo los archivos");
      } finally {
        setLoading(false);
      }
    },
    [onPick, resolveLeaders]
  );

  // Abre SIEMPRE el diálogo nativo clásico (no la File System Access API): es el
  // único que puede navegar a ~/Library (con ⌘⇧G) sin que Chrome lo bloquee.
  const chooseFile = () => inputRef.current?.click();

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) loadFromFiles(files);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Barra de acciones */}
      <div className="flex flex-wrap items-center gap-2">
        {localMode && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-200">
            <HardDrive className="h-4 w-4" /> Carpeta local detectada
          </span>
        )}
        {!localMode && (
          <button
            onClick={chooseFile}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            <FileUp className="h-4 w-4" /> Elegir archivos (.log)
          </button>
        )}
        {supported && !localMode && (
          <button
            onClick={openDirectory}
            title="Solo si copiaste los logs a una carpeta normal (Chrome bloquea ~/Library)"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            <FolderOpen className="h-4 w-4" /> Abrir carpeta
          </button>
        )}
        {supported && !localMode && savedName && entries.length === 0 && (
          <button
            onClick={reopenSaved}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-400/20"
          >
            <RefreshCw className="h-4 w-4" /> Reabrir «{savedName}»
          </button>
        )}
        {sourceLabel && entries.length > 0 && (
          <span className="ml-auto flex items-center gap-2 truncate text-xs text-white/50">
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate" title={sourceLabel}>
              {localMode ? "Local" : sourceLabel} · {entries.length} partidas
            </span>
            {!localMode && (
              <button
                onClick={() => {
                  setEntries([]);
                  setSourceLabel("");
                  forgetSavedDirectory();
                  setSavedName(null);
                }}
                className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20"
              >
                olvidar
              </button>
            )}
          </span>
        )}
      </div>

      {/* Ayuda para llegar a la carpeta oculta (~/Library en Mac). Se muestra
          cuando el picker está disponible y aún no hay partidas cargadas. */}
      {!localMode && entries.length === 0 && (
        <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/70">
          <p className="text-white/80">
            Pulsa <span className="font-semibold text-emerald-300">«Elegir
            archivos (.log)»</span> y en el diálogo
            {isMacPath(logsPath) ? (
              <>
                {" "}
                pulsa{" "}
                <kbd className="rounded bg-black/50 px-1 py-0.5 font-mono">
                  ⌘⇧G
                </kbd>
                , pega esta ruta, Enter, y selecciona todos tus `.log` (⌘A):
              </>
            ) : (
              <> ve a esta ruta y selecciona tus `.log`:</>
            )}
          </p>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 truncate rounded bg-black/40 px-2 py-1.5 font-mono text-emerald-200"
              title={logsPath}
            >
              {logsPath}
            </code>
            <button
              onClick={copyPath}
              className="inline-flex shrink-0 items-center gap-1 rounded bg-white/10 px-2 py-1.5 font-medium hover:bg-white/20"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="text-white/50">
            Chrome bloquea el acceso por <em>carpeta</em> a ~/Library, pero elegir
            los archivos sí funciona. También puedes arrastrarlos desde Finder.
          </p>
        </div>
      )}

      {!supported && !localMode && (
        <div className="space-y-2 rounded-lg border border-amber-300/20 bg-amber-500/5 p-3">
          <p className="text-xs text-amber-300/80">
            Tu navegador no permite abrir carpetas (usa Chrome/Edge/Brave).
            Mientras, elige o arrastra un archivo. La carpeta está en:
          </p>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 truncate rounded bg-black/40 px-2 py-1.5 font-mono text-xs text-amber-200"
              title={logsPath}
            >
              {logsPath}
            </code>
            <button
              onClick={copyPath}
              className="inline-flex shrink-0 items-center gap-1 rounded bg-white/10 px-2 py-1.5 text-xs font-medium text-white hover:bg-white/20"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 rounded-lg bg-white/5 p-3 text-sm text-white/70">
          <RefreshCw className="h-4 w-4 animate-spin" /> Leyendo partidas…
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Lista de partidas */}
      {entries.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map(({ summary, open }) => (
            <button
              key={summary.name}
              onClick={() => open().then(onPick)}
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/50 p-2.5 text-left transition-colors hover:border-emerald-400/50 hover:bg-slate-800/60"
            >
              <div className="flex -space-x-3 shrink-0">
                {summary.leaders.map((l, i) => (
                  <div
                    key={i}
                    className="h-12 w-12 overflow-hidden rounded-lg ring-2 ring-slate-900"
                  >
                    {leaderMap[l.code] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={leaderMap[l.code].src}
                        alt={l.name}
                        className="h-full w-full object-cover object-top"
                      />
                    ) : (
                      <div className="h-full w-full bg-white/10" />
                    )}
                  </div>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">
                  {summary.leaders
                    .map((l) => leaderMap[l.code]?.name ?? l.name)
                    .join(" vs ") || summary.name}
                </div>
                <div className="truncate text-xs text-white/50">
                  {summary.players.join(" vs ")}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/40">
                  <span>{summary.dateLabel}</span>
                  <span>· {summary.turns} turnos</span>
                  {summary.winner && (
                    <span className="inline-flex items-center gap-0.5 text-amber-400">
                      <Trophy className="h-3 w-3" />
                      {summary.winner.split("#")[0]}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Zona de arrastre (fallback cuando no hay lista) */}
      {entries.length === 0 && !loading && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={chooseFile}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
            dragOver
              ? "border-emerald-400/70 bg-emerald-400/10"
              : "border-white/15 bg-white/[0.02] hover:border-white/30"
          )}
        >
          <Upload className="h-7 w-7 text-white/40" />
          <div className="text-sm text-white/60">
            {supported
              ? "…o arrastra un .log aquí"
              : "Arrastra un .log de OPTCGSim, o haz clic"}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".log,.txt"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) loadFromFiles(files);
          e.target.value = ""; // permite volver a elegir los mismos archivos
        }}
      />
    </div>
  );
};

export default ReplayLibrary;
