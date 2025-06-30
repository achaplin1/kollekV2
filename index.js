
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import fs from 'fs';

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const db = new sqlite3.Database('./database.db');

// Créer la table si elle n'existe pas
db.run(`
  CREATE TABLE IF NOT EXISTS cartes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    image TEXT NOT NULL,
    origin TEXT
  )
`);

// Charger les cartes depuis le JSON et les ajouter si absentes
const cartes = JSON.parse(fs.readFileSync('./cartes.json', 'utf-8'));
for (const carte of cartes) {
  db.get('SELECT * FROM cartes WHERE name = ?', [carte.name], (err, row) => {
    if (!row) {
      db.run(
        'INSERT INTO cartes (name, image, origin) VALUES (?, ?, ?)',
        [carte.name, carte.image, carte.origin]
      );
    }
  });
}

const CLIENT_ID = 'TON_APPLICATION_ID_ICI';

client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName('booster2').setDescription('Ouvre un booster version 2'),
    new SlashCommandBuilder().setName('pioche2').setDescription('Pioche une carte aléatoire'),
    new SlashCommandBuilder().setName('voir2').setDescription('Voir la carte avec ID 1'),
    new SlashCommandBuilder().setName('kollek2').setDescription('Liste toutes les cartes')
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
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
      db.all('SELECT * FROM cartes ORDER BY RANDOM() LIMIT 3', async (err, rows) => {
        for (const carte of rows) {
          await interaction.followUp({
            embeds: [{
              title: carte.name,
              description: carte.origin,
              image: { url: carte.image }
            }]
          });
        }
      });
      break;
    }

    case 'pioche2': {
      db.get('SELECT * FROM cartes ORDER BY RANDOM() LIMIT 1', async (err, carte) => {
        await interaction.reply({
          embeds: [{
            title: carte.name,
            description: carte.origin,
            image: { url: carte.image }
          }]
        });
      });
      break;
    }

    case 'voir2': {
      db.get('SELECT * FROM cartes WHERE id = 1', async (err, carte) => {
        await interaction.reply({
          embeds: [{
            title: carte.name,
            description: carte.origin,
            image: { url: carte.image }
          }]
        });
      });
      break;
    }

    case 'kollek2': {
      db.all('SELECT * FROM cartes ORDER BY id', async (err, rows) => {
        const message = rows.map(c => `• ${c.name} (${c.origin})`).join('\n');
        await interaction.reply({ content: `🃏 Ta collection :\n${message}`.slice(0, 2000) });
      });
      break;
    }
  }
});

client.login(process.env.TOKEN);
