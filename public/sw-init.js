// ============================================
// SERVICE WORKER INITIALIZER
// ============================================
// Este archivo se ejecuta al inicio del SW para cargar módulos custom

// Importar módulos de extensión
self.importScripts('/sw-background-sync.js');
self.importScripts('/sw-session-cache.js');
self.importScripts('/sw-custom.js');

console.log('[SW] Custom modules loaded');
