// ────────────────────────── CONFIGURATION ──────────────────────────
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const express = require('express');
const { Pool } = require('pg');
const path   = require('path');
const fs     = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;
app.use('/cartes', express.static(path.join(__dirname, 'cartes')));
app.listen(PORT, () => console.log(`✅ Express (static) sur ${PORT}`));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const pool   = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const cartes = JSON.parse(fs.readFileSync('./cartes.json', 'utf8'));

// ────────────────────────── SLASH COMMANDS ──────────────────────────
const commands = [
  new SlashCommandBuilder().setName('pioche2').setDescription('Tire une carte'),
  new SlashCommandBuilder().setName('booster2').setDescription('Booster de 3 cartes'),
  new SlashCommandBuilder().setName('kollek2').setDescription('Voir ta collection'),
  new SlashCommandBuilder()
    .setName('voir2')
    .setDescription("Voir une carte de ta collection")
    .addIntegerOption(opt =>
      opt.setName('id').setDescription("ID de la carte").setRequired(true)
    )
].map(c => c.toJSON());

// ────────────────────────── READY ──────────────────────────
client.once('ready', async () => {
  console.log(`🤖 Connecté : ${client.user.tag}`);

  const rest  = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const appId = (await rest.get(Routes.oauth2CurrentApplication())).id;
  await rest.put(Routes.applicationCommands(appId), { body: commands });
  console.log('✅ Slash commands enregistrées');

  await pool.query(`CREATE TABLE IF NOT EXISTS collection(user_id TEXT, card_id INT);`);
});

// ────────────────────────── INTERACTIONS ──────────────────────────
client.on('interactionCreate', async (inter) => {
  if (!inter.isChatInputCommand()) return;
  const uid = inter.user.id;

  if (inter.commandName === 'pioche2') {
    const now = Date.now(), wait = 90 * 60 * 1000;
    try {
      await inter.deferReply();
      const carte = cartes[Math.floor(Math.random() * cartes.length)];
      await pool.query('INSERT INTO collection(user_id,card_id) VALUES ($1,$2)', [uid, carte.id]);
      return inter.editReply({ embeds: [{ title: `#${carte.id} • ${carte.name}` }], files: [carte.image] });
    } catch (e) {
      console.error(e);
      return inter.editReply('❌ Erreur pioche');
    }
  }

  if (inter.commandName === 'booster2') {
    try {
      await inter.deferReply();
      const tirages = [];
      for (let i = 0; i < 3; i++) {
        const carte = cartes[Math.floor(Math.random() * cartes.length)];
        await pool.query('INSERT INTO collection(user_id,card_id) VALUES ($1,$2)', [uid, carte.id]);
        tirages.push(carte);
      }
      await inter.editReply('📦 Booster ouvert !');
      for (const carte of tirages) {
        await inter.followUp({ embeds: [{ title: `#${carte.id} • ${carte.name}` }], files: [carte.image] });
      }
    } catch (e) {
      console.error(e);
      return inter.editReply('❌ Erreur booster');
    }
  }

  if (inter.commandName === 'kollek2') {
    try {
      await inter.deferReply();
      const col = await pool.query('SELECT card_id FROM collection WHERE user_id=$1', [uid]);
      if (!col.rowCount) return inter.editReply('😢 Aucune carte.');
      const map = {};
      col.rows.forEach(r => map[r.card_id] = (map[r.card_id]||0)+1);
      const lignes = Object.entries(map).map(([id, n]) => {
        const c = cartes.find(x => x.id === Number(id));
        return `#${c.id} • **${c.name}** × ${n}`;
      });
      const embeds = [];
      for (let i = 0; i < lignes.length; i += 10) {
        embeds.push({
          title: `📘 Collection de ${inter.user.username} (${Math.floor(i/10)+1}/${Math.ceil(lignes.length/10)})`,
          description: lignes.slice(i, i+10).join('\n'),
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
        if (i.user.id !== uid) return i.reply({ content: 'Pas ton menu !', ephemeral: true });
        page = i.customId === 'next' ? (page + 1) % embeds.length : (page - 1 + embeds.length) % embeds.length;
        await i.update({ embeds: [embeds[page]] });
      });
    } catch (e) {
      console.error(e);
      return inter.editReply('❌ Erreur kollek');
    }
  }

  if (inter.commandName === 'voir2') {
    try {
      await inter.deferReply();
      const wantedId = inter.options.getInteger('id');
      const col = await pool.query('SELECT card_id FROM collection WHERE user_id = $1', [uid]);
      if (!col.rowCount) return inter.editReply("😢 Tu n'as aucune carte.");
      const owned = col.rows.map(r => Number(r.card_id));
      if (!owned.includes(wantedId)) return inter.editReply("❌ Tu ne possèdes pas cette carte.");
      const carte = cartes.find(c => c.id === wantedId);
      const count = owned.filter(id => id === wantedId).length;
      const embed = {
        title: `#${carte.id} • ${carte.name}`,
        description: `Quantité : **${count}**`,
        image: { url: carte.image },
        color: 0x3498db
      };
      return inter.editReply({ embeds: [embed] });
    } catch (e) {
      console.error(e);
      return inter.editReply("❌ Erreur lors de l'affichage de la carte.");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
