# Exile Insight

## Overview
A Path of Exile 2 trade and crafting advisor web application. Users paste item text (from Ctrl+C in game) and receive instant parsing, evaluation, and crafting/trade advice powered by poe.ninja market data.

## Architecture
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL via Drizzle ORM
- **Styling**: Dark PoE-inspired theme (gold/amber accent on dark blue-gray background)

## Key Features
1. **Item Advisor** - Paste PoE2 clipboard text, get parsed item display and evaluation
2. **Build Fit Analysis** - Analyzes item mods against 10 build archetypes (Lightning/Fire/Cold Caster, Physical Melee, Bow/Ranged, DoT, Minion, Tank, etc.) with confidence ratings and poe.ninja build links
3. **Market Prices** - Live currency and unique item prices from poe.ninja
4. **Saved Items** - Collection of analyzed items
5. **Build Weights** - Configure stat importance per build profile (affects item scoring)
6. **Meta Bases** - Configure which item bases are considered top-tier for crafting

## Project Structure
- `client/src/pages/` - Home (item advisor), Market, SavedItems, BuildWeights, MetaBases
- `client/src/components/` - AppSidebar, ItemDisplay, TradeListings
- `client/src/lib/item-parser.ts` - Client-side item text parser
- `server/parser.ts` - Server-side item parser
- `server/evaluator.ts` - Item evaluation engine
- `server/ninja.ts` - poe.ninja API proxy with caching + trade search
- `server/seed.ts` - Database seed data (meta bases + build profiles)
- `server/db.ts` - Database connection
- `shared/schema.ts` - Drizzle schema + TypeScript types

## API Routes
- `POST /api/evaluate` - Parse and evaluate item text
- `POST /api/trade/search` - Generate trade search suggestions with links to trade site and poe.ninja
- `GET /api/ninja/currency/:league` - Get currency prices
- `GET /api/ninja/uniques/:league` - Get unique item prices
- `GET/POST/DELETE /api/items` - Saved items CRUD
- `GET/POST/PATCH/DELETE /api/profiles` - Build profiles CRUD
- `POST /api/profiles/:id/activate` - Set active build profile
- `GET/POST/DELETE /api/bases` - Meta bases CRUD

## Database Tables
- `users`, `build_profiles`, `saved_items`, `meta_bases`

## Known Constraints
- PoE2 trade API (pathofexile.com) blocks server-side requests with Cloudflare 403
- poe.ninja PoE2 item API doesn't provide accessible endpoints for unique/rare items
- Trade section provides search suggestions and direct links instead of fetching actual listings
- Current PoE2 league: "Fate of the Vaal" (slug: "vaal")
- poe.ninja PoE2 currency API: /poe2/api/economy/exchange/current/overview

## Recent Changes
- 2026-02-15: Added Build Fit Analysis with 10 archetypes, confidence ratings, and poe.ninja build links
- 2026-02-15: Removed misleading fake price estimates for rare items; now directs to trade site with stat filters
- 2026-02-15: Enhanced Trade & Market UI with bordered stat filter container, instruction box, and filter count badge
- 2026-02-15: Added two-column evaluation layout, trade listings component with search suggestions and links to trade site/poe.ninja
- 2026-02-15: Updated market page default league to "Fate of the Vaal", added logo to sidebar
- 2026-02-15: Added actionable verdicts (Sell/Craft/Keep/Vendor) with crafting steps, trade advice, and mod value quality scoring
- 2026-02-15: Initial MVP build with all core features
