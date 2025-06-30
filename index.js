
import express from 'express';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
import pkg from 'pg';

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use('/cartes', express.static('public/cartes'));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const CLIENT_ID = 'TON_APPLICATION_ID_ICI';

client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName('booster2').setDescription('Ouvre un booster version 2'),
    new SlashCommandBuilder().setName('pioche2').setDescription('Pioche une carte aléatoire'),
    new SlashCommandBuilder().setName('voir2').setDescription('Voir une carte (id 1 par défaut)'),
    new SlashCommandBuilder().setName('kollek2').setDescription('Affiche ta collection')
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    console.log('⏳ Enregistrement des commandes slash...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Commandes enregistrées');
  } catch (error) {
    console.error('❌ Erreur enregistrement slash:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  switch (interaction.commandName) {
    case 'booster2': {
      const result = await pool.query('SELECT * FROM cartes ORDER BY RANDOM() LIMIT 3');
      for (const carte of result.rows) {
        await interaction.followUp({
          embeds: [{
            title: carte.name,
            description: carte.origin,
            image: { url: `https://ton-projet.railway.app${carte.image}` }
          }]
        });
      }
      break;
    }

    case 'pioche2': {
      const result = await pool.query('SELECT * FROM cartes ORDER BY RANDOM() LIMIT 1');
      const carte = result.rows[0];
      await interaction.reply({
        embeds: [{
          title: carte.name,
          description: carte.origin,
          image: { url: `https://ton-projet.railway.app${carte.image}` }
        }]
      });
      break;
    }

    case 'voir2': {
      const result = await pool.query('SELECT * FROM cartes WHERE id = 1 LIMIT 1');
      const carte = result.rows[0];
      await interaction.reply({
        embeds: [{
          title: carte.name,
          description: carte.origin,
          image: { url: `https://ton-projet.railway.app${carte.image}` }
        }]
      });
      break;
    }

    case 'kollek2': {
      const result = await pool.query('SELECT * FROM cartes ORDER BY id');
      const message = result.rows.map(c => `• ${c.name} (${c.origin})`).join('\n');
      await interaction.reply({ content: `🃏 Ta collection :\n${message}`.slice(0, 2000) });
      break;
    }
  }
});

client.login(process.env.TOKEN);
app.listen(3000, () => console.log('🌐 Serveur web actif sur le port 3000'));
