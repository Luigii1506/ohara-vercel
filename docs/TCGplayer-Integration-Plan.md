# TCGplayer Integration Plan

## Overview
Implement a cohesive integration with the TCGplayer API that enables:

1. Fast public display of up-to-date card prices.
2. An administrative dashboard for linking local cards to TCGplayer catalog entries.
3. Automated price synchronization, history tracking, and alerting to drive market insights.

---

## 1. Schema & Data Model Enhancements

### 1.1 Card table (existing)
- Fields to add:
  - `tcgplayerProductId` (string, nullable) – stores the TCGplayer product identifier once a card is linked.
  - `marketPrice`, `lowPrice`, `highPrice` (decimal, nullable) – snapshot of the latest prices.
  - `priceUpdatedAt` (DateTime) – timestamp for the last successful price refresh.
- Existing fields leveraged:
  - `tcgUrl`: remains the canonical link to the TCGplayer product page.

### 1.2 CardPriceLog (existing but unused)
- Purpose: record every significant price update for historical analysis.
- Suggested schema:
  - `id`, `cardId`, `priceType` (enum: market/low/high/other), `price` (decimal), `source` (string, default `"TCGplayer"`), `collectedAt` (DateTime), `createdAt`.
- Append log entries only when a price value changes beyond a minimal delta to reduce noise.

### 1.3 Optional: CardPriceAlert (new table)
- Fields:
  - `id`
  - `cardId`
  - `userId` (optional now, add later if multi-user alerts are needed)
  - `thresholdType` (enum: `ABOVE_VALUE`, `BELOW_VALUE`, `PERCENT_CHANGE`)
  - `thresholdValue` (decimal)
  - `percentWindowHours` (int, for percent-change alerts)
  - `notificationMethod` (`EMAIL`, `SLACK`, `IN_APP`, etc.)
  - `isActive` (boolean)
  - Timestamps
- Enables alerting when a price crosses a configured value or changes by a certain percentage.

### 1.4 Optional: Watchlist flag
- Add `isWatchlisted` (boolean) to `Card`, or create a `CardWatchlist` table if you need per-user watchlists.
- Used to trigger more frequent price refreshes for critical cards.

---

## 2. TCGplayer API Client & Token Handling

### 2.1 Configuration
- Store `TCGPLAYER_PUBLIC_KEY` (client_id) and `TCGPLAYER_PRIVATE_KEY` (client_secret) in environment variables.

### 2.2 Token service
- Build `lib/services/tcgplayerClient.ts` that:
  1. Requests a bearer token via `POST https://api.tcgplayer.com/token` using the client credentials.
  2. Caches the token and its expiry in memory (or Redis if needed). Refresh automatically when near expiry.
  3. Exposes helper methods for making authenticated requests to TCGplayer endpoints (e.g., `getProducts`, `getPricing`).

### 2.3 API endpoints used initially
- `GET /catalog/products` – search by name, set, category.
- `POST /catalog/products/list` – fetch details for specific product IDs.
- `GET /pricing/product/{productIds}` – retrieve pricing info for multiple products in one call.

---

## 3. Admin Linking Dashboard

### 3.1 UI structure (new page under `/admin/tcg-linker` or similar)
- **Left panel**: Local card selector/search (by name, code, set). Selecting a card loads its details.
- **Right panel**: TCGplayer search & results:
  - Auto-query using the card’s metadata (name, code, set).
  - Filters for category, set, language.
  - Display candidate matches with image, product name, set name, productId, price snapshot.
  - “Link” button to associate the card with the selected product (stores `tcgplayerProductId`, `tcgUrl`).
  - “Unlink” button to remove association if incorrect.

### 3.2 API support
- `/api/admin/tcgplayer/search` – proxies search parameters (name, setCode, categoryId) to TCGplayer and returns candidates.
- `/api/admin/cards/:id/link` – persists `tcgplayerProductId`, `tcgUrl`, resets price snapshot (will refresh next cron run).
- `/api/admin/tcgplayer/products/:id` – fetches details for a linked product for display when revisiting a card.

---

## 4. Price Synchronization Jobs

### 4.1 Nightly (primary) job
- Trigger (cron or serverless scheduler) runs once per day (or more often if needed, e.g., every 12 hours).
- Steps:
  1. Query all cards with `tcgplayerProductId`.
  2. Chunk product IDs (e.g., batches of 100–200) to call `GET /pricing/product/{ids}`.
  3. For each card:
     - Compare fetched prices with cached snapshot (`marketPrice`, `lowPrice`, etc.).
     - If changed, update snapshot fields and append `CardPriceLog` entries.
  4. After updates, run alert evaluation (see section 5).
