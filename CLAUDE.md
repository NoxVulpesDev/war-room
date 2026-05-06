# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # Production build to /dist
npm run preview    # Preview production build locally
npm run deploy     # Build + deploy to GitHub Pages at /war-room/
```

## Architecture

**War Council** is a collaborative real-time battle map tool for tabletop RPG/wargaming. Players and admins place, move, and annotate military tokens on fantasy maps. React 19 + Vite frontend, Firebase (Auth + Firestore) backend, deployed to GitHub Pages.

### Source files

- `src/main.jsx` — Entry point, renders `<App />`
- `src/App.jsx` — Entire application (~1100 lines): auth flow, map rendering, token management, permissions, UI
- `src/AuthModal.jsx` — Login/signup modal with nation selection
- `src/firebase.js` — Firebase init + all Firestore operations

### Data flow

1. `onAuthStateChanged` → `getOrCreateUserProfile()` → stored in `userProfile` state
2. Map selection triggers `subscribeToTokens(sessionId, callback)` — real-time Firestore listener
3. Local token mutations go through `scheduleSave()` — debounced 1200ms → `saveTokens()` batch write

### Firestore schema

```
/sessions/{sessionId}/tokens/{tokenId}   — token collections, one per map
/users/{uid}                             — { role: "admin"|"player", nation, characterName }
```

### Token shape

```js
{
  id: string,
  faction: "player" | "enemy" | "contested",
  x: number,   // normalized 0–1
  y: number,   // normalized 0–1
  count: number,
  notes: string[],
  ownerId: uid | null,   // null for enemy tokens
  nation: "erin" | "manx" | "cymria" | "caledonia" | null,
}
```

### Maps & nations

Four maps in `/public/`: `Erin.jpg`, `Manx.png`, `Cymria.png`, `Cal.jpg`. Each map corresponds to a nation; players are assigned a nation at signup. Nation determines which map a player's tokens default to and where placement is restricted.

### Permissions

- **Admins** — can mutate any token, see enemy faction, manage all maps
- **Players** — can only edit tokens they own (`token.ownerId === uid`), cannot place on foreign-nation maps

### Key config

- `vite.config.js` — base path is `/war-room/` (required for GitHub Pages)
- `.env.local` — Firebase credentials (not committed); Firebase project ID: `war-room-81e5c`
- All styling is inline CSS inside components — no separate CSS files or preprocessor

## README maintenance

After any commit that modifies `src/App.jsx`, `src/firebase.js`, `src/AuthModal.jsx`, `src/AdminPanel.jsx`, `vite.config.js`, or `package.json`, review `README.md` and update any sections that are now out of date. Not every commit requires a README change — only update what has actually changed (schema, permissions, component APIs, constants, scripts, etc.). Do not rewrite sections that are still accurate.
