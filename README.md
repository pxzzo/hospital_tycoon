# F1 Discord Bot

Ein schlanker Discord-Bot, der aktuelle Formel‑1‑Infos via [Ergast API](https://ergast.com/mrd/) liefert.

## Features
- `/next_race` – nächstes Rennen inkl. Datum/Ort
- `/standings drivers` – Fahrerwertung
- `/standings constructors` – Konstrukteurswertung
- `/driver <code>` – Infos zu einem Fahrer (z. B. `ver`, `ham`, `nor`)

## Setup

1. Python 3.11+ installieren
2. Abhängigkeiten installieren:
   ```bash
   pip install -r requirements.txt
   ```
3. Umgebungsvariablen setzen (siehe `.env.example`):
   ```bash
   export DISCORD_TOKEN="..."
   export DISCORD_GUILD_ID="1234567890"  # optional, beschleunigt Slash-Command Sync
   ```
4. Bot starten:
   ```bash
   python bot.py
   ```

## Hinweise
- Die Ergast API ist kostenlos und rate-limited. Der Bot cached Antworten kurzzeitig.
- `DISCORD_GUILD_ID` ist optional. Ohne diese Variable werden Commands global synchronisiert (kann dauern).
