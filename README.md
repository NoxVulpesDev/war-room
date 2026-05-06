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

There is no CSS preprocessor, no Redux, no router, no component library, and no API wrapper layer. Firebase is called directly from components. The project is intentionally minimal.

---

## Repository Structure

```
war-council/
├── src/
│   ├── main.jsx          Entry point — renders <App /> into #root
│   ├── App.jsx           Entire battle-map application (~1200 lines)
│   ├── AuthModal.jsx     Login / signup modal with nation selection
│   ├── AdminPanel.jsx    Admin UI for user management and global settings
│   ├── firebase.js       Firebase init + all Firestore read/write functions
│   ├── App.css           Component-scoped styles for App.jsx
│   └── index.css         Global resets and base styles
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

All application logic lives in `src/`. There are no subdirectories for routes, hooks, contexts, or utilities — this is a single-page app with a single top-level component.

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
App.jsx (BattleMap component) ◄──── Firebase onAuthStateChanged ────┘
  │
  ├── selectedMap / sessionId
  │     └── subscribeToTokens(sessionId) ──► real-time Firestore listener
  │                                          fires on every remote change
  │
  ├── tokens (local state — source of truth while editing)
  │     └── setTokensAndSave()
  │           └── schedules saveTokens() via 1200ms debounce
  │                 └── Firestore batch write
  │
  ├── Token rendering (SVG circles over positioned map image)
  │
  ├── Interaction handlers (click / mousedown / mousemove / wheel / touch)
  │
  └── AdminPanel (conditionally rendered modal for admins)
```

**Key design decisions:**

- There is one component (`BattleMap`) that owns all state. Props are not drilled deeply; AdminPanel receives callbacks and a users list directly.
- Local token state is the authoritative source during an editing session. Firestore updates are held off while a debounce timer is running to prevent remote snapshots from clobbering in-progress drags.
- Pan/zoom uses CSS `transform: translate() scale()` on a wrapper div — not a canvas. Standard DOM event coordinates must be transformed back to map space before calculating token positions (see `screenToMap()` in App.jsx).

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
  count:     number,   // Number of units this token represents
  notes:     string[], // Free-text field notes
  ownerId:   string | null,   // Firebase UID; null for admin-placed enemy tokens
  nation:    "erin" | "manx" | "cymria" | "caledonia" | null,
  updatedAt: Timestamp,
}
```

### `config/global`

```js
{
  defaultMaxTokens: number | null,  // App-wide unit cap fallback
}
```

---

## Component Reference

### `src/App.jsx` — `BattleMap`

The entire application. Responsible for auth state, map selection, session management, real-time token subscription, all token CRUD, rendering, pan/zoom, and admin mode toggle.

Notable constants at the top of the file:

| Constant | Value | Purpose |
|---|---|---|
| `MAPS` | Object | Map ID → image src, label |
| `FACTIONS` | Object | Faction → colour, border, label |
| `NATIONS` | Object | Nation → colour, label |
| `TOKEN_RADIUS` | `11` | Rendered token radius in px |
| `MERGE_THRESHOLD` | `24.2` | Screen-space distance below which two same-faction tokens auto-merge |
| `SAVE_DEBOUNCE` | `1200` | Milliseconds before a pending local write is flushed to Firestore |

### `src/firebase.js`

Firebase initialisation and all Firestore operations. Nothing application-specific beyond data access:

| Export | Type | Purpose |
|---|---|---|
| `auth` | Firebase Auth instance | Used in App.jsx for `onAuthStateChanged`, `signOut` |
| `db` | Firestore instance | Used internally by all functions below |
| `getOrCreateUserProfile(user, characterName, nation)` | async fn | Creates user doc on signup; merges on subsequent logins |
| `subscribeToTokens(sessionId, callback)` | fn → unsubscribe | Real-time Firestore listener; returns an unsubscribe function |
| `saveTokens(sessionId, tokens, currentUserId, isAdmin)` | async fn | Batch-writes the full token array; non-admins only write own tokens |
| `deleteToken(sessionId, tokenId)` | async fn | Immediately removes one token document |
| `getAllUsers()` | async fn | Returns all documents from `users/` collection |
| `updateUserProfile(uid, updates)` | async fn | Merges a partial update into a user document |
| `getGlobalSettings()` | async fn | Reads `config/global` |
| `updateGlobalSettings(updates)` | async fn | Merges updates into `config/global` |

### `src/AuthModal.jsx` — `AuthModal`

Login and signup form. Props:

```js
{ onAuth: (firebaseUser, userProfile) => void }
```

Handles both login (email + password) and signup (email + password + display name + nation). On success, calls `onAuth` with the resolved profile. Maps Firebase error codes to user-friendly messages.

### `src/AdminPanel.jsx` — `AdminPanel`

Modal panel for admin users. Props:

```js
{ onClose: () => void }
```

Fetches all users from Firestore on mount. Provides a grid for editing each user's nation, rank, and unit cap. Also provides a global settings section for the default unit cap. All edits use per-row Save buttons.

---

## State & Data Flow

### Auth flow

```
App mounts
  → onAuthStateChanged fires
    → if user: getOrCreateUserProfile() → set userProfile state, set authReady
    → if no user: set authReady, show AuthModal
```

`userProfile` is the source of truth for the current user's role and nation. It is fetched fresh from Firestore on each auth state change — do not rely on Firebase's `currentUser.displayName` for role or nation.

### Token lifecycle

```
User interacts (click/drag)
  → handler calls setTokensAndSave(newTokens)
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

Roles are stored in Firestore (`users/{uid}.role`). Derived booleans in `App.jsx`:

```
"admin"     → isAdmin = true
"monarch"   → isMonarch = true
"commander" → isCommander = true  (default for new signups)
```

