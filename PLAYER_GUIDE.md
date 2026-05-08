# War Council — Player Guide

## Signing In

On first visit you'll be prompted to log in or create an account. Choose your nation during signup — this determines your home map and where you may deploy forces. You can sign out at any time with the **⟵ Depart** button in the top-right.

---

## Navigation

All roles share the same map controls:

| Control | Action |
|---|---|
| **Pan mode** / Middle-click / Right-click drag | Pan the map |
| **Scroll wheel** | Zoom in/out |
| **Pinch** (touch) | Pinch to zoom |
| **+ / −** buttons | Step zoom |
| **⌂** button | Reset view to default |

Switch the active tool with the **MODE** buttons in the toolbar: **⊕ Place**, **✦ Move**, **✥ Pan**, **✕ Delete**.

The **📜 History** button (top-right) opens the timeline scrubber for the current map. While viewing history, all edits are disabled; click **⟳ Return to Live** to resume.

---

---

## ⚔ Commander

_Standard player role. You control forces belonging to your nation._

### Placing tokens

- Switch to **⊕ Place** mode.
- Select **FACTION**: **⚔ Player** (your forces) or **⚔ Contested** (disputed territory).
- Click anywhere on **your home nation's map** to place a token.
- Clicking near an existing same-faction token will **merge** it into a group rather than create a new token — a number on the token shows the combined count.
- You cannot place tokens on another nation's map or place enemy tokens.
- A unit cap may be set by your GM. When you're at the limit, a warning flashes and placement is blocked. Your current usage is shown in the header (e.g. `3/10 units`).

### Moving tokens

- Switch to **✦ Move** mode.
- Drag any token **you own** to a new position.
- Dropping a token on top of another same-faction token merges them into a group.

### Deleting tokens

- Switch to **✕ Delete** mode and click one of your tokens, **or** open the Token Panel and use the **✕ Remove Token** button at the bottom.

### Token Panel

Click any token in **⊕ Place** or **✦ Move** mode to open the side panel.

**What you can do on your own tokens:**

- **Unit Name** — type a name for the unit (or for a specific member of a group).
- **Field Notes** — add a note (prefixed with your display name automatically). Press Enter or click **+** to save. You can delete your own notes with the **✕** next to each one.
- **Split Forces** — detach part of a group into a new nearby token.
  - For a **grouped** token: choose a member from the dropdown and click **⑃ Split off selected** to peel them out with their notes and ownership intact.
  - For a **simple** token: set the count to split off and click **⑃ Split off**.
- **Lock Group** — freeze the composition of a grouped token so it cannot be merged with other tokens or split apart. Click **⚿ Lock group** on any grouped token you belong to. Any member-owner of the group can toggle the lock. A locked group displays a small **⚿** badge on the map. Click **⚿ Unlock group** to allow merging and splitting again.
- **Donate Token** — transfer full ownership of a token to another player. Select a recipient from the dropdown and click **⇒ Transfer ownership**.

**What you can do on tokens you don't own:**

- View faction, owner, and nation (read-only).
- Add a note (visible to all, prefixed with your name).

### Auto-save

All changes save automatically to Firebase after a short delay. The header shows **✓ Saved** / **⟳ Saving…** / **✕ Save error** as appropriate.

---

---

## ♔ Monarch

_Elevated player role. Monarchs have additional authority over their nation's forces._

Everything a Commander can do, plus:

### Note removal

- You can **remove any note** from any token in your nation, including notes left by other players.

Your role badge in the top-right shows ♔ and **Monarch**.

---

---

## 👑 GM (Admin)

_Game master role. Full control over all maps, tokens, and users._

### Admin Mode toggle

The **👑 Admin: Off / On** button in the top-right switches your elevated permissions. When **off**, you operate with Commander-level restrictions. Toggle it **on** to unlock GM capabilities.

> Admin Mode must be explicitly enabled — logging in as an admin does not automatically give you free rein.

### With Admin Mode ON

- **Place enemy tokens** — the **☠ Enemy** faction button appears in the toolbar.
- **Place tokens on any map**, regardless of nation.
- **Move, delete, or edit any token** regardless of owner.
- **Remove any note** on any token.
- **No unit cap** enforced — you can place as many tokens as needed.

### GM Notes

The Token Panel includes a **⚙ GM Notes** section visible only to admins (regardless of admin mode). Use it to attach private intelligence, reminders, or scenario details to any token — players never see this section.

- Open any token's panel and scroll to **⚙ GM Notes**.
- Type a note and press Enter or **+** to save.
- Click **✕** next to a note to remove it.

### History Timeline

Same scrubber as other roles, but you also control the **Clear History** option in the Admin Panel (see below).

When viewing a history step, **movement arrows** and **ghost circles** show how tokens moved since the previous step.

### Admin Panel

Click the **⚙ Admin** button to open the Council Administration panel.

#### Global Settings

| Field | Effect |
|---|---|
| **Default max units per map** | Sets the fallback unit cap for all users who don't have a per-user override. Leave blank for no limit. |

#### History Management

Select a map from the dropdown and click **✕ Clear History** to delete all recorded history entries for that map. This is permanent and cannot be undone.

#### User Management

Each registered user is listed with editable fields:

| Field | Options |
|---|---|
| **Nation** | Erin, Manx, Caledonia, Cymria, or None |
| **Rank** | Commander, Monarch, GM (Admin) |
| **Max Units** | Per-user token cap override; leave blank to fall back to the global default |

Click **Save** on a row to apply changes immediately. Nation and rank changes take effect for the player on their next action.

---

## Quick Reference

| | Commander | Monarch | GM (Admin Mode) |
|---|:---:|:---:|:---:|
| Place player/contested tokens | ✓ | ✓ | ✓ |
| Place enemy tokens | — | — | ✓ |
| Place on foreign maps | — | — | ✓ |
| Move own tokens | ✓ | ✓ | ✓ |
| Move any token | — | — | ✓ |
| Delete own tokens | ✓ | ✓ | ✓ |
| Delete any token | — | — | ✓ |
| Add notes | ✓ | ✓ | ✓ |
| Remove own notes | ✓ | ✓ | ✓ |
| Remove nation notes | — | ✓ | ✓ |
| Remove any note | — | — | ✓ |
| GM Notes (private) | — | — | ✓ |
| Donate token | ✓ | ✓ | ✓ |
| Split forces | ✓ | ✓ | ✓ |
| View history timeline | ✓ | ✓ | ✓ |
| Admin Panel | — | — | ✓ |
| User management | — | — | ✓ |
| Clear map history | — | — | ✓ |
| Set token caps | — | — | ✓ |
