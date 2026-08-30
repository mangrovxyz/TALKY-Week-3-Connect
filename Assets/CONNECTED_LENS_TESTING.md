# TALKY — Connected Lens & Snap Cloud Multiplayer Testing

This Lens uses **two layers** for multi-user testing:

| Layer | Purpose |
|---|---|
| **Snap Cloud Realtime** | Room presence, voice chunks, reactions — channel `walkie-{3-digit-code}` |
| **Connected Lens Module** | Links Preview 1 + Preview 2 into the same mocked Connected Lens session (optional) |

Voice and reactions are **scoped to the Snap Cloud room**. Users in room `042` cannot hear users in room `137`.

---

## One-time project setup

### 1. Snap Cloud credentials

1. Apply for [Snap Cloud access](https://snap-ar.com/SnapCloudApplication) if needed.
2. In Lens Studio: **Window → Supabase → Login → Create/select project → Import Credentials**
   - Target asset: `Assets/SupabaseProject_talky.supabaseProject`
3. In **Snap Cloud Dashboard → Authentication → Providers → Anonymous** — **enable** (required for Lens Studio Preview dual-preview testing).
4. On device, Snapchat OIDC sign-in is used automatically (`signInWithIdToken`).
5. **Reset** the Lens after importing credentials.

> Until credentials are imported, the Lens falls back to **local demo mode** (single user, no voice sync).

### 2. Connected Lens Module (dual-preview)

1. **Asset Browser → + → Connected Lens Module** — create `TalkyConnectedLens` (already at `Assets/TalkyConnectedLens.connectedLensModule` if present).
2. Select **Talky → Controllers → TalkyConnectedLens** and wire the module to `TalkyConnectedLensBootstrap`.
3. On **TalkyMain**, wire **Connected Lens** → the bootstrap script (optional but recommended).

### 3. Lens project settings

| Setting | Value |
|---|---|
| Target platform | **Spectacles** |
| Connected Lenses | Enabled via Connected Lens Module asset |
| Microphone permission | Required for PTT voice (`Assets/Audio/TalkyMic.micaudio`) |
| Internet permission | Required for Snap Cloud Realtime |

### 4. Dual Preview panels

1. **Window → General → Preview** — open a second preview (Preview 1 + Preview 2 side by side).
2. Set both to **Spectacles / Interactive** device.
3. On the Connected Lens Module Inspector, both previews must share the **Session ID**.
4. Click **Randomize Session ID** if previews fail to sync or you need a clean session.

---

## End-to-end test flow (dual-preview)

1. **Reset** both previews — dismiss the **Got it!** onboarding panel if shown.
2. Wait for status **"Ready — spin dial & tap GO or JOIN"** (Snap Cloud auth complete).
3. On **Preview 1**: spin the radio dial to e.g. `042`, tap **GO**.
4. On **Preview 2**: spin dial to `042`, tap **JOIN**.
5. Verify:
   - **● LIVE** indicator and emoji row (e.g. `👻●  🦊`) show **2 connected users**
   - Participant count updates (`2/8`)
   - Hold **TALK** on Preview 1 — Preview 2 shows speaking indicator and **hears voice**
   - Tap a reaction emoji on the radio grid — both hear SFX
6. Tap **Hide** to collapse HUD panels; tap **UI** on the radio to restore.
7. Tap **LEAVE** on either preview — returns to lobby.

### Different room codes = isolated

- Preview 1 in room `042`, Preview 2 in room `999` → **no** shared voice or reactions.

---

## Real Spectacles testing (deployed Lens)

1. Publish/sign the Lens with Snap Cloud credentials embedded in the project asset.
2. Sign in with **different Snapchat accounts** on each pair of Specs.
3. Both users enter the same 3-digit code (one taps **GO**, other **JOIN**).
4. Hold **TALK** for push-to-talk; enable **Always on** from the room HUD if desired.
5. Voice only transmits inside the active Realtime channel for that code.

---

## Architecture notes

- **Channel name:** `walkie-{code}` (e.g. `walkie-042`)
- **Max participants:** 8 (presence-tracked)
- **Voice pipeline:** mic → 400 ms WAV chunks (base64) → Realtime broadcast → `RemoteMediaModule.loadResourceAsAudioTrackAsset` playback
- **Reactions:** broadcast event `reaction` + local SFX
- **Room lifecycle:** subscribe → presence track → untrack on leave; disconnects clean up via `CLOSED` handler

---

## Tips

- Each preview gets a unique display name (`Talky Friend-###`) in the participant list.
- **No background music** on launch — only intentional SFX.
- Voice mic streaming is limited in Preview; verify PTT on Specs hardware for production QA.
- `Host requires authentication` / My Lenses login errors in Preview logs are **expected** for Connected Lens — Snap Cloud rooms still work independently.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Signing in… try again" | Wait 1–2 s after reset for Snap Cloud auth; ensure Anonymous provider enabled |
| Previews don't see each other | Import Snap Cloud credentials; both join **same** 3-digit code |
| No remote voice heard | Confirm credentials configured (not local demo); hold TALK; check mic asset |
| Connected Lens session stuck | Randomize Session ID; reset all previews |
| Room full at 8 | Pick a different code |
| Local demo only | Replace placeholders in `SupabaseProject_talky.supabaseProject` |
