import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import sqlite3 from 'sqlite3';
import fs from 'fs';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const db = new sqlite3.Database('./database.db');

// Création table si absente
db.run(`
  CREATE TABLE IF NOT EXISTS cartes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    image TEXT NOT NULL,
    origin TEXT
  )
`);

// Charger cartes depuis cartes.json
const cartes = JSON.parse(fs.readFileSync('./cartes.json', 'utf-8'));
for (const carte of cartes) {
  db.get('SELECT * FROM cartes WHERE name = ?', [carte.name], (err, row) => {
    if (!row) {
      db.run('INSERT INTO cartes (name, image, origin) VALUES (?, ?, ?)',
        [carte.name, carte.image, carte.origin]);
    }
  });
}

const CLIENT_ID = '1389215821947080766'; // Remplace par ton vrai App ID
const baseURL = 'https://comfortable-abundance-production.up.railway.app';

client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName('booster2').setDescription('Ouvre 3 cartes'),
    new SlashCommandBuilder().setName('pioche2').setDescription('Pioche une carte'),
    new SlashCommandBuilder().setName('voir2').setDescription('Voir la carte id 1'),
    new SlashCommandBuilder().setName('kollek2').setDescription('Voir toute la kollek')
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Commandes slash enregistrées');
  } catch (err) {
    console.error('❌ Erreur enregistrement slash:', err);
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
              image: { url: baseURL + carte.image }
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
            image: { url: baseURL + carte.image }
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
            image: { url: baseURL + carte.image }
          }]
        });
      });
      break;
    }

    case 'kollek2': {
      db.all('SELECT * FROM cartes', async (err, rows) => {
        const message = rows.map(c => `• ${c.name} (${c.origin})`).join('\\n');
        await interaction.reply({ content: `🃏 Ta collection :\\n${message}`.slice(0, 2000) });
      });
      break;
    }
  }
});

client.login(process.env.TOKEN); // Railway ➜ variable TOKEN
