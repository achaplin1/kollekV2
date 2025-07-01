// index.js
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

const commands = [
  new SlashCommandBuilder().setName('pioche2').setDescription('Tirer une carte'),
  new SlashCommandBuilder().setName('kollek2').setDescription('Voir sa collection')
].map(c => c.toJSON());

client.once('ready', async () => {
  console.log(`🤖 Connecté : ${client.user.tag}`);
  const rest  = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const appId = (await rest.get(Routes.oauth2CurrentApplication())).id;
  await rest.put(Routes.applicationCommands(appId), { body: commands });
  console.log('✅ Slash commands enregistrées');

  await pool.query(`CREATE TABLE IF NOT EXISTS pioches  (user_id TEXT PRIMARY KEY, last_draw  BIGINT);`);
  await pool.query(`CREATE TABLE IF NOT EXISTS collection(user_id TEXT, card_id INT);`);
});

client.on('interactionCreate', async inter => {
  if (!inter.isChatInputCommand()) return;
  const uid = inter.user.id;

  if (inter.commandName === 'pioche2') {
    const now = Date.now(), wait = 90 * 60 * 1000;
    try {
      await inter.deferReply();
      const { rows } = await pool.query('SELECT last_draw FROM pioches WHERE user_id=$1', [uid]);
      const last = rows[0]?.last_draw ?? 0;
      if (now - last < wait) {
        const m = Math.ceil((wait - (now - last)) / 60000);
        return inter.editReply(`⏳ Attends encore ${m} min pour repiocher.`);
      }

      const carte = cartes[Math.floor(Math.random() * cartes.length)];
      await pool.query('INSERT INTO collection(user_id,card_id) VALUES ($1,$2)', [uid, carte.id]);
      await pool.query('INSERT INTO pioches(user_id,last_draw) VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET last_draw=$2', [uid, now]);

      const embed = {
        title: `#${carte.id} • ${carte.name}`,
        description: `Rareté : *${carte.rarity ?? 'inconnue'}*`,
        color: 0x3498db
      };

      return inter.editReply({
        embeds: [embed],
        files: [{
          attachment: `https://comfortable-abundance-production.up.railway.app/cartes/${encodeURIComponent(path.basename(carte.image))}`,
          name: path.basename(carte.image)
        }]
      });
    } catch (e) {
      console.error(e);
      return inter.editReply('❌ Erreur pioche');
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

      const embeds=[];
      for(let i=0;i<lignes.length;i+=10){
        embeds.push({
          title:`📘 Collection de ${inter.user.username} (${Math.floor(i/10)+1}/${Math.ceil(lignes.length/10)})`,
          description:lignes.slice(i,i+10).join('\n')+
            `\n\nTotal : ${col.rowCount} cartes`,
          color:0x3498db
        });
      }

      if (embeds.length===1) return inter.editReply({embeds});
      const row=new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('◀️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('next').setLabel('▶️').setStyle(ButtonStyle.Secondary)
      );
      let page=0;
      const msg=await inter.editReply({embeds:[embeds[0]], components:[row]});
      const collector=msg.createMessageComponentCollector({time:60_000});
      collector.on('collect',async i=>{
        if(i.user.id!==uid) return i.reply({ content:'Pas ton menu !',ephemeral:true});
        page = i.customId==='next' ? (page+1)%embeds.length : (page-1+embeds.length)%embeds.length;
        await i.update({ embeds:[embeds[page]]});
      });
    } catch (e) {
      console.error(e);
      return inter.editReply('❌ Erreur kollek');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
