import type { LiveOverlayBracket } from "@/lib/live-overlay/types";

/** Placa de nombre (pergamino con borde dorado). */
function Plate({ seed, name }: { seed?: number; name: string }) {
  return (
    <div className="flex items-center gap-2">
      {seed ? (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-[3px] border-[#f5b301] bg-[#3a1c6e] text-xl font-black text-[#ffd766] shadow-[0_3px_10px_rgba(0,0,0,0.4)]">
          {seed}
        </span>
      ) : null}
      <div className="flex-1 rounded-xl border-[3px] border-[#d4a636] bg-gradient-to-b from-[#f7edd4] to-[#e9d6a8] px-3 py-2.5 text-center shadow-[0_4px_14px_rgba(0,0,0,0.35)]">
        <span
          className={
            name
              ? "text-2xl font-black uppercase tracking-tight text-[#2a1140]"
              : "text-xl font-bold uppercase tracking-widest text-[#9b8a63]"
          }
        >
          {name || "—"}
        </span>
      </div>
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-fit rounded-lg border-2 border-[#f5b301] bg-gradient-to-r from-[#6b2fb3] to-[#4a1f86] px-6 py-1 text-lg font-black uppercase tracking-[0.2em] text-[#ffd766] shadow-[0_4px_14px_rgba(0,0,0,0.4)]">
      ◆ {children} ◆
    </div>
  );
}

function MatchCard({
  seedA,
  a,
  seedB,
  b,
}: {
  seedA?: number;
  a: string;
  seedB?: number;
  b: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-[#d4a636]/50 bg-white/5 p-3 backdrop-blur-sm">
      <div className="space-y-2">
        <Plate seed={seedA} name={a} />
        <div className="text-center text-base font-black italic tracking-widest text-[#ffd766]">
          VS
        </div>
        <Plate seed={seedB} name={b} />
      </div>
    </div>
  );
}

/**
 * Vista presentacional del bracket (llena su contenedor posicionado). Se usa en
 * la ruta dedicada y como escena a pantalla completa dentro del overlay
 * principal. OPACO (morado) → sobrevive al chroma key verde.
 */
export default function BracketView({
  bracket,
}: {
  bracket: LiveOverlayBracket;
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col gap-4 overflow-hidden px-8 py-8"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, #5a2b9e 0%, #3a1c6e 45%, #241141 100%)",
      }}
    >
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.3em] text-[#ffd766]">
          ☠️ OHARA TCG ☠️
        </div>
        <h1 className="mt-1 text-7xl font-black italic leading-none text-white drop-shadow-[0_5px_0_rgba(0,0,0,0.35)]">
          {bracket.title}
        </h1>
        {bracket.subtitle ? (
          <div className="mx-auto mt-2 inline-block rounded-full border-2 border-[#f5b301] bg-[#4a1f86] px-6 py-1 text-base font-black uppercase tracking-[0.2em] text-[#ffd766]">
            {bracket.subtitle}
          </div>
        ) : null}
      </div>

      {/* Ronda 1 */}
      <Banner>Ronda 1</Banner>
      <div className="grid grid-cols-2 gap-4">
        <MatchCard
          seedA={1}
          a={bracket.round1[0]}
          seedB={2}
          b={bracket.round1[1]}
        />
        <MatchCard
          seedA={3}
          a={bracket.round1[2]}
          seedB={4}
          b={bracket.round1[3]}
        />
      </div>

      <div className="grid grid-cols-2 text-center text-2xl text-[#f5b301]">
        <span>▼</span>
        <span>▼</span>
      </div>

      {/* Final */}
      <Banner>Final</Banner>
      <MatchCard a={bracket.round2[0]} b={bracket.round2[1]} />

      <div className="text-center text-3xl text-[#f5b301]">▼</div>

      {/* Campeón */}
      <div className="mt-auto text-center">
        <div className="mb-[-14px] text-5xl leading-none">👑</div>
        <div className="rounded-2xl border-[3px] border-[#f5b301] bg-gradient-to-r from-[#7a3fc0] to-[#4a1f86] px-6 py-2 text-3xl font-black uppercase tracking-[0.25em] text-[#ffd766] shadow-[0_6px_20px_rgba(0,0,0,0.5)]">
          Campeón
        </div>
        <div className="mt-3 rounded-2xl border-[4px] border-[#f5b301] bg-gradient-to-b from-[#fff3cf] to-[#f0d68f] px-6 py-4 shadow-[0_8px_28px_rgba(0,0,0,0.5)]">
          <span
            className={
              bracket.champion
                ? "text-5xl font-black uppercase tracking-tight text-[#2a1140]"
                : "text-3xl font-bold uppercase tracking-widest text-[#9b8a63]"
            }
          >
            {bracket.champion || "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
