# Laboratorio de Simulación de Partidas (One Piece TCG)

Documento de referencia para construir la nueva funcionalidad de simulación libre/replay dentro de **oharatcg**. Aquí se concentran los requerimientos, arquitectura y plan de implementación para que cualquier colaborador pueda retomar el trabajo en cualquier momento.

---

## 1. Objetivo y Alcance

1. Permitir practicar jugadas o recrear partidas pasadas **sin restricciones de reglas**, manipulando ambos lados del tablero manualmente.
2. Proveer herramientas para **spawn**, mover, girar, duplicar y eliminar cartas de cualquier zona.
3. Facilitar la **carga de mazos propios** o la importación de datos de un game log para recrear escenarios.
4. Ofrecer un sistema de **snapshots/escenas** para documentar turnos o compartir jugadas.
5. Mantener todo el MVP en el **cliente** (Zustand + TanStack Query + IndexedDB) y dejar preparado el camino para persistencia con Prisma más adelante.

> Fase actual: diseño + implementación inicial del simulador (UI + estado + interacciones básicas). Persistencia server-side es backlog.

---

## 2. Terminología y Componentes

- **Zona**: espacio del tablero (líder, front row, back row, DON!!, mano, cementerio, vida, notas).
- **Instancia de Carta**: objeto que representa una carta colocada en una zona. Incluye ID único local, referencia a la carta real y estado visual (descansada, contadores, notas).
- **Snapshot**: captura serializada del estado completo del tablero (todas las zonas + perspectiva activa + dueño del turno + metadatos).
- **Perspectiva**: vista activa (`player` u `opponent`). Cambiarla “rota” el tablero para que sea cómodo jugar ambos lados sin duplicar lógica.

---

## 3. Requerimientos Funcionales

1. **Práctica libre**
   - Insertar cualquier carta desde un buscador/filtros ya existentes.
   - Arrastrar entre zonas, duplicar, borrar, editar contadores y estado (rested/active, vida, DON disponible).
   - Resets rápidos que limpian todas las zonas excepto líderes seleccionados.
2. **Repetición de partidas**
   - Consumir `/api/logs/[id]` para precargar deck utilizado, líder rival y notas de la partida original.
   - El usuario manualmente recrea cada turno guardando snapshots por turno/jugada.
3. **Modo Deck Practice**
   - Importar mazos propios (API decks) y colocarlos en zona “Deck”.
   - Generar mano inicial aleatoria (opcional) y permitir mulligans ilimitados.
4. **Snap/Timeline**
   - Guardar snapshots etiquetados (Turno 1, Jugada clave, etc.), listarlos en panel lateral y restaurarlos al seleccionarlos.
   - Exportar/Importar snapshots como JSON.
5. **Perspectiva doble**
   - Toggle que intercambia el lado visible del tablero.
   - Ambos lados pueden realizar acciones; no existe restricción de turnos.
6. **UX Adicional**
   - Contadores globales: turno actual, DON disponible, vidas restantes por lado.
   - Notas rápidas adheridas a zonas o snapshots.

---

## 4. Arquitectura UI

### 4.1 Layout General
- Ruta nueva: `app/(app)/simulator/page.tsx` (usa el mismo layout protegido que deckbuilder/logs).
- Distribución: **dos columnas**
  - Izquierda: tablero (zonas del jugador activo en la parte inferior, oponente arriba).
  - Derecha: panel utilitario con buscador/filtros, herramientas rápidas, snap timeline y opciones de importación.

### 4.2 Tablero y Zonas
- Zonas básicas por lado:
  - Líder, Stage, Front Row (5 slots), Back Row (5 slots).
  - Zona DON!! con contador y lista de cartas DON arrastrables.
  - Mano (lista horizontal scrollable), Cementerio, Vida (lista de cartas bocabajo con labels), Notas.
- Layout responsivo: en desktop se muestran ambas mitades completas; en tablet/mobile se colapsan zonas poco usadas.
- Cada zona es un **drop container** de `@dnd-kit`, capaz de recibir instancias de carta y ordenarlas.

