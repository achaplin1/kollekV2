// syncCartes.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const cartesPath = path.join(__dirname, 'cartes.json');
const dossierCartes = path.join(__dirname, 'cartes');

// Fonction pour lire le fichier JSON
function chargerCartes() {
  if (!fs.existsSync(cartesPath)) return [];
  return JSON.parse(fs.readFileSync(cartesPath, 'utf8'));
}

// Nettoyage des fichiers indésirables
function nettoyerFichiersInutiles() {
  const fichiers = fs.readdirSync(dossierCartes);
  for (const fichier of fichiers) {
    if (fichier.startsWith('.') || fichier.endsWith('.DS_Store')) {
      fs.unlinkSync(path.join(dossierCartes, fichier));
      console.log(`🗑️ Supprimé : ${fichier}`);
    }
  }
}

// Lister les cartes présentes physiquement
function getImagesCartes() {
  return fs.readdirSync(dossierCartes)
    .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
    .map(f => f.trim());
}

// Vérifier et synchroniser les cartes
function synchroniserCartes() {
  const cartes = chargerCartes();
  const images = getImagesCartes();

  let prochainId = cartes.reduce((max, c) => Math.max(max, c.id), 0) + 1;
  let cartesAjoutees = 0;

  for (const image of images) {
    const nom = path.parse(image).name.trim();
    const existeDeja = cartes.some(c => c.image.includes(image));
    if (!existeDeja) {
      cartes.push({ id: prochainId++, name: nom, image: `/cartes/${image}` });
      cartesAjoutees++;
      console.log(`➕ Carte ajoutée : ${nom}`);
    }
  }

  if (cartesAjoutees > 0) {
    fs.writeFileSync(cartesPath, JSON.stringify(cartes, null, 2), 'utf8');
    console.log(`✅ ${cartesAjoutees} carte(s) ajoutée(s) à cartes.json`);
  } else {
    console.log('✔️ Aucune nouvelle carte trouvée.');
  }

  return cartesAjoutees > 0;
}

// Git push si modifié
function pushGit() {
  try {
    execSync('git add cartes.json cartes/*');
    execSync('git commit -m "🔄 Mise à jour automatique des cartes"', { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });
    console.log('🚀 Modifications poussées sur GitHub');
  } catch (e) {
    console.error('❌ Erreur push Git :', e.message);
  }
}

// Lancer la synchro
nettoyerFichiersInutiles();
const modif = synchroniserCartes();
if (modif) pushGit();