Admin features additionally require `adminMode` to be toggled on in the toolbar. Even users with `role: "admin"` start with `adminMode: false` each session. This is a safeguard against accidental mass edits.

| Action | Commander | Monarch | Admin (mode off) | Admin (mode on) |
|---|---|---|---|---|
| Place player tokens on own map | Yes | Yes | Yes | Yes |
| Place enemy / contested tokens | No | No | No | Yes |
| Place tokens on foreign maps | No | No | No | Yes |
| Move own tokens | Yes | Yes | Yes | Yes |
| Move others' tokens | No | No | No | Yes |
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

**To add a fifth map:** add an entry to `MAPS`, add an entry to `NATIONS`, add the image to `/public/`, and add the nation option to the signup `<select>` in `AuthModal.jsx`. No Firestore schema change is needed.

---

## Tokens

### Coordinate system

Token positions are stored as normalised floats (`x: 0–1`, `y: 0–1`) relative to the map image's natural dimensions. This keeps positions resolution-independent regardless of screen size or zoom level.

To convert a normalised position to screen coordinates:

```js
screenX = (token.x * mapNaturalSize.width  * zoom) + pan.x + containerSize.width  / 2
screenY = (token.y * mapNaturalSize.height * zoom) + pan.y + containerSize.height / 2
```

The inverse (`screenToMap`) is applied when computing a placement position from a click event.

### Auto-merge

When a token is placed or dropped, the app scans existing tokens for any of the same faction within `MERGE_THRESHOLD` pixels (screen space). If found, counts are summed into the existing token and the new/dragged token is discarded.

### Splitting

From the detail panel, a user can split N units off a token. The original loses N units and a new token with N units is placed at a small offset. The new token inherits faction, nation, and ownerId.

### Token limits

If `userProfile.maxTokens` is set, the user cannot place tokens once their total unit count on the current map would exceed the cap. `globalSettings.defaultMaxTokens` is the fallback when `maxTokens` is null.

---

## Real-Time Sync Strategy

`subscribeToTokens(sessionId, callback)` creates a Firestore `onSnapshot` listener. The callback fires on the initial load and on every subsequent remote write.

The guard in App.jsx prevents remote updates from overwriting pending local changes:

```js
// Inside the subscription callback:
if (saveTimerRef.current) return;  // pending local write in flight — ignore snapshot
setTokens(incomingTokens);
```

If two users edit simultaneously, the last Firestore write wins after both debounce timers flush. There is no operational-transform or CRDT conflict resolution. For turn-based tabletop play this is acceptable.

The subscription is torn down and rebuilt whenever `sessionId` changes (map switch). Cleanup is handled in the `useEffect` return function.

---

## Pan & Zoom System

Pan and zoom are stored in React state (`pan: {x, y}`, `zoom: number`) and mirrored in refs (`panRef`, `zoomRef`). The refs allow event handlers (which close over stale state) to read current values without triggering re-renders.

The map container CSS:

```css
transform: translate(calc(-50% + panX), calc(-50% + panY)) scale(zoom);
transform-origin: center center;
```

Zoom is applied around the cursor position by adjusting `pan` simultaneously, so the point under the cursor stays visually fixed. This calculation lives in the `handleWheel` handler.

Token sizes counter-scale: `radius = TOKEN_RADIUS / zoom`. Tokens remain a consistent visual size at all zoom levels rather than shrinking with the map.

Touch support:
- Single touch → drag pan (or drag a token if touch started on one)
- Two-finger pinch → zoom (change in distance between touches maps to zoom delta)

Zoom range: `0.1` (fully zoomed out) to `10` (maximum detail).

---

## Styling Conventions

All styles are inline `style` objects on JSX elements. There are no CSS modules, Tailwind classes, or component libraries. `App.css` and `index.css` contain only a small number of global rules.

**Colour palette:**

```
Gold highlight:  #c4952a, #f0d060
Dark brown bg:   #3a2209, #2c1a06
Parchment:       #c8a96e
Text light:      #e8d5a3
Enemy red:       #c0392b
Contested amber: #e67e22
```

**Fonts** (loaded from Google Fonts in `index.html`):
- `Cinzel` — headers, titles, toolbar labels
- `Crimson Text` — body text, notes, detail panel

Decorative SVG knotwork elements are inline in `AuthModal.jsx`. Icons are Unicode characters or inline SVG — no icon library is used.

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

---

## Adding Features — Common Patterns

### Adding a new nation / map

1. Add the map image to `/public/`
2. Add an entry to `MAPS` in `App.jsx`
3. Add an entry to `NATIONS` in `App.jsx`
4. Add the nation option to the `<select>` in `AuthModal.jsx`
5. No Firestore schema change needed

### Adding a new token field

1. Add the field to the token object in the placement handler in `App.jsx`
2. Include it in the `saveTokens()` write object in `firebase.js`
3. Include it in the snapshot mapping in `subscribeToTokens()` in `firebase.js` (where raw Firestore docs are mapped to token objects)
4. Render and/or edit it in the detail panel section of `App.jsx`

### Adding a new user role

1. Add the role string as a valid option in `getOrCreateUserProfile()` in `firebase.js`
2. Derive a boolean flag in `App.jsx` alongside `isAdmin`, `isMonarch`, `isCommander`
3. Gate the relevant actions on the new flag
4. Add the role option to the rank `<select>` in `AdminPanel.jsx`

### Debugging Firestore writes

Add `console.log` inside `saveTokens()` in `firebase.js`. The `saveStatus` state in `App.jsx` (`"idle" | "saving" | "saved" | "error"`) is displayed in the toolbar — watch it while interacting to confirm writes are completing. For live data inspection, the Firebase Console → Firestore → Data panel shows documents updating in real time.
