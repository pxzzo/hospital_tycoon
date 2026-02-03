const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, F1_CHANNEL_NAME } = process.env;

if (!DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is required");
}

if (!DISCORD_CLIENT_ID) {
  throw new Error("DISCORD_CLIENT_ID is required");
}

const TEAM_NAMES = [
  "Red Bull",
  "Ferrari",
  "Mercedes",
  "McLaren",
  "Aston Martin",
  "Alpine",
  "Williams",
  "Haas",
  "RB",
  "Sauber",
];
const SEASON_PATH = path.join(__dirname, "..", "data", "season.json");
const POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const MONEY_PER_POINT = 10000;
const MAX_ROUNDS = 10;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const commandData = [
  new SlashCommandBuilder()
    .setName("f1admin")
    .setDescription("Admin commands for F1 season")
    .addSubcommand((sub) =>
      sub.setName("start-season").setDescription("Post team selection buttons")
    )
    .addSubcommand((sub) =>
      sub.setName("team-overview").setDescription("Show team standings overview")
    )
    .addSubcommand((sub) =>
      sub
        .setName("advance-weekend")
        .setDescription("Run qualifying and race simulation for this round")
    ),
].map((command) => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), {
    body: commandData,
  });
}

function buildTeamButtons(disabledTeams = new Set()) {
  const rows = [];
  const perRow = 5;
  for (let i = 0; i < TEAM_NAMES.length; i += perRow) {
    const slice = TEAM_NAMES.slice(i, i + perRow);
    const row = new ActionRowBuilder();
    slice.forEach((team) => {
      const button = new ButtonBuilder()
        .setCustomId(`team:${team}`)
        .setLabel(team)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabledTeams.has(team));
      row.addComponents(button);
    });
    rows.push(row);
  }
  return rows;
}

function generateSeasonId() {
  return `S${Date.now().toString(36).toUpperCase()}`;
}

function loadSeason() {
  if (!fs.existsSync(SEASON_PATH)) {
    return null;
  }
  const raw = fs.readFileSync(SEASON_PATH, "utf8");
  return JSON.parse(raw);
}

function saveSeason(season) {
  fs.writeFileSync(SEASON_PATH, JSON.stringify(season, null, 2));
}

function getOrCreateSeason() {
  const existing = loadSeason();
  if (existing && existing.status === "active") {
    return existing;
  }
  const season = {
    seasonId: generateSeasonId(),
    status: "active",
    round: 0,
    teams: TEAM_NAMES.reduce((acc, team) => {
      acc[team] = { ownerId: null, ownerName: null, points: 0, money: 0 };
      return acc;
    }, {}),
    history: [],
  };
  saveSeason(season);
  return season;
}

function getDisabledTeamsFromSeason(season) {
  const disabledTeams = new Set();
  Object.entries(season.teams).forEach(([team, data]) => {
    if (data.ownerId) {
      disabledTeams.add(team);
    }
  });
  return disabledTeams;
}

