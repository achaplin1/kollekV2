
import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

client.once('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'booster') {
    const result = await pool.query('SELECT * FROM cartes ORDER BY RANDOM() LIMIT 3');
    const cartes = result.rows;

    for (const carte of cartes) {
      await interaction.followUp({
        embeds: [{
          title: carte.name,
          description: carte.origin,
          image: { url: carte.image }
        }]
      });
    }
  }
});

client.login(process.env.TOKEN);
