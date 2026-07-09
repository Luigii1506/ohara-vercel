"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ReplayViewer from "@/components/simulator/ReplayViewer";

const ReplayPage = () => {
  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-3 py-4 lg:px-6">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Replay de partidas</h1>
            <p className="text-xs text-white/50">
              Reproduce tus partidas de OPTCGSim turno por turno.
            </p>
          </div>
          <Link
            href="/simulator"
            className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Simulador
          </Link>
        </div>

        <ReplayViewer />
      </div>
    </main>
  );
};

export default ReplayPage;