### 4.3 Panel de Herramientas
- **Buscador/Filtros**: reaprovechar `FiltersSidebar` + `LazyImage` + `CardModal` para spawn manual.
- **Deck/Log Import**:
  - Select de deck → crea pila “Deck” con las cartas ordenadas.
  - Input para ID de log → fetch `/api/logs/[id]` y prellenar metadatos.
- **Snapshots**:
  - Lista de escenas con botones `Reproducir`, `Duplicar`, `Eliminar`.
  - Botón global `Guardar estado actual`.
- **Opciones rápidas**: toggles de perspectiva, set turn owner, limpiado de tabla, etc.

### 4.4 Perspectiva
- Toggle principal (`Switch` + labels “Mi lado” / “Oponente”).
- El tablero siempre renderiza **ambos sets de zonas**, pero la clase `flex-col` o `flex-col-reverse` cambia según `activePerspective`.
- Indicador visual del turno (borde brillante, badge en líder activo, etc.).

---

## 5. Estado Global (`useSimulatorStore`)

```ts
type Side = "player" | "opponent";

interface CardInstance {
  uid: string;              // uuid local
  cardId: number;           // referencia a Card.id
  zoneId: ZoneId;           // zona actual
  owner: Side;              // dueño
  rested: boolean;
  counters: number;
  notes?: string;
  customLabel?: string;     // para tokens o cartas proxy
}

interface ZoneState {
  id: ZoneId;
  owner: Side;
  name: string;
  capacity?: number;
  cardUids: string[];
  metadata?: Record<string, unknown>;
}

interface Snapshot {
  id: string;
  label: string;
  createdAt: number;
  state: SimulationState;
  note?: string;
}

interface SimulationState {
  zones: Record<ZoneId, ZoneState>;
  cards: Record<string, CardInstance>;
  life: Record<Side, number>;
  donAvailable: Record<Side, number>;
  turnOwner: Side;
  activePerspective: Side;
  importedDeckId?: number;
  importedGameLogId?: number;
}

interface SimulatorStore extends SimulationState {
  spawnCard(card: CardWithCollectionData, zoneId: ZoneId, owner: Side): void;
  moveCard(uid: string, targetZoneId: ZoneId, position?: number): void;
  toggleRest(uid: string): void;
  updateCounters(uid: string, delta: number): void;
  removeCard(uid: string): void;
  cloneCard(uid: string): void;
  resetBoard(options?: { keepLeaders?: boolean }): void;
  setPerspective(side: Side): void;
  swapPerspective(): void;
  setTurnOwner(side: Side): void;
  updateLife(side: Side, delta: number): void;
  setDon(side: Side, value: number): void;
  createSnapshot(label?: string, note?: string): void;
  loadSnapshot(snapshotId: string): void;
  deleteSnapshot(snapshotId: string): void;
  importDeck(deckId: number): Promise<void>;
  importGameLog(logId: number): Promise<void>;
}
```

> Persistencia aún no incluida; se puede añadir con `zustand/middleware` + IndexedDB una vez que el flujo base esté estable.

---

## 6. Integraciones

1. **Catálogo de cartas**
   - Reaprovechar el hook que alimenta `CardModal`/`FiltersSidebar`.
   - Acciones de spawn usan los datos ya cacheados; no se esperan nuevos fetch.
2. **Deckbuilder**
   - Endpoint existente para obtener un deck (`/api/decks/[id]` o SSR) → se traduce a lista ordenada y se inyecta en la zona “Deck”.
3. **Game Logs**
   - Reutilizar `GET /api/logs/[id]` para obtener deck usado, líder rival, comentarios.
   - Guardar `importedGameLogId` en el store para tracking.
4. **Componentes compartidos**
   - `FiltersSidebar`, `CardModal`, `LazyImage`, `NavBar`.
   - `@dnd-kit` ya presente → crear wrappers `SimulatorDragContext` y `SimulatorDropZone`.
