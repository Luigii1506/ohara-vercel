// Tipos para el replay de partidas de OPTCGSim (formato v1.40 "AutoSaved").
//
// Un log se parsea a un array ordenado de ReplayEvent. El estado del tablero
// (types/simulator.ts) se DERIVA plegando estos eventos con un reducer puro.
// Esto habilita: avanzar/retroceder evento por evento, y en el futuro bifurcar
// la partida ("¿qué hubiera pasado?") a partir de cualquier índice.

/** Identidad cruda del jugador tal como aparece entre corchetes: "Luigi#8803". */
export type PlayerRef = string;

/** Referencia a una carta: su nombre visible y su código de set (OP11-040). */
export interface CardRef {
  name: string;
  code: string;
}

/** Qué jugador (1 = primer conectado, 2 = segundo) en las líneas estructuradas RZ1. */
export type Rz1Player = 1 | 2;

/**
 * Evento de replay. Unión discriminada por `kind`.
 * `line` guarda el nº de línea original del log (para depurar / resaltar en UI).
 */
export type ReplayEvent =
  // --- Setup / cabecera ---
  | { kind: "connect"; line: number; player: PlayerRef }
  | { kind: "version"; line: number; version: string }
  | { kind: "leader"; line: number; player: PlayerRef; card: CardRef }
  | {
      kind: "turnOrder";
      line: number;
      player: PlayerRef;
      choice: "first" | "second" | "select";
    }
  | { kind: "mulligan"; line: number; player: PlayerRef }
  | {
      kind: "handReveal";
      line: number;
      player: PlayerRef;
      phase: "before" | "after";
      cards: string[];
    }
  // --- Robos ---
  | {
      kind: "draw";
      line: number;
      player: PlayerRef;
      drawType: "deck" | "card" | "don";
      card?: CardRef; // presente cuando el log revela la identidad ("Drew card from deck: X")
      count?: number; // presente en "Draw N Card" / "Draw N Don"
    }
  // --- DON!! ---
  | {
      kind: "attachDon";
      line: number;
      player: PlayerRef;
      target: CardRef;
      amount: number;
      total: number;
    }
  // --- Jugar cartas / habilidades ---
  | { kind: "deploy"; line: number; player: PlayerRef; card: CardRef }
  | {
      kind: "ability";
      line: number;
      player: PlayerRef;
      source: CardRef;
      text: string; // el efecto en crudo tras "Nombre [código]: "
      targets: CardRef[]; // cartas mencionadas en el efecto
    }
  // --- Combate ---
  | {
      kind: "attackDeclare";
      line: number;
      player: PlayerRef;
      attacker: CardRef;
      defender: CardRef;
    }
  | {
      kind: "combatResult";
      line: number;
      attacker: CardRef;
      attackerPower: number;
      defender: CardRef;
      defenderPower: number;
    }
  | { kind: "damage"; line: number; target: CardRef; amount: number }
  | { kind: "attackFail"; line: number }
  | { kind: "block"; line: number; player: PlayerRef; blocker: CardRef }
  | {
      kind: "destroy";
      line: number;
      player?: PlayerRef;
      card: CardRef;
    }
  | {
      kind: "counter";
      line: number;
      player: PlayerRef;
      card: CardRef;
      value: number;
    }
  // --- Manipulación de deck (fondo/tope/revelar) ---
  | {
      kind: "deckManip";
      line: number;
      player: PlayerRef;
      text: string;
      card?: CardRef;
    }
  // --- Turnos ---
  | { kind: "endTurn"; line: number; player: PlayerRef }
  // --- Checkpoints de estado (fin de turno): fuente de verdad para self-healing ---
  | {
      kind: "checkpoint";
      line: number;
      player: PlayerRef;
      zone: "hand" | "board" | "trash";
      cards: string[];
    }
  | { kind: "life"; line: number; player: PlayerRef; value: number }
  // --- Fin de partida ---
  | { kind: "concede"; line: number; player: PlayerRef }
  // --- Línea estructurada RZ1 (delta de estado exacto de OPTCGSim) ---
  | {
      kind: "rz1";
      line: number;
      seq: number;
      player: Rz1Player;
      token: string; // código de carta o "Don"
      fields: number[]; // campos numéricos restantes (semántica parcial)
    }
  // --- No reconocido (se conserva para depurar sin perder nada) ---
  | { kind: "raw"; line: number; text: string };

export type ReplayEventKind = ReplayEvent["kind"];

/** Un turno agrupa los eventos entre dos "End Turn". */
export interface ReplayTurn {
  index: number; // 1-based
  player: PlayerRef; // dueño del turno
  startEvent: number; // índice en events[] donde arranca
  endEvent: number; // índice del "endTurn" (o último evento)
}

/** Cabecera / metadatos derivados del log completo. */
export interface ReplayHeader {
  roomId?: string;
  version?: string;
  players: PlayerRef[]; // en orden de conexión: [jugador1, jugador2]
  leaders: Partial<Record<PlayerRef, CardRef>>;
  firstPlayer?: PlayerRef;
  winner?: PlayerRef;
  loser?: PlayerRef;
  endReason?: "concede" | "life" | "unknown";
}

/** Resultado completo del parseo de un log. */
export interface ParsedReplay {
  header: ReplayHeader;
  events: ReplayEvent[];
  turns: ReplayTurn[];
  /** Advertencias no fatales (líneas ambiguas, etc.) para diagnóstico. */
  warnings: string[];
}
