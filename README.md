# Global Offensive: Case Simulator

A web-based CS2 case opening simulator with a zero-to-hero progression system. Start with nothing, open cases, build your inventory, and try to profit (spoiler: the house always wins).

## What is this?

It's a risk-free way to experience the thrill (and heartbreak) of CS2 case openings without spending real money. Open free starter cases, sell skins to build up your balance, and work your way up to the high-roller cases.

### Features

- **39 cases** across price tiers from free to $5,000
- **Horizontal roulette animation** with proper easing and tick sounds
- **Real CS2 skins** pulled from the [ByMykel CSGO API](https://github.com/ByMykel/CSGO-API)
- **Skin wear system** — Factory New, Minimal Wear, Field-Tested, Well-Worn, Battle-Scarred
- **StatTrak™** — 10% chance on any drop, 3× price multiplier
- **XP & leveling** — unlock better free cases as you level up
- **Case battles** — 1v1, 1v2, or 1v3 against bots
- **Skin Roulette** — wager skins on a Red/Black/Green wheel
- **Upgrader** — risk a skin for a multiplied balance payout
- **Crash** — bet balance on a rising multiplier, cash out before it crashes
- **Mobile responsive** — all game modes playable on small screens
- **Inventory management** — sort, sell individual items, or bulk sell
- **Persistent progress** — everything saves to localStorage

### Drop odds

Uses the official CS2 rarity weights:

| Rarity               | Chance |
| -------------------- | ------ |
| Blue (Mil-Spec)      | 79.92% |
| Purple (Restricted)  | 15.98% |
| Pink (Classified)    | 3.19%  |
| Red (Covert)         | 0.64%  |
| Gold (Extraordinary) | 0.26%  |

Some free cases restrict which rarities can drop, and expensive cases have slightly boosted rare odds — but they're all still negative EV.

## Getting started

You'll need Node.js 18+.

```bash
# install dependencies
npm install

# start dev server
npm run dev

# run tests
npm test

# build for production
npm run build
```

The dev server runs on `http://localhost:5173` by default.

## Tech stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4
- Framer Motion (roulette animation)
- Vitest + Testing Library

## Project structure

```
src/
  api.ts          — skin fetching & filtering
  engine.ts       — roulette generation, pricing, XP math
  constants.ts    — rarity weights, colors, pool limits
  types.ts        — TypeScript types
  audio.ts        — tick/win sound effects
  App.tsx         — case definitions & main app logic
  components/
    CaseSelector    — case grid with tier badges
    CaseDetailModal — odds breakdown & skin preview
    OpeningModal    — roulette animation (single & multi-open)
    Roulette        — standalone roulette strip
    CaseBattle      — PvE case battle mode
    SkinRoulette    — Red/Black/Green wheel betting
    Upgrader        — skin upgrade with risk meter
    Crash           — rising multiplier crash game
    Dashboard       — balance, level, XP bar
    Inventory       — skin grid with sorting & selling
  hooks/
    useGameState    — localStorage-backed state
    useSkins        — API data fetching
  test/
    engine.test.ts
    gameState.test.ts
    components.test.tsx
```

## How it works

1. Skins are fetched once from the ByMykel API on load
2. Each case deterministically selects a curated pool (~18 skins) using the case ID as a seed
3. Opening a case generates a 50-item roulette strip with weighted random rarity picks — the 48th item is always the winner
4. Sell prices are randomized within rarity-based ranges, then modified by wear condition, StatTrak status, and the case's sell multiplier
5. All cases are designed to be negative EV, so on average you'll lose money.

## License

This is a personal project / simulator. Not affiliated with Valve or Counter-Strike.
