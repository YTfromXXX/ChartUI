# ChartUI

## Overview

This project is a market intelligence dashboard that mixes live charting, tarot/archetype visualization, and a 64-hexagram contest evaluation system. The app is designed around the following states:

- Unauthenticated visitor: can inspect public chart/market pages and the demo gallery.
- Authenticated observer: can access advanced portfolio and restricted analysis screens.

## Screen map

### 1. Public landing / login gateway
- Route: `/`
- Purpose: this is the entry screen for all users.
- Comment: unauthenticated users see the observer login form over the live command center and 3D tarot scene.
- Comment: after authentication, the app stores a session flag and redirects to the gallery.

### 2. Public gallery of major arcana cards
- Route: `/gallery`
- Purpose: a public market gallery with live or simulated arcana cards.
- Comment: this screen is visible before login and allows users to browse market archetypes.
- Comment: the gallery can transition into deeper chart pages by selecting a symbol.

### 3. Contest board for tactical evaluation
- Route: `/contest`
- Purpose: demonstrates the 64-hexagram contest board and the super-real knot visualization.
- Comment: this screen is designed for live demonstration and concept validation.
- Comment: it visualizes volatility pressure and tactic alignment across 8 x 8 blocks with 6 yao lines each.

### 4. Live symbol detail page
- Route: `/live/[symbol]`
- Purpose: a public or authenticated symbol detail view with charting and market context.
- Comment: unauthenticated users can still open a live market card for observation.

### 5. Strategy / knot analysis page
- Route: `/strategy/[symbol]`
- Purpose: presents a deeper strategy evaluation for a selected symbol.
- Comment: this is an advanced analysis surface generally tied to authentication.

### 6. Matrix / portfolio board
- Route: `/matrix`
- Purpose: organizes signals into a strategic matrix and supports active positioning.
- Comment: this is a higher-level analysis surface for authenticated observers.

### 7. Observer profile page
- Route: `/profile`
- Purpose: a private portfolio and identity overview.
- Comment: this is a protected style page that fits the authenticated experience.

## Local Setup

The repository contains a FastAPI backend and a Next.js frontend.

1. Create and activate the Python environment, then install the backend dependencies:

	```bash
	python -m pip install -r requirements.txt
	```

2. Copy the credential template in `.env` and set `MT5_LOGIN`, `MT5_PASSWORD`, and
	`MT5_SERVER`. Keep credentials out of source control. Set `USE_MT5=false` to use the
	cached CoinGecko fallback when MT5 is unavailable.

3. Start the FastAPI backend:

	```bash
	uvicorn main:app --reload --port 8000
	```

4. Install and start the Next.js frontend:

	```bash
	npm install
	npm run dev
	```

	The local WebSocket endpoint is configured in `.env.local` as
	`NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/signals`.

The unified market adapter is available through `market_aggregator.py`. It accepts one
entry from `UNIFIED_SYMBOLS` and returns a common `time, open, high, low, close, volume`
DataFrame. MT5, CoinGecko, and yfinance failures are isolated per symbol and return
`None`, so a provider outage does not stop the monitoring loop.

## Vercel Test Deployment

Import this repository into Vercel and use the default Next.js build settings. Configure
the following Vercel environment variable:

```text
NEXT_PUBLIC_WS_URL=wss://your-backend.example.com/ws/signals
```

The FastAPI server must be deployed separately on a WebSocket-capable host. Configure its
`BACKEND_CORS_ORIGINS` variable with the exact Vercel origin, for example:

```text
BACKEND_CORS_ORIGINS=https://your-project.vercel.app
```

For local testing, `BACKEND_CORS_ORIGINS=*` is accepted. The frontend uses the live
`chart_data`, `wuxing_phase`, and status fields from the WebSocket to render the command
center and M7 chart. When MT5 is unavailable, the backend falls back to CoinGecko with a
cache interval controlled by `COINGECKO_CACHE_SECONDS`.

## Auth.js and Symbol Streams

Auth.js is exposed at `/api/auth/[...nextauth]` with a JWT session and two Credentials
providers: `observer-credentials` delegates validation to FastAPI `/api/token`, while
`siwe` is a deliberate SIWE placeholder for nonce storage and signature verification.
Set `AUTH_SECRET` for production and `API_URL` when the Next.js server cannot reach the
backend at `http://localhost:8000`. Guests can still view charts; authenticated sessions
enable the advanced analysis state in `TarotSceneDemo` through `useSession`.

The live-symbol hook sends this message immediately after opening the socket:

```json
{"symbol":"DOGE-USD"}
```

Subscribed clients receive one `KNOT_UPDATE` JSON payload per second containing
`rsi_tension`, `tarot_attribute`, 15-second values, and `chart_data`. Clients that do not
send a subscription message retain the existing multi-symbol screener behavior.

## Authentication behavior notes

- Unauthenticated flow: the landing page shows the secure observer login card in front of the command center, and public gallery-only navigation remains available.
- Authenticated flow: session persistence is saved in browser storage and the app redirects into the richer gallery experience.
- Protection boundary: deeper portfolio and analysis screens are intended for authenticated user access, while public market observation remains available as an exploratory layer.