function allTeamsTaken(season) {
  return Object.values(season.teams).every((team) => team.ownerId);
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function simulateWeekend(season) {
  const activeTeams = Object.entries(season.teams)
    .filter(([, team]) => team.ownerId)
    .map(([name]) => name);

  if (activeTeams.length === 0) {
    throw new Error("No teams have been selected yet.");
  }

  const qualifying = shuffle(activeTeams);
  const race = shuffle(activeTeams);

  race.slice(0, POINTS_TABLE.length).forEach((teamName, index) => {
    const points = POINTS_TABLE[index];
    season.teams[teamName].points += points;
    season.teams[teamName].money += points * MONEY_PER_POINT;
  });

  season.round += 1;
  season.history.push({
    round: season.round,
    qualifying,
    race,
  });

  if (season.round >= MAX_ROUNDS) {
    season.status = "complete";
  }

  saveSeason(season);

  return { qualifying, race, round: season.round };
}

function buildOverviewEmbed(season) {
  const sortedTeams = Object.entries(season.teams).sort(
    ([, a], [, b]) => b.points - a.points
  );
  const description = sortedTeams
    .map(([team, data], index) => {
      const owner = data.ownerName || "Unclaimed";
      return `${index + 1}. ${team} — ${owner} | ${data.points} P | €${data.money}`;
    })
    .join("\n");

  return new EmbedBuilder()
    .setTitle(`Season ${season.seasonId} Overview`)
    .setDescription(description || "No teams assigned yet.")
    .setFooter({ text: `Round ${season.round}/${MAX_ROUNDS}` })
    .setColor(0xff0000);
}

function buildWeekendEmbed(result) {
  return new EmbedBuilder()
    .setTitle(`Weekend Simulation - Round ${result.round}`)
    .addFields(
      {
        name: "Qualifying",
        value: result.qualifying.map((team, index) => `${index + 1}. ${team}`).join("\n"),
        inline: true,
      },
      {
        name: "Race",
        value: result.race.map((team, index) => `${index + 1}. ${team}`).join("\n"),
        inline: true,
      }
    )
    .setColor(0x00b0ff);
}

async function handleStartSeason(interaction) {
  const season = loadSeason();
  if (season && season.status === "active") {
    await interaction.reply({
      content: `Season ${season.seasonId} is already active.`,
      ephemeral: true,
    });
    return;
  }

  const created = getOrCreateSeason();
  const channelName = F1_CHANNEL_NAME || "f1";
  const channel = interaction.guild.channels.cache.find(
    (ch) => ch.name === channelName
  );

  if (!channel) {
    await interaction.reply({
      content: `Channel #${channelName} not found.`,
      ephemeral: true,
    });
    return;
  }

  const disabledTeams = getDisabledTeamsFromSeason(created);
  await channel.send({
    content: `Season ${created.seasonId} gestartet! Wähle dein F1‑Team:`,
    components: buildTeamButtons(disabledTeams),
  });

  await interaction.reply({
    content: `Team-Buttons wurden gepostet. Season-ID: ${created.seasonId}`,
    ephemeral: true,
  });
}

async function handleTeamOverview(interaction) {
  const season = loadSeason();
  if (!season) {
    await interaction.reply({
      content: "No active season found. Use /f1admin start-season first.",
      ephemeral: true,
    });
    return;
  }
  const embed = buildOverviewEmbed(season);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAdvanceWeekend(interaction) {
  const season = loadSeason();
  if (!season || season.status !== "active") {
    await interaction.reply({
      content: "No active season found. Use /f1admin start-season first.",
      ephemeral: true,
    });
    return;
  }

  if (season.round >= MAX_ROUNDS) {
    await interaction.reply({
      content: `Season ${season.seasonId} is already complete.`,
      ephemeral: true,
    });
    return;
  }

  try {
    const result = simulateWeekend(season);
    const embed = buildWeekendEmbed(result);
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    await interaction.reply({
      content: error.message,
      ephemeral: true,
    });
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "f1admin") {
      const sub = interaction.options.getSubcommand();
      if (sub === "start-season") {
        await handleStartSeason(interaction);
      } else if (sub === "team-overview") {
        await handleTeamOverview(interaction);
      } else if (sub === "advance-weekend") {
        await handleAdvanceWeekend(interaction);
      }
    }
    return;
  }

  if (interaction.isButton()) {
    if (!interaction.customId.startsWith("team:")) {
      return;
    }

    const season = getOrCreateSeason();
    if (season.status !== "active") {
      await interaction.reply({
        content: "Season is not active.",
        ephemeral: true,
      });
      return;
    }

    const selectedTeam = interaction.customId.replace("team:", "");
    const teamState = season.teams[selectedTeam];

    if (teamState?.ownerId) {
      await interaction.reply({
        content: "Dieses Team ist bereits vergeben.",
        ephemeral: true,
      });
      return;
    }

    season.teams[selectedTeam] = {
      ...teamState,
      ownerId: interaction.user.id,
      ownerName: interaction.user.username,
    };

    saveSeason(season);

    const disabledTeams = getDisabledTeamsFromSeason(season);
    const components = buildTeamButtons(disabledTeams);

    if (allTeamsTaken(season)) {
      components.forEach((row) => {
        row.components.forEach((button) => button.setDisabled(true));
      });
    }

    await interaction.update({
      content: allTeamsTaken(season)
        ? `Alle Teams sind vergeben. Season ${season.seasonId} ist gelockt.`
        : interaction.message.content,
      components,
    });
  }
});

registerCommands()
  .then(() => client.login(DISCORD_TOKEN))
  .catch((error) => {
    console.error("Failed to start bot", error);
    process.exit(1);
  });
