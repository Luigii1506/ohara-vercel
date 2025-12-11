# Script de Reset de Eventos

Este script elimina todos los eventos y sus datos relacionados de la base de datos, permitiéndote hacer pruebas desde cero.

## ¿Qué elimina?

El script elimina automáticamente (en cascada):

1. **Eventos** (`Event`)
2. **EventSet** - Relaciones entre eventos y sets
3. **EventCard** - Relaciones entre eventos y cartas
4. **EventMissingSet** - Sets faltantes detectados en eventos

## Uso

### Opción 1: Usando npm script (Recomendado)

```bash
npm run reset:events
```

### Opción 2: Usando ts-node directamente

```bash
npx ts-node scripts/reset-events.ts
```

## Comportamiento

1. **Muestra estadísticas actuales** de todos los datos que serán eliminados
2. **Espera 3 segundos** para que puedas cancelar con `Ctrl+C` si cambiaste de opinión
3. **Elimina todos los eventos** y en cascada todos los datos relacionados
4. **Muestra resumen** de lo que fue eliminado

## Ejemplo de salida

```
🔄 Iniciando reset de eventos...

📊 Estadísticas actuales:
   - Eventos: 45
   - EventSets: 120
   - EventCards: 2340
   - MissingSets: 8

⚠️  ADVERTENCIA: Esta acción eliminará TODOS los eventos y datos relacionados.
   Esta acción NO se puede deshacer.

⏳ Iniciando eliminación en 3 segundos... (Ctrl+C para cancelar)
⏳ 2...
⏳ 1...

🗑️  Eliminando todos los eventos...
✅ Eliminados 45 eventos
✅ Las relaciones en cascada también fueron eliminadas:
   - EventSets: 120 eliminados
   - EventCards: 2340 eliminados
   - MissingSets: 8 eliminados

🎉 Reset completado exitosamente!

✅ Script finalizado
```

## ⚠️ IMPORTANTE

- **Esta acción NO se puede deshacer**
- Todos los eventos serán eliminados permanentemente
- Las relaciones cascade eliminarán automáticamente:
  - EventSet
  - EventCard
  - EventMissingSet
- **NO elimina**:
  - Sets (permanecen en la base de datos)
  - Cards (permanecen en la base de datos)
  - Imágenes en R2 (permanecen en el storage)

## Caso de uso típico

Úsalo cuando quieras:

1. **Probar el sistema de scraping de eventos** desde cero
2. **Probar el flujo de aprobación de missing sets** sin datos previos
3. **Limpiar datos de prueba** antes de un deploy a producción
4. **Resetear el ambiente de desarrollo** después de hacer pruebas

## Seguridad

El script incluye:
- ✅ Confirmación con espera de 3 segundos
- ✅ Posibilidad de cancelar con `Ctrl+C`
- ✅ Estadísticas antes de eliminar
- ✅ Manejo de errores
- ✅ Desconexión segura de Prisma

## Modificar el comportamiento

Si quieres ejecutar sin la espera de 3 segundos, puedes comentar la sección de confirmación en el archivo `scripts/reset-events.ts` (líneas 42-49).
