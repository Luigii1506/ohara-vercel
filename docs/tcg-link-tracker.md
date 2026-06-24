# TCGplayer Link Tracker Overview

This document describes how to maintain a local catalog of TCGplayer products and use it to detect which cards or sealed products in the OPCG database still need a TCGplayer link.

## Goals

1. Keep a local copy of every TCGplayer One Piece product (Cards: ~5.6k, Sealed: ~330).
2. Enable admins to see which catalog products are linked (`tcgplayerProductId` present), which are missing, and which have been removed.
3. Support both “Cards” and “Sealed Products”.
4. When a card is linked/unlinked from TCGplayer, reflect that change in the tracker.

## Data model

1. **`tcg_catalog_products` table** (new)
   - Stores all One Piece products from TCGplayer API.
   - Columns: `productId` (PK), `name`, `productType`, `url`, `sku`, `lastSyncedAt` etc.
2. **Existing tables**
   - `Card`: `tcgplayerProductId`, `tcgplayerLinkStatus`
   - `Product`/`Set` (whichever stores sealed items): ideally also has `tcgplayerProductId`.

## Synchronization workflow

### 1. Import full catalog

Create a script `scripts/sync-tcg-catalog.ts` that:
1. Authenticates with TCGplayer API (client ID/secret + OAuth token).
2. Fetches `/catalog/products` with filter `productLineName=one-piece-card-game` and `productTypeName` set to Cards or Sealed Products.
3. Paginates using `offset` + `limit=100` until all products are retrieved.
4. Upserts into `tcg_catalog_products`. Remove rows that no longer appear (if needed).

Run this nightly (cron) or from an admin panel button (“Re-sync catalog”).

### 2. Compare vs local data

Add API `/api/admin/tcg-sync-status?type=cards|sealed`. Steps:
1. Query `tcg_catalog_products` filtered by `productType`.
2. Left join on `Card.tcgplayerProductId` (or `Product/Set` for sealed).
3. Compute:
   - `linked`: `tcgplayerProductId` matches a catalog product.
   - `missing`: catalog product not linked to any card/sealed item.
   - `orphan` (optional): local card referencing a productId that is no longer in catalog.
4. Return paginated results (with search by product name/ID).

### 3. UI

Create `/admin/tcg-sync`:
1. Tabs/filters for `Cards` and `Sealed`.
2. For each tab, show:
   - Counters (“Faltan X de Y”).
   - Table (virtualized) listing `productId`, name, link to TCGplayer, link to Tcg Linker (maybe prefill), last sync timestamp.
   - Button “Re-sync catalog” (runs the import script).

### 4. Linking / unlinking hook

When a card is linked via Tcg Linker:
1. Update `Card.tcgplayerProductId` and `tcgplayerLinkStatus`.
2. Optionally, update `tcg_catalog_products` row (e.g., `linkedAt` timestamp) for auditing.
3. If a card is unlinked, clear `tcgplayerProductId` and update the tracker timestamp.

Implementation idea: create helper functions:
```ts
await markCardLinked(cardId, productId);
await markCardUnlinked(cardId);
```

Inside these functions:
- Run the existing Prisma update.
- Update `tcg_catalog_products` (optional fields `linkedCardId`, `linkedAt`, `linkedBy`). If one product can map to multiple cards might store a count instead.

## API details

### Import script
```bash
npx ts-node scripts/sync-tcg-catalog.ts --type=cards
npx ts-node scripts/sync-tcg-catalog.ts --type=sealed
```

Script parameters:
- `productTypeName`: Cards or Sealed Products.
- `limit`, `offset` managed internally.
- `lastSyncedAt` set after each run.

### Admin API
`GET /api/admin/tcg-sync-status?type=cards&search=...&page=1`
- Response includes `missing`, `linked`, `orphan`.
- `missing` array contains `productId`, `name`, `productType`, `url`, `lastSyncedAt`.

### Link hooks
Wherever Tcg Linker calls `/api/admin/cards/[id]/tcgplayer/link`, extend logic to also call a utility `auditCatalogLink(productId, cardId)` to mark it as linked. For sealed products (if linking via another page), do the same with the relevant table.

## UX flow

1. Admin visits `/admin/tcg-sync`.
2. Selects `Cards` or `Sealed`.
3. Sees the missing list (searchable) and can click “Open in TCGplayer”.
4. Click “Link in Tcg Linker” to go to the linker for that product (prefill code if possible).
5. Once linked, refresh to move it out of “missing”.

## Considerations

- Rate limits: TCGplayer API has request limits; throttle the import script accordingly (e.g., 20 req/min). For 5.5k products, use the `/catalog/products` endpoint once with pagination (approx 56 requests).
- Authentication: store the client ID/secret in env vars and generate tokens in the script.
- Data freshness: the nightly job is enough for daily changes. Manual `Re-sync catalog` can run on demand if you want immediate updates.
- Clean-up: optionally add cron job to delete rows for products not seen in last import.
- Extensibility: you can add more product types later (e.g., accessories) by reusing the same flow.

---
## Checklist

1. [ ] Add `tcg_catalog_products` table via migration.
2. [ ] Implement `scripts/sync-tcg-catalog.ts`.
3. [ ] Create admin API `/api/admin/tcg-sync-status`.
4. [ ] Build UI `/admin/tcg-sync` with tabs and tables.
5. [ ] Hook linking/unlinking code to update tracker metadata.
6. [ ] Add cron/job to run the catalog sync regularly (or button).
