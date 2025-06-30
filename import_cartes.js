
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const cartes = JSON.parse(fs.readFileSync('./cartes.json', 'utf8'));

async function importer() {
  for (const carte of cartes) {
    await pool.query(
      'INSERT INTO cartes (name, image, origin) VALUES ($1, $2, $3)',
      [carte.name, carte.image, carte.origin]
    );
  }
  console.log('Cartes importées.');
}

importer();
