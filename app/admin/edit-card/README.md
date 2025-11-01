# Edit Card - Nueva Implementación Modal

## Cambios Realizados

Se ha refactorizado completamente la página de edición de cartas para utilizar un sistema de modales en lugar de la vista lateral anterior. Esta nueva implementación ofrece una experiencia más intuitiva y organizada.

### Estructura de Archivos

```
app/admin/edit-card/
├── components/
│   ├── EditCardModal.tsx      # Modal para editar carta principal
│   └── EditAlternateModal.tsx # Modal para editar alternas
├── page.tsx                   # Página principal con nueva lógica
└── README.md                  # Esta documentación
```

### Funcionalidades Principales

#### 1. Selección de Cartas

- **Sidebar:** Lista filtrable de todas las cartas
- **Búsqueda:** Por nombre, código, texto, tipo o set
- **Filtros:** Por sets y raridades
- **Vistas:** Lista compacta, grid y texto

#### 2. Modal de Edición de Carta Principal

- **Campos editables:**
  - URL de imagen
  - URL TCG
  - Texto trigger
  - Texto de la carta
  - Effects (multiselect)
  - Condiciones (lista dinámica)
- **Preview:** Vista previa de imagen actualizada
- **Validación:** Manejo de errores y estados de carga

#### 3. Modal de Edición de Alternas

- **Campos editables:**
  - URL de imagen con preview
  - Alias de la alterna
  - Sets asignados (multiselect)
  - URL TCG
  - Tipo de arte alternativo
  - Región
  - Estado PRO (checkbox)
- **Información adicional:** ID, orden y estadísticas

#### 4. Gestión de Alternas

- **CRUD completo:** Crear, leer, actualizar, eliminar
- **Grid visual:** Cards con overlay de acciones al hover
- **Estados:** Loading, error handling, actualización optimista
- **Validación:** Verificación de sets asignados

### Flujo de Trabajo

1. **Seleccionar carta** del sidebar
2. **Ver información** en el área principal
3. **Editar carta principal** haciendo clic en "Editar Carta"
4. **Gestionar alternas** usando los botones de edición/eliminación
5. **Crear nuevas alternas** con el botón "Nueva Alterna"

### Mejoras Implementadas

- ✅ **UX mejorada:** Modales en lugar de sidebar confuso
- ✅ **Diseño consistente:** Mantiene el estilo visual existente
- ✅ **Funcionalidad completa:** Todas las operaciones CRUD
- ✅ **Responsivo:** Funciona en móvil y desktop
- ✅ **Performance:** Actualizaciones optimistas y manejo de estados
- ✅ **Validación:** Manejo robusto de errores

### Tecnologías Utilizadas

- **React 18** con hooks modernos
- **TypeScript** para type safety
- **shadcn/ui** componentes de UI
- **Lucide React** para iconos
- **LazyImage** para optimización de imágenes
- **Toastify** para notificaciones

### API Endpoints Utilizados

- `GET /api/admin/cards` - Listar cartas con relaciones
- `PUT /api/admin/cards/[id]` - Actualizar carta
- `POST /api/admin/cards` - Crear nueva alterna
- `DELETE /api/admin/cards/[id]` - Eliminar alterna
- `GET /api/admin/sets` - Obtener sets disponibles

### Estados y Manejo de Datos

- **Estados locales:** Manejo eficiente con useState
- **Actualización optimista:** Updates inmediatos con rollback en errores
- **Loading states:** Feedback visual durante operaciones
- **Error handling:** Notificaciones claras de errores

### Arreglos Críticos Implementados

#### Problema de Estructura de Datos Inconsistente

Se solucionó un error crítico que ocurría al editar una carta por segunda vez después de haberla editado previamente:

**Error:** `Invalid prisma.card.update() invocation: Argument 'type': Invalid value provided. Expected String, provided Object.`

**Causa:** Inconsistencia en la estructura de datos entre la primera edición (arrays de strings) y subsecuentes (arrays de objetos).

**Solución:**

1. **Helper functions robustas** en `EditCardModal.tsx`:

   - `extractArrayValues()` - Maneja arrays que pueden ser strings u objetos
   - `extractTextValues()` - Procesa textos de manera consistente

2. **Actualización de estado consistente**:

   - Usar datos directos del servidor en lugar de hacer merge
   - Evitar inconsistencias en estructura de datos relacionados

3. **Validación de tipos dinámicos**:
   - Detectar automáticamente si los datos son strings u objetos
   - Extraer valores correctos independientemente de la estructura

#### Archivos Modificados

- `components/EditCardModal.tsx` - Helper functions para manejo consistente
- `page.tsx` - Actualización directa de estado desde servidor
- Todas las operaciones CRUD ahora manejan estructuras de datos mixtas

### Estado del Proyecto

Esta implementación está lista para producción, con todos los bugs críticos resueltos y funcionalidad completa validada.
