# Nod — Disclaimer

**Version 1.1 ｜ 2026-08 ｜ Please read before use**

## 1. Intended Use

Nod is a **learning and technical demonstration tool** built to showcase real-time speech recognition, AI generation, and desktop integration.

- **Do not use during certified exams or standardized tests** — this may constitute academic fraud.
- **Use in real job interviews** may violate employer policies, recruiting terms, or online interview platform rules (Teams / Zoom / Meet), and may be detectable by the platform (always-on-top window, background audio monitoring).
- Users must verify the rules of their own context and **bear full responsibility** for their use.

## 2. Privacy & Data Flow

By using Nod you acknowledge and agree to the following data handling:

| Data | Processor | Purpose |
|---|---|---|
| Interview question audio (live stream, not stored locally) | AssemblyAI (USA) | Speech-to-text |
| Question text + resume / job description | OpenRouter (and upstream models, overseas) | Answer generation |
| Question & answer history (in-memory only, cleared on exit) | Local | Context & deduplication |

- **Whose quota**: the keys you enter use **your own accounts**; usage is billed to your own AssemblyAI / OpenRouter account.
- **How long data is kept**: nothing is saved locally (in-memory only, cleared on exit). However, audio streams and questions are sent to third parties — AssemblyAI may retain transcripts in its account by default (per its data-retention policy), and OpenRouter / upstream models may log requests/responses per their own policies.
- **How to revoke consent**: ① uninstall Nod to stop all data transmission; ② delete the `profile` fields in `%APPDATA%\Nod\config.json` to stop personalized data (resume/JD) upload; ③ delete `%APPDATA%\Nod\secrets.json` to remove your keys; ④ to have already-sent data deleted, contact the respective provider (AssemblyAI / OpenRouter).
- **Do not enter sensitive information you are not willing to share with the providers above.**

## 3. Disclaimer of Warranty

- This software is provided **"AS IS"** without warranty of any kind, express or implied (including merchantability, fitness for a particular purpose, or accuracy of results).
- Generated content is produced by AI models and **may be inaccurate or incomplete**; users must exercise their own judgment.
- The author is **not liable** for any direct or indirect damages arising from the use of this software (including but not limited to failed interviews, revoked offers, disciplinary action, or account risk).

## 4. License & Prohibited Acts

- The code is copyrighted by the author. Personal learning, modification, and private use are permitted.
- **Prohibited**: unauthorized redistribution of the packaged build, commercial use (requires separate authorization), reverse engineering for malicious purposes, removal of this notice.

## 5. Contact

Questions or commercial licensing: contact the author via the project repository.
