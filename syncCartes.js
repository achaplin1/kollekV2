const fs = require('fs');
const path = require('path');

const DOSSIER_CARTES = path.join(__dirname, 'cartes');
const FICHIER_JSON = path.join(__dirname, 'cartes.json');
const BASE_URL = 'https://comfortable-abundance-production.up.railway.app/cartes';

function chargerCartesExistantes() {
  try {
    const contenu = fs.readFileSync(FICHIER_JSON, 'utf-8');
    return JSON.parse(contenu);
  } catch {
    return [];
  }
}

function synchroniserCartes() {
  const existantes = chargerCartesExistantes();
  const nouvelles = [];
  const nomsExistants = new Set(existantes.map(c => c.name));

  const fichiers = fs.readdirSync(DOSSIER_CARTES).filter(f =>
    /\.(jpe?g|png|webp)$/i.test(f)
  );

  let id = existantes.length ? Math.max(...existantes.map(c => c.id)) + 1 : 1;

  for (const fichier of fichiers) {
    const nom = path.parse(fichier).name;

    if (!nomsExistants.has(nom)) {
      nouvelles.push({
        id: id++,
        name: nom,
        image: `${BASE_URL}/${fichier}`
      });
    }
  }

  if (nouvelles.length) {
    const cartesFinales = [...existantes, ...nouvelles];
    fs.writeFileSync(FICHIER_JSON, JSON.stringify(cartesFinales, null, 2));
    console.log(`✅ ${nouvelles.length} nouvelle(s) carte(s) ajoutée(s).`);
  } else {
    console.log('✔️ Aucune nouvelle carte trouvée.');
  }
}

synchroniserCartes();
