// ────────────────────────── CONFIG ──────────────────────────
require('dotenv').config();
const {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
app.use('/cartes', express.static(path.join(__dirname, 'cartes')));
app.listen(PORT, () => console.log(`✅ Express (static) sur ${PORT}`));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const cartes = JSON.parse(fs.readFileSync('./cartes.json', 'utf8'));

const commands = [
  new SlashCommandBuilder().setName('pioche').setDescription('Tire une carte'),
  new SlashCommandBuilder().setName('kollek').setDescription('Voir ta collection'),
  new SlashCommandBuilder().setName('booster').setDescription('Booster de 3 cartes'),
  new SlashCommandBuilder().setName('voir').setDescription('Voir une carte').addIntegerOption(opt =>
    opt.setName('id').setDescription("ID de la carte").setRequired(true))
].map(c => c.toJSON());

client.once('ready', async () => {
  console.log(`🤖 Connecté : ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const appId = (await rest.get(Routes.oauth2CurrentApplication())).id;
  await rest.put(Routes.applicationCommands(appId), { body: commands });
  console.log('✅ Slash commands enregistrées');
  await pool.query(`CREATE TABLE IF NOT EXISTS collection(user_id TEXT, card_id INT);`);
});

client.on('interactionCreate', async (inter) => {
  if (!inter.isChatInputCommand()) return;
  const uid = inter.user.id;

  if (inter.commandName === 'pioche') {
    await inter.deferReply();
    const carte = cartes[Math.floor(Math.random() * cartes.length)];
    await pool.query('INSERT INTO collection(user_id, card_id) VALUES ($1, $2)', [uid, carte.id]);
    const embed = {
      title: `#${carte.id} • ${carte.name}`,
      description: `Tu as pioché une carte !`,
      image: { url: carte.image },
      color: 0x3498db
    };
    return inter.editReply({ embeds: [embed] });
  }

  if (inter.commandName === 'booster') {
    await inter.deferReply();
    const tirages = [];
    for (let i = 0; i < 3; i++) {
      const carte = cartes[Math.floor(Math.random() * cartes.length)];
      await pool.query('INSERT INTO collection(user_id, card_id) VALUES ($1, $2)', [uid, carte.id]);
      tirages.push(carte);
    }
    await inter.editReply('📦 Booster ouvert !');
    for (const carte of tirages) {
      const embed = {
        title: `#${carte.id} • ${carte.name}`,
        description: `Nouvelle carte !`,
        image: { url: carte.image },
        color: 0x3498db
      };
      await inter.followUp({ embeds: [embed] });
    }
  }

  if (inter.commandName === 'kollek') {
    await inter.deferReply();
    const col = await pool.query('SELECT card_id FROM collection WHERE user_id=$1', [uid]);
    if (!col.rowCount) return inter.editReply('😢 Aucune carte.');

    const map = {};
    col.rows.forEach(r => map[r.card_id] = (map[r.card_id] || 0) + 1);
    const lignes = Object.entries(map).map(([id, n]) => {
      const c = cartes.find(x => x.id === Number(id));
      return `#${c.id} • **${c.name}** × ${n}`;
    });

    const embeds = [];
    for (let i = 0; i < lignes.length; i += 10) {
      embeds.push({
        title: `📘 Kollek de ${inter.user.username} (${Math.floor(i / 10) + 1}/${Math.ceil(lignes.length / 10)})`,
        description: lignes.slice(i, i + 10).join('\n'),
        color: 0x3498db
      });
    }

    if (embeds.length === 1) return inter.editReply({ embeds });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('prev').setLabel('◀️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('next').setLabel('▶️').setStyle(ButtonStyle.Secondary)
    );
    let page = 0;
    const msg = await inter.editReply({ embeds: [embeds[0]], components: [row] });
    const collector = msg.createMessageComponentCollector({ time: 60_000 });
    collector.on('collect', async i => {
      if (i.user.id !== uid) return i.reply({ content: "Pas ton menu !", ephemeral: true });
      page = i.customId === 'next' ? (page + 1) % embeds.length : (page - 1 + embeds.length) % embeds.length;
      await i.update({ embeds: [embeds[page]] });
    });
  }

  if (inter.commandName === 'voir') {
    await inter.deferReply();
    const wantedId = inter.options.getInteger('id');
    const col = await pool.query('SELECT card_id FROM collection WHERE user_id=$1', [uid]);
    const owned = col.rows.map(r => Number(r.card_id));
    const uniques = [...new Set(owned)];
    if (!uniques.includes(wantedId)) return inter.editReply("❌ Tu n'as pas cette carte");

    const sorted = uniques.sort((a, b) => a - b);
    let index = sorted.indexOf(wantedId);
    const sendEmbed = async () => {
      const cardId = sorted[index];
      const count = owned.filter(id => id === cardId).length;
      const card = cartes.find(c => c.id === cardId);
      return {
        title: `#${card.id} • ${card.name}`,
        description: `Quantité : **${count}**`,
        image: { url: card.image },
        color: 0x3498db,
        footer: { text: `Carte ${index + 1} / ${sorted.length}` }
      };
    };
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('prev').setLabel('◀️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('next').setLabel('▶️').setStyle(ButtonStyle.Secondary)
    );
    const msg = await inter.editReply({ embeds: [await sendEmbed()], components: [row] });
    const collector = msg.createMessageComponentCollector({ time: 60_000 });
    collector.on('collect', async i => {
      if (i.user.id !== uid) return i.reply({ content: "Pas ton menu !", ephemeral: true });
      index = i.customId === 'next' ? (index + 1) % sorted.length : (index - 1 + sorted.length) % sorted.length;
      await i.update({ embeds: [await sendEmbed()] });
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
