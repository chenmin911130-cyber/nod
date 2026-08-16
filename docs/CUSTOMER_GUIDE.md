# Nod — Open-Source Build: Installation & Usage Guide

## Installation

Choose one of the two options:

- **Nod Setup 1.1.0.exe** — Installer (recommended). Double-click → Next → Finish. A Nod icon appears on your desktop.
- **Nod 1.1.0.exe** — Portable edition, no installation required. Double-click to run (can be copied to a USB drive).

> About the security prompt (this build is unsigned):
> This build has not been signed with a code-signing certificate, so Windows SmartScreen may show
> an "unknown publisher" warning on first run, and some antivirus software may raise a false
> positive (common for PyInstaller-packaged programs). Before proceeding, verify the file integrity
> against the included `SHA256SUMS.txt` (run `certutil -hashfile <file> SHA256`).

## First Run: Enter Your API Keys

On first launch Nod shows an "API Keys required" panel. Enter two keys — both are stored **only on
this machine** (`%APPDATA%\Nod\secrets.json`) and are never sent to the author or any third party:

1. **OpenRouter API Key** (AI answers) — sign up and create a key at [openrouter.ai/keys](https://openrouter.ai/keys) (free credit available).
2. **AssemblyAI API Key** (speech-to-text) — sign up and create a key at [assemblyai.com/app](https://www.assemblyai.com/app) (free tier available).

Click **Save & start**. To change keys later, delete `%APPDATA%\Nod\secrets.json` and restart.

## How to Use

1. Open Nod and press **F3** to start Auto Listen (status shows *Listening for the next question…*).
2. Speak in Teams / Zoom (or play an interview question audio) — the sound comes out of your speakers/headset.
3. Nod automatically captures the question → generates an answer → displays it in the window (copy with one click).
4. You can also type a question directly in the input box at the bottom.

## Configuration & Personalization

Settings live in **`%APPDATA%\Nod\config.json`** (paste that path into the Explorer address bar), **not** in the install directory. You can edit:

- `profile.resume_summary` — your resume summary
- `profile.target_role` / `company` / `jd` — target role / company / job description
- `profile.style` — answer style

Restart Nod after editing for changes to take effect.

## Keyboard Shortcuts

| Key | Function |
|---|---|
| F2 | Record a question manually |
| F3 | Auto Listen (automatic question detection + answer) |
| F4 | Clear conversation |
| F8 | Toggle fullscreen / window mode |
| F9 | Stealth mode (hide window from screen capture) |

## Network Requirements

- Speech recognition runs on **AssemblyAI (cloud)** using your own key — internet required.
- AI answers run on **OpenRouter (cloud)** using your own key — internet required.

## Privacy Notes (please read)

| Data | Processor | Purpose |
|---|---|---|
| Interview question audio (live stream, not stored locally) | AssemblyAI (USA) | Speech-to-text |
| Question text + resume / job description | OpenRouter (and upstream models, overseas) | Answer generation |
| Question & answer history (in-memory only, cleared on exit) | Local | Context & deduplication |

- **Whose quota**: the keys you enter use **your own accounts**; usage is billed to your own AssemblyAI / OpenRouter account.
- **How long data is kept**: nothing is saved locally — all audio and conversation history is in-memory and cleared on exit. However, audio streams and questions are sent to third parties: AssemblyAI may retain transcripts in its account by default (per its data-retention policy), and OpenRouter / upstream models may log requests/responses per their own policies.
- **How to revoke consent**: ① uninstall Nod to stop all data transmission; ② delete the `profile` fields in `%APPDATA%\Nod\config.json` to stop personalized data upload; ③ delete `%APPDATA%\Nod\secrets.json` to remove your keys; ④ to have already-sent data deleted, contact the respective provider (AssemblyAI / OpenRouter).
- **Do not enter sensitive information you are not willing to share with the providers above.**
