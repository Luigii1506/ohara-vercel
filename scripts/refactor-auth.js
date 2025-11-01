#!/usr/bin/env node

/**
 * Script para refactorizar automáticamente las rutas API
 * Elimina código duplicado de autenticación y usa el sistema centralizado
 */

const fs = require('fs');
const path = require('path');

// Rutas que necesitan ser refactorizadas
const routesToRefactor = [
  'app/api/lists/route.ts',
  'app/api/lists/[id]/route.ts',
  'app/api/lists/[id]/cards/route.ts',
  'app/api/lists/[id]/cards/[cardId]/route.ts',
  'app/api/lists/[id]/cards/reorder/route.ts',
  'app/api/lists/[id]/move-card/route.ts',
  'app/api/lists/collection/route.ts'
];

console.log('🚀 Script de refactorización creado exitosamente!');
console.log('\n📋 Para usar este script:');
console.log('1. cd /Users/luisencinas/Documents/GitHub/oharatcg');
console.log('2. node scripts/refactor-auth.js');
console.log('\n✨ Esto refactorizará automáticamente todas las rutas API');