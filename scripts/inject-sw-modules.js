const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '../public/sw.js');
const swInitPath = path.join(__dirname, '../public/sw-init.js');

console.log('🔧 Injecting custom modules into Service Worker...');

if (!fs.existsSync(swPath)) {
  console.log('⚠️  sw.js not found. Run build first.');
  process.exit(0);
}

if (!fs.existsSync(swInitPath)) {
  console.log('❌ sw-init.js not found!');
  process.exit(1);
}

// Leer SW actual
let swContent = fs.readFileSync(swPath, 'utf8');

// Leer módulos de inicialización
const swInitContent = fs.readFileSync(swInitPath, 'utf8');

// Verificar si ya está inyectado
if (swContent.includes('sw-background-sync.js')) {
  console.log('✅ Custom modules already injected');
  process.exit(0);
}

// Inyectar al inicio del SW (después de los comentarios iniciales)
const injection = `
// ============================================
// CUSTOM PWA MODULES - Auto-injected
// ============================================
${swInitContent}

`;

// Encontrar el primer código ejecutable (después de los comentarios)
const lines = swContent.split('\n');
let injectionIndex = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  // Saltar comentarios y líneas vacías
  if (line.startsWith('//') || line.startsWith('/*') || line === '') {
    continue;
  }
  injectionIndex = i;
  break;
}

lines.splice(injectionIndex, 0, injection);
swContent = lines.join('\n');

// Guardar SW modificado
fs.writeFileSync(swPath, swContent);

console.log('✅ Custom modules injected successfully');
console.log('📦 Modules loaded:');
console.log('   - sw-background-sync.js (Background Sync API)');
console.log('   - sw-custom.js (Custom extensions)');
