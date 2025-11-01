/**
 * ✅ OPTIMIZADO: Limpia caches antiguos SOLO UNA VEZ
 *
 * Migración de localStorage → IndexedDB
 * Se ejecuta una sola vez usando flag en localStorage
 */
export const clearOldCache = () => {
  if (typeof window === 'undefined') return;

  const MIGRATION_FLAG = 'cache-migration-v3';

  // Verificar si ya se ejecutó la migración
  if (localStorage.getItem(MIGRATION_FLAG) === 'done') {
    return;
  }

  try {
    console.log('🔄 Migrando cache antiguo...');

    // Limpiar Zustand persist (card-store) - Ya no se usa
    localStorage.removeItem('card-store');

    // Limpiar React Query localStorage viejo
    localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
    localStorage.removeItem('react-query-persist-client');

    // Limpiar flag viejo de filtros colapsados
    localStorage.removeItem('filtersCollapsed');

    // Marcar migración como completada
    localStorage.setItem(MIGRATION_FLAG, 'done');

    console.log('✅ Migración completada - Cache limpio');
  } catch (error) {
    console.warn('⚠️ Error en migración de cache:', error);
  }
};
