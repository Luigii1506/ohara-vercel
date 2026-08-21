"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, RefreshCw, Trash2, Unlink } from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

type CharacterOption = {
  id: number;
  name: string;
  slug: string;
};

type SourceSheetRow = {
  id: number;
  gid: string;
  sheetName: string;
  lastSyncedAt: string | null;
  lastRowCount: number | null;
  syncNotes: string | null;
  character: CharacterOption | null;
};

type UnresolvedEntry = {
  id: number;
  rowNumber: number;
  sourceCardName: string;
  sourceCardCode: string | null;
  sourceCardType: string | null;
  sourceVariant: string | null;
  specialSet: string | null;
  notes: string | null;
  sheet: {
    id: number;
    sheetName: string;
    gid: string;
  };
  character: CharacterOption | null;
};

type ManualLink = {
  id: number;
  relationType: string;
  notes: string | null;
  updatedAt: string;
  character: CharacterOption;
  card: {
    id: number;
    code: string;
    name: string;
    src: string;
  };
};

type AdminResponse = {
  stats: {
    charactersCount: number;
    sourceSheetsCount: number;
    sourceRowsCount: number;
    unresolvedRowsCount: number;
    linksCount: number;
    manualLinksCount: number;
  };
  characters: CharacterOption[];
  sheets: SourceSheetRow[];
  unresolvedEntries: UnresolvedEntry[];
  recentManualLinks: ManualLink[];
};

const RELATION_TYPES = [
  "DEPICTED_IN_ART",
  "THEME_OF_CARD",
  "MENTIONED_IN_NAME",
  "MENTIONED_IN_TEXT",
  "MENTIONED_IN_TRIGGER",
] as const;

function formatDateTime(value?: string | null) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function relationTypeLabel(value: string) {
  switch (value) {
    case "DEPICTED_IN_ART":
      return "Cameo en arte";
    case "THEME_OF_CARD":
      return "Tema de la carta";
    case "MENTIONED_IN_NAME":
      return "Mencionado en nombre";
    case "MENTIONED_IN_TEXT":
      return "Mencionado en texto";
    case "MENTIONED_IN_TRIGGER":
      return "Mencionado en trigger";
    default:
      return value;
  }
}

