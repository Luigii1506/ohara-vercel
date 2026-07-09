// Esquema de EFECTOS ESTRUCTURADOS para el motor de reglas del simulador.
//
// El texto de las cartas (Card.texts) usa lenguaje estándar de One Piece TCG.
// lib/rules/parseEffect.ts lo convierte a esta forma ejecutable. El ejecutor
// (futuro) aplicará cada Action sobre el SimulationState — reusando la lógica
// que ya existe en el reducer del replay (draw, rest, trash, buff, KO, DON…).

export type Trigger =
  | "OnPlay"
  | "WhenAttacking"
  | "ActivateMain"
  | "Main"
  | "OnKO"
  | "OnBlock"
  | "Counter"
  | "Trigger"
  | "YourTurn"
  | "OpponentsTurn"
  | "OnOpponentAttack"
  | "EndOfYourTurn"
  | "Passive"
  | "Unknown";

export type Keyword = "Rush" | "Blocker" | "DoubleAttack" | "Banish";

export type Target =
  | "self" // esta carta / "this Character"
  | "leader"
  | "chosenYourCharacter"
  | "chosenOpponentCharacter"
  | "chosenCharacter"
  | "allYourCharacters"
  | "allOpponentCharacters";

export type Duration =
  | "battle"
  | "turn"
  | "untilStartOfYourNextTurn"
  | "untilEndOfOpponentTurn";

export interface CardFilter {
  cardType?: string; // {Straw Hat Crew}
  costLte?: number;
  costGte?: number;
  powerLte?: number;
  powerGte?: number;
}

export type EffectAction =
  | { type: "draw"; n: number }
  | { type: "givePower"; target: Target; amount: number; duration: Duration }
  | { type: "giveCost"; target: Target; amount: number; duration: Duration }
  | { type: "ko"; target: Target; upTo: number; filter?: CardFilter }
  | { type: "rest"; target: Target; upTo: number; filter?: CardFilter }
  | { type: "setActive"; target: Target }
  | { type: "addDon"; n: number; state: "active" | "rested" }
  | { type: "giveDon"; target: Target; n: number; rested: boolean }
  | { type: "restDon"; n: number }
  | { type: "activateDon"; n: number }
  | { type: "trash"; from: "topDeck" | "hand" | "life"; n: number }
  | { type: "addToLife"; from: "topDeck" | "hand"; n: number }
  | { type: "lookTopAdd"; look: number; add: number; filter?: CardFilter }
  | { type: "play"; from: "hand" | "deck" | "trash"; upTo: number; filter?: CardFilter }
  | { type: "returnToHand"; target: Target; upTo: number; filter?: CardFilter }
  | {
      type: "returnToDeck";
      target: Target;
      upTo: number;
      where: "top" | "bottom";
      filter?: CardFilter;
    }
  | { type: "giveKeyword"; target: Target; keyword: Keyword }
  | {
      type: "restrict";
      target: Target;
      restriction: "cantKO" | "cantAttack" | "cantBlock" | "cantActivate";
    }
  | { type: "dealDamage"; n: number }
  | { type: "raw"; text: string }; // no parseado todavía

export interface EffectCost {
  restThisCard?: boolean;
  restDon?: number;
  trashFromHand?: number;
  trashFromLife?: number;
  returnDon?: number;
}

export interface EffectCondition {
  leaderType?: string;
  handLte?: number;
  handGte?: number;
  opponentDonGte?: number;
  yourDonGte?: number;
  raw?: string;
}

export interface ParsedEffect {
  trigger: Trigger;
  donRequirement?: number; // [DON!! x1] → 1
  oncePerTurn?: boolean;
  cost?: EffectCost;
  condition?: EffectCondition;
  actions: EffectAction[];
}

export interface ParsedCardEffects {
  code: string;
  effects: ParsedEffect[];
  /** % de acciones parseadas (no "raw"), para medir cobertura. */
  coverage: number;
}
