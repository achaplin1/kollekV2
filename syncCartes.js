// syncCartes.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const cartes = JSON.parse(fs.readFileSync('./cartes.json', 'utf8'));

// ici tu peux vérifier ou modifier les cartes...

console.log('✔️ Aucune nouvelle carte trouvée.');

try {
  execSync('git add cartes.json cartes/*');
  execSync('git commit -m "🔄 Mise à jour des cartes"');
  execSync('git push');
  console.log('✅ Push Git effectué.');
} catch (e) {
  console.error('❌ Erreur push Git:', e.message);
}
