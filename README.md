# stollberg-f1-bot

Discord F1 Manager Bot (interactive weekend sessions).

## Setup
1) `npm i`
2) Copy `.env.example` to `.env` and fill:
   - DISCORD_TOKEN, CLIENT_ID, GUILD_ID, MONGO_URI
   - F1_CHANNEL_ID = your #f1 channel id
   - ADMIN_ROLE_ID = role allowed to use /f1admin (optional, else Administrator)
3) Register commands: `npm run register`
4) Run: `npm run dev`

## Admin flow
- `/f1admin season start` posts a Season Start embed in #f1 with 11 join buttons
- `/f1admin weekend start round:<1..24>` sets ACTIVE weekend
- `/f1admin session start kind:qualifying` runs a slow live ticker (times appear gradually)
- `/f1admin session start kind:race` starts a live tick-based race with strategy buttons

## User flow
- Click a team button in #f1 to claim a team
- `/f1 team` shows your team + 2 drivers
- During sessions: use the strategy buttons on the live message (Mode / Pit / Tire)
