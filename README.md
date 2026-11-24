# Deep Lake

Hackathon prototype of a liquidity network that makes tokenized deposits, stablecoins and fiat interchangeable. All banks, market makers, quotes and balances are simulated.

- `index.html` — the public site. Interactive water surface; one call to action: enter the Deep Lake.
- `app.html` — the app. Swap and routing, a draggable route planner, quote board, settlements, reports, rails, compliance, rulebook and a market maker desk.
- `assets/app.css`, `assets/app.js` — app styles and logic. No build step, no dependencies.

Open `index.html` in a browser, or serve the folder with any static host (GitHub Pages works as is).

## Demo path

1. Swap → `$15M` → shows a fill split across three market makers plus the issuer backstop.
2. Swap → "I pick" → choose a pricier partner → the quote shows what the pick costs over the best route.
3. Demo controls → "Market maker declines the fill" → bond slashed, Deep Lake re-routes.
4. Send USDC → fiat with "Fiat confirmation never arrives" → both legs return.
5. Send to "Tokenized deposit · Granite FCU" → pick another CTS network instead of Deep Lake.
6. Route a payment → Acme Bank sends $75,000 in tokenized deposits to a credit union that is not on a blockchain. Drag the handles to trade cost for speed, then Send. "Add recipient" opens an onboarding form for bank details and wallets; the route adapts to what the recipient can receive.
7. Market maker desk → change a fee or post a channel → it appears on the bank's next quote.
