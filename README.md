# War Council — Developer Reference

A collaborative real-time battle map tool for tabletop RPG/wargaming. Players and admins place, move, and annotate military unit tokens on fantasy maps representing four Celtic nations. Built on React 19 + Vite with a Firebase (Auth + Firestore) backend, deployed to GitHub Pages.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Repository Structure](#repository-structure)
3. [Getting Started](#getting-started)
4. [Environment Variables](#environment-variables)
5. [Architecture Overview](#architecture-overview)
6. [Firestore Data Schema](#firestore-data-schema)
7. [Component Reference](#component-reference)
8. [State & Data Flow](#state--data-flow)
9. [Permissions Model](#permissions-model)
10. [Maps & Nations](#maps--nations)
11. [Tokens](#tokens)
12. [Real-Time Sync Strategy](#real-time-sync-strategy)
13. [Pan & Zoom System](#pan--zoom-system)
14. [Styling Conventions](#styling-conventions)
15. [Build & Deployment](#build--deployment)
16. [Non-Obvious Behaviours](#non-obvious-behaviours)
17. [Adding Features — Common Patterns](#adding-features--common-patterns)

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| UI framework | React | 19.x |
| Build tool | Vite | 8.x |
| Backend (auth) | Firebase Authentication | 12.x |
| Backend (data) | Cloud Firestore | 12.x |
| Deployment | GitHub Pages via gh-pages | 6.x |
| Linting | ESLint (flat config) | 9.x |
| Language | JavaScript (JSX) — no TypeScript | — |

There is no CSS preprocessor, no Redux, no router, and no component library. Firebase is called directly from the hooks and components that need it. The project is intentionally minimal.

---

## Repository Structure

```
war-council/
├── src/
│   ├── main.jsx                Entry point — renders <App /> into #root
│   ├── App.jsx                 Top-level component (~440 lines): composes hooks,
│   │                           owns token interaction handlers, renders layout
│   ├── AuthModal.jsx           Login / signup modal with nation selection
│   ├── AdminPanel.jsx          Admin UI for user management and global settings
│   ├── firebase.js             Firebase init + all Firestore read/write functions
│   ├── constants.js            Shared config: MAPS, FACTIONS, NATIONS, thresholds
│   ├── utils.js                Pure helpers: coordinate math, ID generation,
│   │                           merge-target detection
│   │
│   ├── hooks/
│   │   ├── useAuth.js              Auth state, user profile, derived role flags
│   │   ├── useFirestoreTokenSync.js  Token state, real-time listener, debounced save
│   │   └── useMapZoomPan.js        Zoom/pan state, wheel/mouse/touch gesture handlers
│   │
│   └── components/
│       ├── MapHeader.jsx       Top toolbar: map selector, mode/faction controls,
│       │                       zoom buttons, save status, role badge, sign-out
│       ├── TokenLayer.jsx      Token rendering loop + limit/territory banners
│       ├── TokenPanel.jsx      Slide-out detail panel: count, notes, split, delete
│       └── KnotCorner.jsx      Decorative SVG corner ornament
│
├── public/
│   ├── Erin.jpg          Map image — Erin
│   ├── Manx.png          Map image — Manx
│   ├── Cymria.png        Map image — Cymria
│   ├── Cal.jpg           Map image — Caledonia
│   ├── favicon.svg
│   └── icons.svg
│
├── index.html            Vite HTML entry
├── vite.config.js        Vite config — sets base path to /war-room/
├── eslint.config.js      ESLint flat config
├── package.json
├── .env.local            Firebase credentials (NOT committed to git)
├── .gitignore
└── CLAUDE.md             AI assistant instructions for this repo
```

---

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- A Firebase project with Authentication and Firestore enabled
- Firebase Authentication must have **Email/Password** sign-in enabled

### Install and run

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` (default Vite port).

### First-time Firebase setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication → Email/Password**
3. Create a **Firestore Database** (start in test mode, then apply security rules)
4. Copy your project's SDK config into `.env.local` (see [Environment Variables](#environment-variables))

### Suggested Firestore security rules (production)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid ||
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
    match /sessions/{sessionId}/tokens/{tokenId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /config/global {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
  }
}
```

---

## Environment Variables

Create `.env.local` in the project root. This file is gitignored and must never be committed.

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

These values come from your Firebase project's **Project Settings → Your apps → SDK setup and configuration**. They are consumed in `src/firebase.js` via `import.meta.env.VITE_*`. Vite only exposes variables prefixed with `VITE_` to the browser bundle.

---

## Architecture Overview

```
AuthModal ──────────────────────────────────────────────────────────┐
  Login/signup → creates Firestore user profile                     │
  Calls onAuth(firebaseUser, userProfile) on success                │
                                                                    ▼
App.jsx (BattleMap)
  │
  ├── useAuth()
  │     ├── onAuthStateChanged → getOrCreateUserProfile()
  │     ├── authReady, firebaseUser, userProfile
  │     └── isAdmin, isMonarch, isPlayer, isAdminMode
  │
  ├── useFirestoreTokenSync({ selectedMap, sessionId, ... })
  │     ├── subscribeToTokens(sessionId) ──► real-time Firestore listener
  │     ├── tokens (local state — source of truth while editing)
  │     └── setTokensAndSave() → debounced 1200ms → saveTokens() batch write
  │
  ├── useMapZoomPan({ mode, mapImgRef, setTokens, setTokensAndSave })
  │     ├── zoom, pan state + refs
  │     ├── wheel zoom, mouse pan, pinch zoom, touch token drag
  │     └── adjustZoom(), resetView()
  │
  ├── Token interaction handlers (handleCanvasClick, handleDragStart,
  │   handleCanvasDrop, handleTokenClick, addNote, removeNote, handleSplit)
  │
  ├── <MapHeader />      — toolbar
  ├── <TokenLayer />     — token rendering + banners
  ├── <TokenPanel />     — detail side panel
  └── <AdminPanel />     — conditionally rendered modal for admins
```

**Key design decisions:**

- `App.jsx` owns all token interaction logic (click, drag, merge, split, notes). The hooks own their respective subsystems (auth, sync, gestures) and return only what `App.jsx` needs.
- Local token state is the authoritative source during an editing session. Firestore updates are held off while a debounce timer is running to prevent remote snapshots from clobbering in-progress drags.
- Pan/zoom uses CSS `transform: translate() scale()` on a wrapper div — not a canvas. Standard DOM event coordinates must be transformed back to map space before calculating token positions.

---

## Firestore Data Schema

### `users/{uid}`

```js
{
  uid:           string,   // Firebase Auth UID
  email:         string,
  displayName:   string,   // Character/commander name shown in-app
  role:          "admin" | "monarch" | "commander",
  nation:        "erin" | "manx" | "cymria" | "caledonia",
  maxTokens:     number | null,   // Per-user unit cap; null = use global default
  createdAt:     Timestamp,
}
```

### `sessions/{sessionId}/tokens/{tokenId}`

`sessionId` is the map name (e.g. `"erin"`). One session per map.

```js
{
  id:        string,    // 8-char random ID generated client-side
  faction:   "player" | "enemy" | "contested",
  x:         number,   // Normalized 0–1 relative to map image width
  y:         number,   // Normalized 0–1 relative to map image height
  count:     number,   // Sum of member counts (or legacy unit count)
  notes:     string[], // Group-level field notes (added after grouping)
  ownerId:   string | null,   // Firebase UID of the anchor member; null for admin-placed enemy tokens
  nation:    "erin" | "manx" | "cymria" | "caledonia" | null,
  members:   Array<{           // Individual token identities within a group
    id:      string,
    count:   number,
    notes:   string[],         // Notes that existed before this member was grouped
    ownerId: string | null,
    nation:  string | null,
  }>,
  updatedAt: Timestamp,
}
```

`members` is populated whenever two or more tokens are grouped together. Legacy tokens in Firestore that predate this field are treated as having a single implicit member (using the top-level `count`, `notes`, `ownerId`, and `nation`).

### `config/global`

```js
{
  defaultMaxTokens: number | null,  // App-wide unit cap fallback
}
```

---

## Component Reference

### `src/constants.js`

All shared configuration. Import from here — do not hardcode these values elsewhere.

| Export | Purpose |
|---|---|
| `MAPS` | Array of `{ id, label, src }` — one entry per map |
| `FACTIONS` | Object keyed by faction: `{ icon, label, color, border }` |
| `NATIONS` | Object keyed by nation: `{ label, color, border }` |
| `TOKEN_RADIUS` | `11` — rendered token radius in px (unzoomed) |
| `MERGE_THRESHOLD` | `24.2` — screen-space distance below which same-faction tokens auto-merge |
| `SAVE_DEBOUNCE` | `1200` — milliseconds before a pending local write is flushed to Firestore |

### `src/utils.js`

Pure functions with no side effects.

| Export | Purpose |
|---|---|
| `dist(a, b)` | Euclidean distance between two `{x, y}` points |
| `getMapLayoutBounds(cW, cH, iW, iH)` | Computes letterbox/pillarbox bounds for a contained image |
| `getMapScreenBounds(imgEl)` | Returns `getBoundingClientRect()` of the map `<img>` element |
| `generateId()` | 8-char random alphanumeric string for new token IDs |
| `findMergeTarget(tokens, mb, clientX, clientY, faction, threshold, excludeId?)` | Finds the nearest same-faction token within `threshold` pixels; used in click, drop, and touch handlers |

### `src/hooks/useAuth.js`

Manages all authentication state and derived permission flags.

**Returns:** `{ authReady, firebaseUser, userProfile, userProfiles, showAuthModal, adminMode, setAdminMode, isAdmin, isMonarch, isPlayer, isAdminMode, handleAuthSuccess }`

- `authReady` — false until the first `onAuthStateChanged` fires; gates the loading screen
- `userProfiles` — map of `uid → displayName` for all users; loaded once on sign-in
- `isAdminMode` — true only when `isAdmin && adminMode`; admins must opt in each session
- `handleAuthSuccess(fbUser, profile)` — called by `AuthModal` on successful login/signup

### `src/hooks/useFirestoreTokenSync.js`

Manages token state, the real-time Firestore listener, and the debounced save pipeline.

**Params:** `{ isPlayer, selectedMap, sessionId, userId, isAdminMode }`

**Returns:** `{ tokens, setTokens, setTokensAndSave, saveStatus }`

- `setTokensAndSave(updater)` — updates local state immediately and schedules a Firestore write
- `saveStatus` — `"idle" | "saving" | "saved" | "error"`; displayed in the toolbar
- Firestore snapshots are ignored while a local write is pending (see [Real-Time Sync Strategy](#real-time-sync-strategy))

### `src/hooks/useMapZoomPan.js`

Manages all zoom/pan/gesture state. Attaches its own document-level event listeners internally.

**Params:** `{ mode, authReady, mapImgRef, setTokens, setTokensAndSave }`

**Returns:** `{ zoom, pan, canvasCursor, containerSize, canvasRef, tokenTouchRef, zoomRef, dragPanRef, handleMouseDown, handleCanvasTouchStart, adjustZoom, resetView }`

- `zoomRef` / `dragPanRef` — refs exposed so `App.jsx` canvas handlers can read current values without stale closure issues
- `tokenTouchRef` — set by `TokenLayer` on token `touchstart`; read by the touch move/end handler in this hook to implement touch-based token drag

### `src/App.jsx` — `BattleMap`

Composes the three hooks, owns local UI state (selected token, mode, placing faction, note input, drag ID, split count), and implements all token interaction handlers. Renders `<MapHeader>`, `<TokenLayer>`, `<TokenPanel>`, `<AdminPanel>`, and `<AuthModal>`.

### `src/components/MapHeader.jsx`

Top toolbar. Receives auth state, map state, permission flags, and handler callbacks as props. Imports `signOut` and `auth` from `firebase.js` directly.

### `src/components/TokenLayer.jsx`

Renders the token overlay (positioned absolutely over the canvas, outside the zoom transform for crisp rendering). Also renders the token-limit warning banner and the foreign-territory banner. Returns `null` if `layoutBounds` is not yet computed.

### `src/components/TokenPanel.jsx`

Slide-out detail panel (right edge). Shows faction, count controls, split controls, field notes (group-level + all member notes combined), and the remove button. When a token has two or more members the split section renders a dropdown listing each member by owner/nation/count; for legacy tokens it falls back to a numeric picker. Computes its own `locked` state from `canMutateToken(selectedToken)`. Imports `deleteToken` from `firebase.js` directly.

### `src/AuthModal.jsx` — `AuthModal`

Login and signup form. Props:

```js
{ onAuth: (firebaseUser, userProfile) => void }
```

Handles login (email + password), signup (email + password + display name + nation), and password reset. Maps Firebase error codes to user-friendly messages.

### `src/AdminPanel.jsx` — `AdminPanel`

Modal panel for admin users. Props:

```js
{ onClose: () => void }
```

Fetches all users from Firestore on mount. Provides a grid for editing each user's nation, rank, and unit cap. Also provides a global settings section for the default unit cap.

### `src/firebase.js`

Firebase initialisation and all Firestore operations.

| Export | Type | Purpose |
|---|---|---|
| `auth` | Firebase Auth instance | Used in `useAuth.js` and `MapHeader.jsx` |
| `db` | Firestore instance | Used internally by all functions below |
| `getOrCreateUserProfile(user)` | async fn | Creates user doc on signup; merges on subsequent logins |
| `subscribeToTokens(sessionId, callback)` | fn → unsubscribe | Real-time Firestore listener |
| `saveTokens(sessionId, tokens, currentUserId, isAdmin)` | async fn | Batch-writes the full token array |
| `deleteToken(sessionId, tokenId)` | async fn | Immediately removes one token document |
| `getAllUsers()` | async fn | Returns all documents from `users/` collection |
| `updateUserProfile(uid, updates)` | async fn | Merges a partial update into a user document |
| `getGlobalSettings()` | async fn | Reads `config/global` |
| `updateGlobalSettings(updates)` | async fn | Merges updates into `config/global` |

---

## State & Data Flow

### Auth flow

```
App mounts
  → useAuth: onAuthStateChanged fires
    → if user: getOrCreateUserProfile() → set userProfile, set authReady
    → if no user: set authReady, show AuthModal
  → App.jsx: useEffect watches userProfile
    → if nation set and no map selected: auto-select home map
```

`userProfile` is the source of truth for the current user's role and nation. It is fetched fresh from Firestore on each auth state change — do not rely on Firebase's `currentUser.displayName` for role or nation.

### Token lifecycle

```
User interacts (click/drag)
  → handler calls setTokensAndSave(updater)
    → sets local tokens state immediately (optimistic update)
    → clears any pending debounce timer
    → starts new 1200ms debounce timer
      → on timer fire: saveTokens() → Firestore batch write

Firestore snapshot arrives (remote change from another user)
  → if no pending save timer: update local tokens from snapshot
  → if save timer active:     ignore snapshot (local edits take precedence)
```

There is a brief window where local state diverges from Firestore. This is safe because the write completes quickly and the listener re-syncs afterwards.

### Delete flow

Deletion bypasses the debounce. `deleteToken()` is called immediately and the token is removed from local state at the same time. This prevents a deleted token from being re-added by a pending debounce flush of the full array.

---

## Permissions Model

Roles are stored in Firestore (`users/{uid}.role`). Derived booleans in `useAuth.js`:

```
"admin"     → isAdmin = true
"monarch"   → isMonarch = true
"commander" → (no special flag — default role)
```

Admin features additionally require `adminMode` to be toggled on in the toolbar. Even users with `role: "admin"` start with `adminMode: false` each session. This is a safeguard against accidental mass edits.

| Action | Commander | Monarch | Admin (mode off) | Admin (mode on) |
|---|---|---|---|---|
| Place player tokens on own map | Yes | Yes | Yes | Yes |
| Place enemy / contested tokens | No | No | No | Yes |
| Place tokens on foreign maps | No | No | No | Yes |
| Move own tokens | Yes | Yes | Yes | Yes |
| Move others' tokens | No | No | No | Yes |
| Edit / split a group containing own tokens | Yes | Yes | Yes | Yes |
| Delete own tokens | Yes | Yes | Yes | Yes |
| Delete others' tokens | No | No | No | Yes |
| See enemy faction tokens | No | No | Yes | Yes |
| Open Admin Panel | No | No | Yes | Yes |
| Edit user roles / nations | No | No | Yes | Yes |

---

## Maps & Nations

There are exactly four maps, one per nation:

| ID | Label | Image file |
|---|---|---|
| `erin` | Erin | `Erin.jpg` |
| `manx` | Manx | `Manx.png` |
| `cymria` | Cymria | `Cymria.png` |
| `caledonia` | Caledonia | `Cal.jpg` |

A player's `nation` field determines:
1. Which map they are shown by default on login
2. Which map they are allowed to place tokens on (non-admin only)

When a non-admin views a foreign nation's map, `onForeignMap` becomes true and placement is blocked.

Map images live in `/public/` and are served directly by Vite in development, and baked into the GitHub Pages deployment via the standard Vite build.

**To add a fifth map:** add an entry to `MAPS` and `NATIONS` in `constants.js`, add the image to `/public/`, and add the nation option to the signup `<select>` in `AuthModal.jsx`. No Firestore schema change is needed.

---

## Tokens

### Coordinate system

Token positions are stored as normalised floats (`x: 0–1`, `y: 0–1`) relative to the map image's natural dimensions. This keeps positions resolution-independent regardless of screen size or zoom level.

To convert a normalised position to screen coordinates:

```js
screenX = mapScreenLeft + token.x * mapScreenWidth
screenY = mapScreenTop  + token.y * mapScreenHeight
```

where `mapScreenLeft/Top/Width/Height` are the bounding rect of the rendered `<img>` element. The inverse is applied when computing a placement position from a click or drop event (`getMapScreenBounds` in `utils.js`).

### Notes

Any logged-in user can add a note to any token they can view. Notes are automatically prefixed with the author's character name in the format `[CharacterName] text` before being stored.

The detail panel displays two kinds of notes in a flat list:
- **Member notes** — notes that existed on a token before it was grouped in; stored on the individual `members[i].notes` array.
- **Group notes** — notes added after grouping via the note input; stored on the top-level `token.notes` array.

Removing a note is restricted: the remove button is only shown if the viewer owns the token or has the `admin` or `monarch` role. `removeNote` takes a `source` argument — `'group'` for top-level notes, or the member index (number) for member notes — so each remove targets the correct array.

### Auto-grouping

When a token is placed or dropped, `findMergeTarget()` (in `utils.js`) scans existing tokens for any of the same faction within `MERGE_THRESHOLD` pixels (screen space). If found, the incoming token (or its `members` array) is appended to the target token's `members` array, preserving each constituent's notes, `ownerId`, and `nation`. The same logic runs in three places — canvas click, canvas drop, and touch end — all using the shared utility.

Legacy tokens without a `members` field are normalised to a single-member array on the fly when grouped.

### Splitting

The detail panel shows a **member dropdown** when a token has two or more members. Each option displays the member's owner name, nation, and unit count. Selecting a member and clicking "Split off selected" removes that member from the group and creates a new individual token at a small offset, restoring its original notes, `ownerId`, and `nation`.

For legacy tokens without a `members` array, the panel falls back to a numeric count picker that splits N units off the top-level count.

### Token limits

If `userProfile.maxTokens` is set, the user cannot place tokens once their total unit count on the current map would exceed the cap. `globalSettings.defaultMaxTokens` is the fallback when `maxTokens` is null.

---

## Real-Time Sync Strategy

`subscribeToTokens(sessionId, callback)` creates a Firestore `onSnapshot` listener. The callback fires on the initial load and on every subsequent remote write.

The guard in `useFirestoreTokenSync.js` prevents remote updates from overwriting pending local changes:

```js
// Inside the subscription callback:
if (saveTimerRef.current) return;  // pending local write in flight — ignore snapshot
setTokens(incomingTokens);
```

If two users edit simultaneously, the last Firestore write wins after both debounce timers flush. There is no operational-transform or CRDT conflict resolution. For turn-based tabletop play this is acceptable.

The subscription is torn down and rebuilt whenever `sessionId` changes (map switch). Cleanup is handled in the `useEffect` return function inside the hook.

---

## Pan & Zoom System

Pan and zoom are stored in React state (`pan: {x, y}`, `zoom: number`) and mirrored in refs (`panRef`, `zoomRef`) inside `useMapZoomPan.js`. The refs allow event handlers (which close over stale state) to read current values without triggering re-renders.

The map container CSS:

```css
transform: translate(panX px, panY px) scale(zoom);
transform-origin: 0 0;
```

Zoom is applied around the cursor position by adjusting `pan` simultaneously, so the point under the cursor stays visually fixed. This calculation lives in the `handleWheel` handler inside `useMapZoomPan.js`.

Token sizes scale proportionally with zoom: `radius = TOKEN_RADIUS * zoom`. Tokens grow and shrink with the map, maintaining their visual weight relative to the terrain.

Touch support:
- Single touch → drag pan (or drag a token if touch started on one)
- Two-finger pinch → zoom (change in distance between touches maps to zoom delta)

Token touch drag is coordinated between `TokenLayer` (which sets `tokenTouchRef.current` on `touchstart`) and `useMapZoomPan` (which reads it in the document-level `touchmove`/`touchend` handlers).

Zoom range: `0.1` (fully zoomed out) to `10` (maximum detail).

---

## Styling Conventions

All styles are inline `style` objects on JSX elements. There are no CSS modules, Tailwind classes, or component libraries. A small number of CSS class names (`.toolbar-btn`, `.mode-btn`, `.note-input`, `.zoom-btn`, `.token-locked`) are defined in a `<style>` block rendered inside `App.jsx` and used across components.

**Colour palette:**

```
Gold highlight:  #c4952a, #f0d060
Dark brown bg:   #3a2209, #2c1a06
Parchment:       #c8a96e
Text light:      #e8d5a3
Enemy red:       #c0392b
Contested amber: #e67e22
```

**Fonts** (loaded from Google Fonts via the `<style>` block in `App.jsx`):
- `Cinzel` — headers, titles, toolbar labels
- `Crimson Text` — body text, notes, detail panel

Decorative SVG knotwork elements appear in `AuthModal.jsx` and as corner ornaments via `KnotCorner.jsx`. Icons are Unicode characters or inline SVG — no icon library is used.

---

## Build & Deployment

```bash
npm run dev       # Vite dev server with HMR at localhost:5173
npm run build     # Production build to /dist
npm run preview   # Serve /dist locally to verify the build
npm run deploy    # npm run build && gh-pages -d dist
```

`npm run deploy` pushes the `dist/` folder to the `gh-pages` branch of the repository. GitHub Pages serves that branch at the configured path.

The `base: '/war-room/'` in `vite.config.js` must match the GitHub Pages subpath. If deploying to a custom domain or a different repository path, update `base` accordingly — otherwise all asset URLs will return 404.

---

## Non-Obvious Behaviours

**Admin mode is opt-in per session.** An admin who forgets to toggle "Admin: On" is subject to normal player restrictions. This is intentional — it prevents accidental bulk edits of other players' tokens.

**Map = session.** Tokens placed on the Erin map live in `sessions/erin/tokens/`. Switching maps tears down the old listener and establishes a new one. There is no shared token pool across maps.

**Tokens are not deleted on disconnect.** All tokens persist in Firestore indefinitely. There is no ephemeral/presence layer. Session cleanup must be done manually via the Admin Panel or directly in the Firestore console.

**`saveTokens` only writes tokens the caller owns.** Non-admin users filter the token array to `ownerId === currentUserId` before writing. A player cannot overwrite another player's tokens even if local state contains them.

**Legacy role "player".** Early versions used `role: "player"`. The AdminPanel normalises this to `"commander"` in the display layer. If you see `role: "player"` in the database, treat it as `"commander"`.

**The `id` field is duplicated.** Tokens have both a Firestore document ID and an `id` field inside the document body. They are the same value. The field exists so that token objects passed around in memory always carry their own identifier without needing to re-query.

**`onForeignMap`** is derived state, not stored in Firestore. It is recomputed whenever `selectedMap` or `userProfile.nation` changes.

**Token touch drag is coordinated across two modules.** `TokenLayer` sets `tokenTouchRef.current` when a touch begins on a token. `useMapZoomPan` checks that ref in its document-level touch handlers. Neither module knows about the other — the ref is the shared channel.

---

## Adding Features — Common Patterns

### Adding a new nation / map

1. Add the map image to `/public/`
2. Add an entry to `MAPS` in `constants.js`
3. Add an entry to `NATIONS` in `constants.js`
4. Add the nation option to the `<select>` in `AuthModal.jsx`
5. No Firestore schema change needed

### Adding a new token field

1. Add the field to the token object in the placement handler in `App.jsx`
2. Include it in the `saveTokens()` write object in `firebase.js`
3. Include it in the snapshot mapping in `subscribeToTokens()` in `firebase.js`
4. Render and/or edit it in `TokenPanel.jsx`

### Adding a new user role

1. Add the role string as a valid option in `getOrCreateUserProfile()` in `firebase.js`
2. Derive a boolean flag in `useAuth.js` alongside `isAdmin`, `isMonarch`
3. Gate the relevant actions on the new flag in `App.jsx` / `canMutateToken` / `canPlaceFaction`
4. Add the role option to the rank `<select>` in `AdminPanel.jsx`

### Debugging Firestore writes

Add `console.log` inside `saveTokens()` in `firebase.js`. The `saveStatus` state returned by `useFirestoreTokenSync` (`"idle" | "saving" | "saved" | "error"`) is displayed in the toolbar — watch it while interacting to confirm writes are completing. For live data inspection, the Firebase Console → Firestore → Data panel shows documents updating in real time.
