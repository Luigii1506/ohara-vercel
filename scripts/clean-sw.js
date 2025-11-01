#!/usr/bin/env node

/**
 * 🧹 Script para limpiar Service Worker completamente
 *
 * Uso:
 *   node scripts/clean-sw.js
 *   npm run clean:sw
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 Limpiando Service Worker...\n');

// Archivos a eliminar
const filesToDelete = [
  '.next',
  'public/sw.js',
  'public/sw.js.map',
  'public/workbox-*.js',
  'public/workbox-*.js.map',
];

let deletedCount = 0;

filesToDelete.forEach(file => {
  const fullPath = path.join(process.cwd(), file);

  try {
    if (file.includes('*')) {
      // Glob pattern - manejar archivos workbox
      const dir = path.dirname(fullPath);
      const pattern = path.basename(fullPath);

      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        files.forEach(f => {
          if (f.match(/^workbox-.*\.js(\.map)?$/)) {
            const filePath = path.join(dir, f);
            fs.unlinkSync(filePath);
            console.log(`  ✅ Eliminado: ${f}`);
            deletedCount++;
          }
        });
      }
    } else {
      // Archivo específico
      if (fs.existsSync(fullPath)) {
        if (fs.lstatSync(fullPath).isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(fullPath);
        }
        console.log(`  ✅ Eliminado: ${file}`);
        deletedCount++;
      }
    }
  } catch (error) {
    // Silenciar errores de archivos no encontrados
  }
});

console.log(`\n🎉 Limpieza completa! (${deletedCount} archivos eliminados)`);
console.log('\n' + '='.repeat(60));
console.log('📋 PASOS SIGUIENTES PARA LIMPIAR SERVICE WORKER:');
console.log('='.repeat(60) + '\n');

console.log('OPCIÓN 1: Herramienta Visual (RECOMENDADO) 🎨');
console.log('  1. Visita: http://localhost:3000/diagnose-sw.html');
console.log('  2. Click "☢️ RESET COMPLETO"');
console.log('  3. Sigue las instrucciones en pantalla');
console.log('');

console.log('OPCIÓN 2: Manual en Console del Navegador 🔧');
console.log('  1. Abre: http://localhost:3000');
console.log('  2. F12 → Console');
console.log('  3. Copia y pega EXACTAMENTE:');
console.log('');
console.log('     ' + '-'.repeat(54));
console.log('     navigator.serviceWorker.getRegistrations().then(r => {');
console.log('       r.forEach(reg => reg.unregister());');
console.log('       console.log("✅ SW desregistrado");');
console.log('     });');
console.log('');
console.log('     caches.keys().then(k => {');
console.log('       k.forEach(cache => caches.delete(cache));');
console.log('       console.log("✅ Caches eliminados");');
console.log('     });');
console.log('     ' + '-'.repeat(54));
console.log('');

console.log('DESPUÉS DE CUALQUIER OPCIÓN:');
console.log('  4. Cierra TODAS las pestañas de localhost:3000');
console.log('  5. Cierra el navegador COMPLETAMENTE');
console.log('     • Mac: Cmd+Q');
console.log('     • Windows: Alt+F4');
console.log('  6. Espera 5 segundos');
console.log('  7. npm run dev (si no está corriendo)');
console.log('  8. Abre pestaña NUEVA → http://localhost:3000/card-list');
console.log('  9. ✅ El nuevo Service Worker se instalará correctamente');
console.log('');