- Resilience:
  - Handle token expiration by retrying with a refreshed token.
  - Log failures per card and continue.

### 4.2 Optional “mini job” for watchlisted cards
- Run every few hours for cards where `isWatchlisted = true` (or from a dedicated watchlist table).
- Same logic as the nightly job but only for the smaller subset, ensuring near-real-time updates for high-priority cards.

### 4.3 On-demand refresh
- Admin UI button per card to fetch the latest price immediately (calls pricing endpoint for that product only, updates cache/log).

---

## 5. Price Alerts & Notifications (Optional but recommended)

### 5.1 Alert evaluation
- After each price refresh (nightly or mini job), run checks:
  - For each active `CardPriceAlert`, determine if the new price meets the condition (e.g., crosses threshold or % change over a window).
  - Percentage change requires comparing with price `percentWindowHours` ago (fetch from `CardPriceLog`).

### 5.2 Notifications
- For each triggered alert, enqueue a notification (e.g., email via existing mailer, Slack webhook, or store in an `AdminNotification` table for in-app display).
- Record the trigger event to avoid duplicate notifications until the condition resets.

### 5.3 Alert management UI
- Admin page listing alerts with filters (active, triggered recently).
- Form to create/edit alerts per card:
  - Choose threshold type (value or percentage).
  - Input target value/percent.
  - Select notification channel.
  - Toggle watchlist flag from same view if desired.

---

## 6. Admin Market Dashboard

### 6.1 Dashboard components
- **Overview cards**: total linked cards, % linked, last refresh time, number of watchlisted cards.
- **Top movers**: list of cards with largest % increase/decrease over last 24h/7d (derived from `CardPriceLog`).
- **Alerts panel**: active alerts, recent triggers.
- **Search card detail**: show sparkline of last 30 days (from `CardPriceLog`), current price, set info, quick link to TCGplayer.

### 6.2 Data queries
- Sparkline: select last N entries for a card’s `marketPrice` from `CardPriceLog`.
- Movers: compute % change between latest price and price 24h ago.
- Alerts: join `CardPriceAlert` with cards to show statuses.

---

## 7. Public Site Integration

- Use snapshot fields on `Card` for all price displays (no direct TCGplayer calls client-side).
- Show `marketPrice` + last updated timestamp on relevant pages (collection, deck builder, card detail, etc.).
- Optionally add a tooltip noting “Prices provided by TCGplayer” for attribution.

---

## 8. Security & Ops Notes

- **Key storage**: Keep `TCGPLAYER_PUBLIC_KEY` and `TCGPLAYER_PRIVATE_KEY` in secure env variables; never expose `PRIVATE_KEY` to the client.
- **Rate limiting**: Monitor TCGplayer API usage; adjust batch sizes/cron frequency accordingly.
- **Error monitoring**: Log failed API calls and alert when the nightly job misses a run.
- **Caching**: Consider storing the bearer token in Redis if multiple workers need to reuse it.

---

## 9. Implementation Checklist

1. **Schema migration**
   - Add fields: `tcgplayerProductId`, price snapshots, optional watchlist flag.
   - Finalize `CardPriceLog` schema and optional `CardPriceAlert` table.
2. **Token client**
   - Implement bearer token caching helper.
3. **Admin linking UI**
   - Card selector + TCGplayer search results + link/unlink actions.
4. **Backend routes**
   - `/api/admin/tcgplayer/search`, `/api/admin/tcgplayer/products/:id`, `/api/admin/cards/:id/link`.
5. **Price sync job**
   - Nightly cron + optional watchlist job; update snapshots & logs.
6. **Alerts subsystem (optional)**
   - Model, evaluation logic, notifications.
7. **Admin dashboard**
   - Overview widgets, movers, alerts, card detail view.
8. **Public UI updates**
   - Display prices from cached fields with attribution.
9. **Testing & monitoring**
   - Unit tests for TCGplayer client, cron job, alert triggers.
   - Monitoring for job success/failures.

---

## 10. Future Enhancements
- Import additional metadata from TCGplayer (rarity, sku) to enrich local cards.
- Support multi-currency pricing if the API provides it.
- Add user-specific watchlists/alerts.
- Integrate real-time websockets or push notifications for instant admin alerts.

