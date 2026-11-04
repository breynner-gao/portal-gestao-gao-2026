# Fluxo de Tecidos e Facção — Implementation Plan

> **For agentic workers:** Execute each task in order and verify it before moving on.

**Goal:** Integrate the current need-for-pieces panel with persistent fabric stock, purchase planning, production orders, faction returns, and projected/actual cost and loss.

**Architecture:** Preserve `linen-risk-panel-v150.js` and the existing `fabric-purchase-addon-v1.js` UI entry point. Add normalized Supabase tables and transactional RPCs for demand coverage and stock movements, plus a pure rules module and a persistence/UI adapter that reads the current piece-need snapshot. Keep local legacy data available for an explicit import; do not silently overwrite remote data.

**Tech Stack:** Existing vanilla JavaScript ES modules, Supabase PostgREST/RPC, PostgreSQL migrations, GitHub Actions/Node built-in test runner.

**Spec:** `docs/enxoval-fluxo-tecido-faccao-design.md`

## Global Constraints

- Work only on branch `portal-sgq`.
- Keep the existing piece-need calculation, filters, export, and current visual identity.
- Do not add secrets to browser code, GitHub files, or chat.
- Enable RLS on all new public tables; only active GAO members may read or mutate company fabric/cost data.
- Retain audit history for receipts, reservations, issues, returns, losses, and adjustments.
- No order may cover piece demand already covered by a non-cancelled order.
- Preserve estimate values on an order when catalog standards or prices later change.
- Never automatically import local legacy values into production; provide a preview and explicit confirm action.
- Verification must not create production orders or alter existing production records.

## Review Focus

1. Concurrent order generation for the same piece demand — database transaction/advisory lock must create only uncovered quantity.
2. Repeated or retried fabric issue/return requests — operation idempotency key must prevent duplicate stock movements.
3. Cancelled and closed orders — cancelled orders stop covering demand; closed orders remain in history and count as produced, not open.
4. Partial receipt/remittance/return — balance and projected purchasing must account separately for physical, reserved, incoming, issued, and returned meters.
5. Zero accepted pieces or missing actual quantities/costs — prevent division by zero and show an incomplete closeout instead of a false unit cost.

---

### Task 1: Pure workflow and costing rules

**Files:**
- Create: `fabric-workflow-rules-v1.mjs`
- Create: `tests/fabric-workflow-rules.test.mjs`
- Modify: `.github/workflows/rouparia-cloudflare-smoke.yml`

**Interfaces:**
- Export `normalizeFabricNumber(value)`, `calculateFabricCoverage(input)`, `calculateFabricOrderCost(input)`, and `calculateFabricLoss(input)`.
- Coverage input includes current piece demand, open order quantities, usable meters, reserved meters, and confirmed incoming meters.
- Cost input includes planned/accepted piece counts, planned/actual meters, effective fabric price per meter, faction unit/total cost, and extras.

- [ ] Add Node built-in tests for uncovered piece quantity, covered demand, purchase suggestion, partial stock release, actual cost per accepted piece, zero accepted quantity, and loss meters/value.
- [ ] Run the tests to confirm the new exports are missing.
- [ ] Implement only the pure calculations; use decimal values without implicit Brazilian-locale parsing in domain math.
- [ ] Run `node --test tests/fabric-workflow-rules.test.mjs` and `node --check fabric-workflow-rules-v1.mjs`.
- [ ] Expand workflow path filters and run the same rule tests in GitHub Actions.

### Task 2: Supabase schema and secure transactional operations

**Files:**
- Create: `supabase/migrations/20261104190000_fabric_workflow.sql`
- Create: `tests/fabric-workflow-migration.test.mjs`

**Interfaces:**
- Tables: `fabric_catalog`, `fabric_suppliers`, `fabric_lots`, `fabric_product_recipes`, `fabric_production_orders`, `fabric_production_order_items`, `fabric_stock_movements`, `fabric_faction_returns`.
- Every tenant-owned row has `organization_id`; track actors and timestamps.
- RPC: `fabric_create_orders_for_demand(p_as_of date, p_lines jsonb, p_idempotency_key text)` returns created/already-covered item counts and order IDs.
- RPC: `fabric_post_stock_movement(p_idempotency_key text, p_movement jsonb)` validates allowed transitions and records a movement exactly once.

