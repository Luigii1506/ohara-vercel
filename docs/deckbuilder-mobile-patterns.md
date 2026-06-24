# DeckBuilder Mobile-First Patterns

This document captures the mobile-first patterns and recent changes applied in
the deckbuilder so we can replicate them consistently in other sections.

## Why mobile first
- Most sessions happen on mobile, so the primary UI targets touch, small screens,
  and quick add/remove flows.
- Desktop enhancements should be additive, not required for core actions.

## Key UI patterns (reference implementations)
- Deck drawer (mobile): `components/deckbuilder/DeckBuilderDrawer.tsx`
  - Use a native-feeling sheet/drawer pattern.
  - Keep actions (save, reset, proxies) within thumb reach.
- Card preview dialog: `components/deckbuilder/CardPreviewDialog.tsx`
  - Bottom-sheet on mobile, centered dialog on desktop.
  - Includes add/remove buttons and quantity info.

## Card interaction rules
- Tap on card: adds a copy (if allowed).
- Eye button: opens preview dialog with card details.
- Plus/Minus: quick adjust for copies without opening the dialog.
- Price badge: always visible and never blocked by controls.

## Layout decisions
- FAB stays for opening the full deck drawer on mobile.
- Quantity controls should not overlay the card art or price.
  - Use a compact bar below the image (not overlaid).
- Stats view on mobile uses a single column for charts.

## Quantity limits
- Max per code:
  - Default: 4
  - Special: `OP08-072`, `OP01-075` allow 50
- Global deck limit: 50 cards

## Reusable logic
- Add card: `deckBuilder.handleAddCard(...)`
- Update quantity: `deckBuilder.updateDeckCardQuantity(cardId, newQuantity)`
- Total by code: `getTotalQuantityByCode(code)`
- Max by code: `getMaxQuantityForCode(code)`

## Component-specific notes
### Card list (mobile)
- Ensure the price badge is visible at all times.
- If quantity controls are shown, render them below the image.
- Eye button stays top-right of the image.

### Deck stats (mobile)
- Single column grids for better chart readability.
- Keep spacing compact but readable.

### Deck drawer
- Treat as primary mobile flow (save, reset, proxies, stats).
- Keep important controls within a single scroll.

## Do / Don't
Do:
- Keep prices readable without overlap.
- Prefer simple, thumb-friendly controls.
- Provide fast add/remove without extra steps.

Don't:
- Overlay controls that hide prices or card art.
- Require desktop-only actions for core flows.