5. **Utilidades existentes**
   - Hooks de TanStack Query + IndexedDB, Toasts globales para feedback, layout base de `/app/(app)`.

---

## 7. Plan de Implementación (Milestones)

1. **Setup de ruta y layout**
   - Crear `app/(app)/simulator/page.tsx`.
   - Importar `NavBar`, asegurar protección de sesión si aplica.
2. **Store + tipos**
   - Crear `store/simulatorStore.ts` con tipos anteriores y acciones mínimas (`spawnCard`, `moveCard`, `removeCard`, `resetBoard`, `setPerspective`, `setTurnOwner`).
3. **Render básico del tablero**
   - Componentes `SimulatorBoard`, `SimulatorZone`, `PerspectiveToggle`.
   - Mostrar placeholders para cada zona y permitir spawns manuales (sin drag aún).
4. **Integración con filtros/catálogo**
   - Panel lateral que reutiliza `FiltersSidebar` o versión simplificada para seleccionar cartas.
   - Botones “Agregar al lado amigo/enemigo”.
5. **Drag & Drop con @dnd-kit**
   - Contenedor global para ambas mitades.
   - Soportar mover cartas, duplicar con atajos y borrar arrastrando a un “trash dropzone”.
6. **Contadores y estado visual**
   - UI para rested/active, counters, notas rápidas.
7. **Snapshots**
   - Panel con lista, guardar/restaurar y exportar JSON (clipboard / download).
8. **Import Deck + Log**
   - Buttons para fetch de deck/log y mapeo a zonas correspondientes.
   - Preload de datos contextual (líder, nombre de oponente, comentarios).
9. **Pulido UX**
   - Resets parciales (solo mesas, solo DON, etc.).
   - Atajos de teclado para robar cartas, avanzar turno, cambiar perspectiva.
10. **Backlog (fase futura)**
    - Persistencia Prisma (`SimulationScenario`).
    - Compartir snapshots por URL (`/simulator?s=base64`).
    - Modo historia (narración paso a paso con multimedia).

Cada milestone debe cerrar con checklist de pruebas manuales y, si aplica, pruebas unitarias ligeras para utilidades puras.

---

## 8. Checklist de Pruebas Manuales (Base)

1. **Spawn manual**: seleccionar carta, elegir lado/ zona, confirmar que aparece con imagen correcta.
2. **Movimiento**: arrastrar carta entre zonas múltiples veces, confirmar actualización de estado.
3. **Perspectiva**: cambiar toggle y comprobar que zonas se reorganizan, que los datos permanecen intactos.
4. **Turno activo**: setear turno para cada lado y validar indicadores visuales.
5. **Snapshots**: guardar dos estados distintos, restaurarlos y verificar que todo (incluida perspectiva y DON) se conserva.
6. **Import Deck**: seleccionar deck, revisar que las cartas aparezcan en la pila “Deck” en orden correcto.
7. **Import Log**: cargar log válido, revisar que datos meta se reflejen en panel auxiliar.
8. **Reset**: limpiar tablero, confirmando que las cartas desaparecen y contadores se reinician.

---

## 9. Backlog / Ideas Futuras

- Guardar escenarios en DB para compartir y versionar jugadas.
- Modo “tutorial” con texto, imágenes o video por snapshot.
- Integrar `html2canvas` para exportar capturas del tablero.
- Compartir snapshots via links firmados o códigos QR.
- Integrar dados virtuales, contadores personalizados, tokens editables (no necesariamente cartas).
- Sincronizar con reproductor de logs reales cuando exista data estructurada por turnos.

---

Este documento debe actualizarse a medida que avancemos. Usa secciones 7 y 8 para llevar control del progreso y las pruebas pendientes. Cualquier cambio estructural en el store, en los tipos o en la UI debe reflejarse aquí antes o justo después de codificar, para mantener la trazabilidad del proyecto.