- [ ] Add schema tests asserting foreign keys, status checks, unique idempotency keys, indexes, audit fields, and RLS.
- [ ] Apply migration only after reviewing the existing GAO membership authorization pattern; do not change existing tables or policies.
- [ ] Use transactional RPCs with row/advisory locks for order coverage and stock issue/return.
- [ ] Verify tables/functions/policies through read-only catalog queries and the migration's safe smoke calls; do not insert operational fixture data into production.
- [ ] Add migration file to GitHub and ensure CI checks its static invariants.

### Task 3: Bridge current piece demand to fabric recipes and order creation

**Files:**
- Modify: `linen-risk-panel-v150.js`
- Modify: `fabric-purchase-addon-v1.js`
- Create: `fabric-workflow-persistence-v1.js`
- Modify: `index.html`

**Interfaces:**
- Expose a read-only `window.GAO_LINEN_NEED_SNAPSHOT` from the existing panel; include as-of date and each product reference/name, suggested need, and already-at-faction count.
- Recipes map product reference and optional product name to fabric, meters per accepted piece, faction unit price, and optional extra unit cost.
- Adapter awaits `window.GAO_AUTH_READY`, uses the existing publishable key and current access token, and exposes a readiness/error state for the UI.

- [ ] Add a focused test that the piece-need bridge carries `pedidoReal` and excludes zero-need items.
- [ ] Keep the bridge read-only; it must not mutate or fabricate base rows.
- [ ] Replace manually keyed piece quantity entry with a selectable/suggested need list, while retaining a manual order option for emergency/unmapped products.
- [ ] Display recipe gaps clearly; block order generation if fabric or consumption is missing.
- [ ] Call transactional RPC for order creation and show returned covered/uncovered quantities.
- [ ] On first migration from browser storage, show counts and a preview; require explicit confirmation before import.
- [ ] Add cache-busted script references and validate module syntax.

### Task 4: Inventory, faction issue/return, costs, and loss screens

**Files:**
- Modify: `fabric-purchase-addon-v1.js`
- Modify: `fabric-workflow-persistence-v1.js`
- Modify: `fabric-workflow-rules-v1.mjs`
- Modify: `tests/fabric-workflow-rules.test.mjs`

**Interfaces:**
- Receipt rows link supplier, fabric, lot, quantity, effective purchase price, freight/other costs, and received quantity.
- Production orders retain estimate snapshots for material use and cost.
- Partial issues/returns reference an order line and use idempotency keys.

- [ ] Present physical free stock, reserved stock, confirmed incoming stock, demand, and purchase suggestion separately.
- [ ] Record partial issue to faction against a production order; reject issue above free balance.
- [ ] Record return counts (accepted/rejected), actual meters used, meters returned, faction cost, extras, and reason.
- [ ] Calculate and display planned/actual cost per piece, meters lost, loss percentage, and loss value; show incomplete when required actual data are absent.
- [ ] Add tests for repeated idempotency key, stock underflow, partial return, cancellation coverage, and loss/cost calculations.
- [ ] Run all fabric tests and SQL static checks.

### Task 5: Deployment and end-to-end verification

**Files:**
- Modify: `.github/workflows/rouparia-cloudflare-smoke.yml`
- Modify: `index.html` only if a final cache bump is required.

- [ ] Run all Node tests and syntax checks.
- [ ] Confirm the workflow catches the fabric files and migration.
- [ ] Push to `portal-sgq`; confirm GitHub Actions succeeds.
- [ ] Confirm Cloudflare serves the exact source files for the commit.
- [ ] Perform read-only smoke checks against production schema and authenticated read access where the connector permits.
- [ ] Report explicitly which browser/user-acceptance paths still require Breynner's operational confirmation.

