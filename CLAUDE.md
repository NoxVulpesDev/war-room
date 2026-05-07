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

### Source layout

```
src/
  main.jsx                     Entry point
  App.jsx                      Top-level component (~580 lines): composes hooks,
                               owns token interaction handlers, renders layout
  AuthModal.jsx                Login/signup modal with nation selection
  AdminPanel.jsx               Admin UI: user management, global settings
  firebase.js                  Firebase init + all Firestore operations
  constants.js                 MAPS, FACTIONS, NATIONS, TOKEN_RADIUS,
                               MERGE_THRESHOLD, SAVE_DEBOUNCE
  utils.js                     dist(), getMapLayoutBounds(), getMapScreenBounds(),
                               generateId(), findMergeTarget()
  hooks/
    useAuth.js                 Auth state, userProfile, role flags
                               (isAdmin, isMonarch, isPlayer, isAdminMode)
    useFirestoreTokenSync.js   Token state, real-time Firestore listener,
                               debounced save pipeline, saveStatus
    useMapZoomPan.js           zoom/pan state, wheel/mouse/touch gestures,
                               canvas resize observer
    useHistoryTimeline.js      history fetch, timeline open/close, scrub index,
                               replay snapshot projection
  components/
    MapHeader.jsx              Top toolbar (map select, mode/faction, zoom,
                               save status, role badge, sign-out)
    TokenLayer.jsx             Token rendering loop + warning banners
    TokenPanel.jsx             Slide-out detail panel (count, notes, split, delete)
    KnotCorner.jsx             Decorative SVG corner ornament
    MovementArrows.jsx         SVG overlay: arrows + ghost circles for timeline replay
    TimelineBar.jsx            Timeline scrubber UI with timestamps and step controls
```

### Data flow

1. `useAuth` — `onAuthStateChanged` → `getOrCreateUserProfile()` → `userProfile` state + role flags
2. `App.jsx` — `useEffect` watches `userProfile.nation`; auto-selects home map on first login
3. `useFirestoreTokenSync` — `subscribeToTokens(sessionId)` real-time listener; local mutations go through `setTokensAndSave()` → 1200ms debounce → `saveTokens()` batch write
4. `useMapZoomPan` — owns all zoom/pan/gesture state; exposes `zoomRef`/`dragPanRef` so `App.jsx` canvas handlers can read current values without stale closures

### Firestore schema

```
/sessions/{sessionId}/tokens/{tokenId}   — one collection per map (sessionId = map ID)
/sessions/{sessionId}/history/{entryId} — { timestamp, actorId, actorName, actionType,
                                           description, snapshot: {tokenId: tokenData} }
/users/{uid}                             — { role, nation, displayName, maxTokens, ... }
/config/global                           — { defaultMaxTokens }
```

### Token shape

```js
{
  id:      string,
  faction: "player" | "enemy" | "contested",
  x:       number,   // normalized 0–1 relative to map image width
  y:       number,   // normalized 0–1 relative to map image height
  count:   number,
  notes:   string[],
  gmNotes: string[],     // admin-only; never shown to players
  ownerId: uid | null,   // null for admin-placed enemy tokens
  nation:  "erin" | "manx" | "cymria" | "caledonia" | null,
}
```

### Maps & nations

Four maps in `/public/`: `Erin.jpg`, `Manx.png`, `Cymria.png`, `Cal.jpg`. Defined in `constants.js` (`MAPS`, `NATIONS`). Nation determines default map on login and where a player may place tokens.

### Permissions

- **Admins** — full access when `adminMode` is toggled on; without it they have player-level restrictions
- **Monarchs** — can remove any note; otherwise same as commander
- **Commanders** — can only edit their own tokens; cannot place on foreign maps or place enemy tokens

Role flags (`isAdmin`, `isMonarch`, `isPlayer`, `isAdminMode`) live in `useAuth.js`. `canMutateToken()` and `canPlaceFaction()` live in `App.jsx`.

### Key config

- `vite.config.js` — base path is `/war-room/` (required for GitHub Pages)
- `.env.local` — Firebase credentials (not committed); Firebase project ID: `war-room-81e5c`
- Styling is mostly inline CSS in components; `src/App.css` holds a few shared classes (`.counter`, etc.), `src/index.css` has global resets; shared toolbar classes (`.toolbar-btn`, `.mode-btn`, etc.) are in a `<style>` block in `App.jsx`

## README maintenance

After any commit that modifies `src/App.jsx`, `src/firebase.js`, `src/AuthModal.jsx`, `src/AdminPanel.jsx`, `src/constants.js`, `src/utils.js`, any file under `src/hooks/`, any file under `src/components/`, `vite.config.js`, or `package.json`, review `README.md` and update any sections that are now out of date. Not every commit requires a README change — only update what has actually changed (schema, permissions, component APIs, constants, scripts, etc.). Do not rewrite sections that are still accurate.

## Player guide maintenance

After adding or changing any user-facing feature, review both:

- `PLAYER_GUIDE.md` — the standalone markdown guide (Commander, Monarch, Admin sections)
- `src/components/HelpModal.jsx` — the in-app help modal (same role-based structure)

Update whichever sections are affected. Both files should stay in sync with each other and with the actual feature set. Not every commit needs a guide change — only update when behavior visible to players or admins has changed (new controls, changed permissions, new UI elements, removed features, etc.).
