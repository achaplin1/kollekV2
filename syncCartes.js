const fs = require('fs');
const path = require('path');

// ────── CHARGEMENT CARTES EXISTANTES ──────
const cartesPath = './cartes.json';
let cartes = [];

if (fs.existsSync(cartesPath)) {
  cartes = JSON.parse(fs.readFileSync(cartesPath, 'utf8'));
}

// ────── FICHIERS IMAGE ──────
const dossierCartes = path.join(__dirname, 'cartes');
if (!fs.existsSync(dossierCartes)) {
  console.error('❌ Dossier cartes/ introuvable');
  process.exit(1);
}

const fichiers = fs
  .readdirSync(dossierCartes)
  .filter(f => /\.(png|jpe?g|webp)$/i.test(f));

// ────── SYNCHRONISATION ──────
let nouvelles = 0;

for (const fichier of fichiers) {
  const nom = path.parse(fichier).name;
  const existe = cartes.find(c => c.name.toLowerCase() === nom.toLowerCase());
  if (!existe) {
    cartes.push({
      id: cartes.length + 1,
      name: nom.charAt(0).toUpperCase() + nom.slice(1),
      image: `/cartes/${fichier}`
    });
    nouvelles++;
  }
}

// ────── ÉCRITURE FICHIER ──────
fs.writeFileSync(cartesPath, JSON.stringify(cartes, null, 2), 'utf8');

if (nouvelles > 0)
  console.log(`✅ ${nouvelles} carte(s) ajoutée(s) à cartes.json`);
else
  console.log('✔️ Aucune nouvelle carte trouvée.');
