# F1 Discord Bot (discord.js)

Ein Discord Bot für eine F1‑Team‑Season. Aktueller Stand:

- `/f1admin start-season` postet Team‑Buttons in `#f1`
- Klick auf ein Team deaktiviert den Button automatisch
- Persistente Season-ID + Speicherung der Teams
- Lock sobald alle Teams belegt sind
- Team‑Overview Embed
- Qualifying + Race Simulation
- Weekend-System inkl. Punkte & Money Economy

## Setup

1. Node.js 18+ installieren
2. Abhängigkeiten installieren:
   ```bash
   npm install
   ```
3. `.env` anlegen (siehe `.env.example`):
   ```bash
   DISCORD_TOKEN="..."
   DISCORD_CLIENT_ID="..."
   F1_CHANNEL_NAME="f1"
   ```
4. Bot starten:
   ```bash
   npm start
   ```

## Hinweis
- Commands werden beim Start registriert (global). Das kann ein paar Minuten dauern.
