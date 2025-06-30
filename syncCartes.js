
import fs from 'fs';
import path from 'path';

const dossier = './cartes';
const cheminJSON = './cartes.json';
const extensionsValides = ['.png', '.jpg', '.jpeg', '.webp'];

// Charger l’existant
let cartes = [];
if (fs.existsSync(cheminJSON)) {
  cartes = JSON.parse(fs.readFileSync(cheminJSON, 'utf-8'));
}

// Créer une map pour éviter les doublons
const nomsExistants = new Set(cartes.map(c => c.image));

// Parcourir tous les fichiers valides
const fichiers = fs.readdirSync(dossier).filter(f =>
  extensionsValides.includes(path.extname(f).toLowerCase())
);

let nouvellesCartes = 0;
for (const fichier of fichiers) {
  const chemin = `/cartes/${fichier}`;
  if (!nomsExistants.has(chemin)) {
    const nomSansExt = path.parse(fichier).name;

    cartes.push({
      name: nomSansExt.charAt(0).toUpperCase() + nomSansExt.slice(1),
      image: chemin,
      origin: "Inconnu"
    });
    nouvellesCartes++;
  }
}

// Sauvegarde
if (nouvellesCartes > 0) {
  fs.writeFileSync(cheminJSON, JSON.stringify(cartes, null, 2));
  console.log(`✅ ${nouvellesCartes} carte(s) ajoutée(s) dans cartes.json`);
} else {
  console.log('✔️ Aucune nouvelle carte trouvée.');
}
import { execSync } from 'child_process';

try {
  execSync('git add cartes.json cartes/*', { stdio: 'inherit' });
  execSync('git commit -m "auto: ajout cartes"', { stdio: 'inherit' });
  execSync('git push', { stdio: 'inherit' });
  console.log('✅ cartes.json et images poussées sur GitHub');
} catch (err) {
  console.error('❌ Erreur push Git:', err.message);
}
