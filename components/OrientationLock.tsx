"use client";

// Solo se ve en dispositivos táctiles (celular/tablet) cuando están en
// horizontal — el manifest ya fuerza portrait para quien instaló la PWA
// (Agregar a inicio); esto cubre el caso de quien la abre en el navegador
// normal, donde ninguna API puede bloquear la rotación de verdad.
export default function OrientationLock() {
  return (
    <div className="orientation-lock fixed inset-0 z-[999999] flex-col items-center justify-center gap-4 bg-[#1a1a1a] px-8 text-center text-white">
      <span
        className="inline-block text-6xl"
        style={{ animation: "orientation-lock-rotate 2.4s ease-in-out infinite" }}
      >
        📱
      </span>
      <p className="text-lg font-bold">Gira tu dispositivo a modo vertical</p>
      <p className="text-sm text-white/60">Ohara funciona mejor en vertical 👆</p>
    </div>
  );
}