export default function AdminMasterSetsClient() {
  const [data, setData] = useState<AdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [busyEntryId, setBusyEntryId] = useState<number | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<number | null>(null);
  const [entryCardCodes, setEntryCardCodes] = useState<Record<number, string>>({});
  const [manualCharacterId, setManualCharacterId] = useState("");
  const [manualCardCode, setManualCardCode] = useState("");
  const [manualRelationType, setManualRelationType] =
    useState<(typeof RELATION_TYPES)[number]>("DEPICTED_IN_ART");
  const [manualNotes, setManualNotes] = useState("");
  const [characterSearch, setCharacterSearch] = useState("");

  const loadData = async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const response = await fetch("/api/admin/master-sets", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("No se pudo cargar admin/master-sets");
      }

      const payload = (await response.json()) as AdminResponse;
      setData(payload);
      setEntryCardCodes((current) => {
        const next = { ...current };
        for (const entry of payload.unresolvedEntries) {
          if (next[entry.id] === undefined) {
            next[entry.id] = entry.sourceCardCode ?? "";
          }
        }
        return next;
      });
      setManualCharacterId((current) => current || String(payload.characters[0]?.id ?? ""));
    } catch (error) {
      console.error(error);
      showErrorToast((error as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const syncCommand = useMemo(
    () =>
      "npm run sync:cameos:google-sheet\nnpm run sync:cameos:google-sheet -- --limit=20\nnpm run sync:cameos:google-sheet -- --names=\"Monkey D. Luffy,Ace\"",
    []
  );

  const filteredCharacters = useMemo(() => {
    if (!data) return [];
    const query = characterSearch.trim().toLowerCase();
    if (!query) return data.characters.slice(0, 60);

    return data.characters
      .filter((character) => {
        const haystack = `${character.name} ${character.slug}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 60);
  }, [characterSearch, data]);

  const submitManualLink = async () => {
    if (!manualCharacterId || !manualCardCode.trim()) {
      showErrorToast("Selecciona personaje y código de carta");
      return;
    }

    setSubmittingManual(true);
    try {
      const response = await fetch("/api/admin/master-sets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          characterId: Number(manualCharacterId),
          cardCode: manualCardCode.trim(),
          relationType: manualRelationType,
          notes: manualNotes.trim() || null,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo crear el link manual");
      }

      showSuccessToast("Link manual creado");
      setManualCardCode("");
      setManualNotes("");
      await loadData("refresh");
    } catch (error) {
      console.error(error);
      showErrorToast((error as Error).message);
    } finally {
      setSubmittingManual(false);
    }
  };

  const patchEntry = async (
    entryId: number,
    action: "match" | "ignore" | "unmatch"
  ) => {
    setBusyEntryId(entryId);
    try {
      const response = await fetch(`/api/admin/master-sets/entries/${entryId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          cardCode: entryCardCodes[entryId]?.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo actualizar la fila");
      }

      showSuccessToast(
        action === "ignore"
          ? "Fila ignorada"
          : action === "unmatch"
          ? "Link removido"
          : "Fila resuelta"
      );
      await loadData("refresh");
    } catch (error) {
      console.error(error);
      showErrorToast((error as Error).message);
    } finally {
      setBusyEntryId(null);
    }
  };

  const deleteLink = async (linkId: number) => {
    setDeletingLinkId(linkId);
    try {
      const response = await fetch(`/api/admin/master-sets/links/${linkId}`, {
        method: "DELETE",
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo eliminar el link");
      }

      showSuccessToast("Link eliminado");
      await loadData("refresh");
    } catch (error) {
      console.error(error);
      showErrorToast((error as Error).message);
    } finally {
      setDeletingLinkId(null);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-4 py-10">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando master sets…
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          No se pudo cargar la información de master sets.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">
              Master Sets
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Esta vista administra personajes, cameos importados desde Google
              Sheets y links manuales carta-personaje. El sheet queda como
              fuente viva; tus correcciones quedan guardadas por separado.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadData("refresh")}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/master-sets"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Abrir master sets
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["characters", data.stats.charactersCount],
          ["source sheets", data.stats.sourceSheetsCount],
          ["source rows", data.stats.sourceRowsCount],
          ["unresolved", data.stats.unresolvedRowsCount],
          ["all links", data.stats.linksCount],
          ["manual links", data.stats.manualLinksCount],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="text-3xl font-bold text-slate-950">{value}</div>
            <div className="mt-1 text-sm text-slate-500">{label}</div>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Sync source</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            El importador lee las pestañas públicas del documento, importa cada
            fila como evidencia y genera links `DEPICTED_IN_ART` cuando logra
            resolver la carta.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-sm text-slate-100">
            <code>{syncCommand}</code>
          </pre>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Manual link</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Agrega relaciones adicionales sin depender del sheet.
          </p>
          <div className="mt-4 grid gap-3">
            <select
              value={manualCharacterId}
              onChange={(event) => setManualCharacterId(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none ring-0"
            >
              {data.characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
            <input
              value={manualCardCode}
              onChange={(event) => setManualCardCode(event.target.value)}
              placeholder="OP01-001"
              className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none"
            />
            <select
              value={manualRelationType}
              onChange={(event) =>
                setManualRelationType(
                  event.target.value as (typeof RELATION_TYPES)[number]
                )
              }
              className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none"
            >
              {RELATION_TYPES.map((relationType) => (
                <option key={relationType} value={relationType}>
                  {relationTypeLabel(relationType)}
                </option>
              ))}
            </select>
            <textarea
              value={manualNotes}
              onChange={(event) => setManualNotes(event.target.value)}
              placeholder="Notas opcionales"
              rows={3}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
            />
            <button
              type="button"
              onClick={submitManualLink}
              disabled={submittingManual}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingManual ? "Guardando…" : "Crear link manual"}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Imported sheets</h2>
            <p className="mt-2 text-sm text-slate-600">
              Pestañas detectadas y último resultado de sincronización.
            </p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-3 pr-4 font-medium">Character</th>
                <th className="pb-3 pr-4 font-medium">Sheet</th>
                <th className="pb-3 pr-4 font-medium">Rows</th>
                <th className="pb-3 pr-4 font-medium">Last sync</th>
                <th className="pb-3 pr-4 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.sheets.map((sheet) => (
                <tr key={sheet.id}>
                  <td className="py-3 pr-4 font-semibold text-slate-900">
                    {sheet.character?.name ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">
                    <div className="flex items-center gap-2">
                      <span>{sheet.sheetName}</span>
                      <a
                        href={`https://docs.google.com/spreadsheets/d/19z6aFtVP0fFgTze5Fwa2USdp2shUOts4dsUsxCuxMTM/edit#gid=${sheet.gid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 transition hover:text-slate-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-slate-700">
                    {sheet.lastRowCount ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">
                    {formatDateTime(sheet.lastSyncedAt)}
                  </td>
                  <td className="py-3 pr-4 text-slate-500">
                    {sheet.syncNotes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Characters</h2>
            <p className="mt-2 text-sm text-slate-600">
              Busca personajes y salta a su master set público.
            </p>
          </div>
          <input
            value={characterSearch}
            onChange={(event) => setCharacterSearch(event.target.value)}
            placeholder="Buscar personaje"
            className="h-11 min-w-[240px] rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none"
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredCharacters.map((character) => (
            <div
              key={character.id}
              className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
            >
              <div className="font-semibold text-slate-950">{character.name}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                {character.slug}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/master-sets/${character.slug}`}
                  className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Ver master set
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Unresolved rows</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Filas importadas que no pudieron mapearse solas. Puedes asignarlas
            por código, ignorarlas o limpiar un match previo.
          </p>
          <div className="mt-4 space-y-4">
            {data.unresolvedEntries.length === 0 ? (
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                No hay filas sin resolver.
              </div>
            ) : (
              data.unresolvedEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">
                        {entry.character?.name ?? "Unknown"} · {entry.sourceCardName}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {entry.sheet.sheetName} · row {entry.rowNumber}
                      </div>
                      <div className="mt-2 text-sm text-slate-600">
                        code: {entry.sourceCardCode ?? "—"} · type:{" "}
                        {entry.sourceCardType ?? "—"} · variant:{" "}
                        {entry.sourceVariant ?? "—"}
                        {entry.specialSet ? ` · special: ${entry.specialSet}` : ""}
                      </div>
                      {entry.notes ? (
                        <div className="mt-1 text-sm text-amber-700">
                          {entry.notes}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <input
                      value={entryCardCodes[entry.id] ?? ""}
                      onChange={(event) =>
                        setEntryCardCodes((current) => ({
                          ...current,
                          [entry.id]: event.target.value,
                        }))
                      }
                      placeholder="Código a enlazar"
                      className="h-10 min-w-[180px] rounded-full border border-slate-200 px-4 text-sm text-slate-900 outline-none"
                    />
                    <button
                      type="button"
                      disabled={busyEntryId === entry.id}
                      onClick={() => patchEntry(entry.id, "match")}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Match
                    </button>
                    <button
                      type="button"
                      disabled={busyEntryId === entry.id}
                      onClick={() => patchEntry(entry.id, "ignore")}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Ignore
                    </button>
                    <button
                      type="button"
                      disabled={busyEntryId === entry.id}
                      onClick={() => patchEntry(entry.id, "unmatch")}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Unlink className="h-4 w-4" />
                      Reset
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Recent manual links</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Borrar un link manual no toca tus filas importadas. Si borras un
            link originado desde Google Sheet, la fila vuelve a `UNMATCHED`.
          </p>
          <div className="mt-4 space-y-3">
            {data.recentManualLinks.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Aún no hay links manuales recientes.
              </div>
            ) : (
              data.recentManualLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-950">
                      {link.character.name} → {link.card.code}
                    </div>
                    <div className="mt-1 truncate text-sm text-slate-600">
                      {link.card.name}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {relationTypeLabel(link.relationType)} ·{" "}
                      {formatDateTime(link.updatedAt)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteLink(link.id)}
                    disabled={deletingLinkId === link.id}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
