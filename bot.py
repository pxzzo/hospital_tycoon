import os
from typing import Literal

from dotenv import load_dotenv
import discord
from discord import app_commands

from f1_api import ErgastClient

load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN")
GUILD_ID = os.getenv("DISCORD_GUILD_ID")

if not TOKEN:
    raise RuntimeError("DISCORD_TOKEN is not set")

INTENTS = discord.Intents.default()


class F1Bot(discord.Client):
    def __init__(self) -> None:
        super().__init__(intents=INTENTS)
        self.tree = app_commands.CommandTree(self)
        self.ergast = ErgastClient()

    async def setup_hook(self) -> None:
        if GUILD_ID:
            guild = discord.Object(id=int(GUILD_ID))
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
        else:
            await self.tree.sync()

    async def close(self) -> None:
        await self.ergast.__aexit__(None, None, None)
        await super().close()


client = F1Bot()


@client.tree.command(name="next_race", description="Zeigt das nächste Formel-1-Rennen an")
async def next_race(interaction: discord.Interaction) -> None:
    await interaction.response.defer(thinking=True)
    race = await client.ergast.get_next_race()
    circuit = race["Circuit"]
    embed = discord.Embed(
        title=f"Nächstes Rennen: {race['raceName']}",
        description=f"{circuit['circuitName']} – {circuit['Location']['locality']}, {circuit['Location']['country']}",
        color=discord.Color.red(),
    )
    embed.add_field(name="Datum", value=race["date"], inline=True)
    embed.add_field(name="Runde", value=race["round"], inline=True)
    if "time" in race:
        embed.add_field(name="Uhrzeit (UTC)", value=race["time"], inline=True)
    await interaction.followup.send(embed=embed)


@client.tree.command(name="standings", description="Zeigt die aktuelle WM-Wertung")
@app_commands.describe(category="drivers oder constructors")
async def standings(
    interaction: discord.Interaction, category: Literal["drivers", "constructors"]
) -> None:
    await interaction.response.defer(thinking=True)
    if category == "drivers":
        data = await client.ergast.get_driver_standings()
        lines = [
            f"{entry['position']}. {entry['Driver']['givenName']} {entry['Driver']['familyName']} – {entry['points']}"
            for entry in data[:10]
        ]
        title = "Top 10 Fahrerwertung"
    else:
        data = await client.ergast.get_constructor_standings()
        lines = [
            f"{entry['position']}. {entry['Constructor']['name']} – {entry['points']}"
            for entry in data[:10]
        ]
        title = "Top 10 Konstrukteurswertung"

    embed = discord.Embed(title=title, description="\n".join(lines), color=discord.Color.blue())
    await interaction.followup.send(embed=embed)


@client.tree.command(name="driver", description="Zeigt Infos zu einem Fahrer via Code (z. B. ver, ham)")
@app_commands.describe(code="Fahrer-Code aus Ergast (z. B. ver, ham, nor)")
async def driver(interaction: discord.Interaction, code: str) -> None:
    await interaction.response.defer(thinking=True)
    try:
        driver_info = await client.ergast.get_driver(code.lower())
    except ValueError:
        await interaction.followup.send("Fahrer nicht gefunden.")
        return
    embed = discord.Embed(
        title=f"{driver_info['givenName']} {driver_info['familyName']}",
        color=discord.Color.green(),
    )
    embed.add_field(name="Code", value=driver_info.get("code", "–"), inline=True)
    embed.add_field(name="Geburtsdatum", value=driver_info.get("dateOfBirth", "–"), inline=True)
    embed.add_field(name="Nationalität", value=driver_info.get("nationality", "–"), inline=True)
    if "url" in driver_info:
        embed.add_field(name="Profil", value=driver_info["url"], inline=False)
    await interaction.followup.send(embed=embed)


@client.event
async def on_ready() -> None:
    await client.ergast.__aenter__()
    print(f"Logged in as {client.user}")


client.run(TOKEN)
