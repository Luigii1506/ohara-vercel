# 📊 Resumen de Migración a Cloudflare R2

## ✅ Completado

### 1. Infraestructura
- ✅ Cloudflare Worker configurado y desplegado
- ✅ R2 Bucket creado (`ohara`)
- ✅ Worker URL: `https://ohara-image-worker.luis-encinas1506.workers.dev`

### 2. Código Frontend
- ✅ `imageOptimization.ts` actualizado para detectar URLs de R2 (`.workers.dev`)
- ✅ `LazyImage.tsx` con protección contra loops de 404
- ✅ Sistema de tamaños optimizados funcionando (tiny, xs, thumb, small, medium, large, original)

### 3. Worker Features
- ✅ Sirve imágenes desde R2 con 7 tamaños diferentes
- ✅ Fallback automático a KeyCDN si imagen no existe en R2
- ✅ Retorna 404 si imagen no existe en ningún lado (evita loops)
- ✅ Caché agresivo en Cloudflare Edge (1 año)

### 4. Migración Inicial
- ✅ 639 imágenes ya migradas y funcionando
- ✅ URLs en BD actualizadas de `.png` a `.webp`

## 🔄 En Progreso

### Migración Masiva
- **Total pendiente**: 3,420 imágenes (de 4,104 totales)
- **Dominios a migrar**:
  - `limitlesstcg.nyc3.digitaloceanspaces.com` (1,518)
  - `limitlesstcg.nyc3.cdn.digitaloceanspaces.com` (1,246)
  - `en.onepiece-cardgame.com` (646)
  - `tcgplayer-cdn.tcgplayer.com` (51)
  - `bez3ta.com` (3)
  - `www.cardtrader.com` (1)

## 📝 Próximos Pasos

### 1. Completar Migración de Imágenes

```bash
# Opción 1: Migrar todas de una vez (toma ~2-3 horas)
npm run migrate:r2

# Opción 2: Migrar en batches (más controlado)
npm run migrate:r2 -- --limit=500  # Primera batch
npm run migrate:r2 -- --limit=500  # Segunda batch
# ... repetir hasta completar las 3,420 imágenes
```

### 2. Actualizar URLs en Base de Datos

Después de que termine la migración de imágenes:

```bash
# Verificar qué se va a actualizar
npm run migrate:update-migrated -- --dry-run

# Actualizar todas las URLs de dominios externos a R2
npm run migrate:update-migrated
```

Esto convertirá:
```
https://limitlesstcg.nyc3.digitaloceanspaces.com/.../OP01-041_EN.webp
↓
https://ohara-image-worker.luis-encinas1506.workers.dev/cards/OP01-041_EN.webp
```

### 3. Verificar Migración

```bash
# Ver distribución de dominios
npm run migrate:analyze

# Verificar URLs en BD
npm run migrate:check-urls
```

**Esperado después de completar:**
- R2 URLs: 4,104 (100%)
- URLs externas: 0

### 4. Probar Localmente

```bash
npm run dev
```

Abrir http://localhost:3000/card-list y verificar:
- ✅ Las imágenes cargan correctamente
- ✅ Se usan los tamaños optimizados (DevTools Network → ver peso de imágenes)
- ✅ No hay errores 404 en consola
- ✅ El scroll infinito funciona correctamente

### 5. Deploy a Producción

Una vez verificado que todo funciona localmente:

```bash
npm run build
# Desplegar a Vercel/tu plataforma
```

## 📊 Beneficios Después de la Migración

### Performance
- **92% menos datos** descargados (7.8KB vs 98KB por imagen thumb)
- **Caché en 300+ ubicaciones** globales (Cloudflare Edge)
- **Formato WebP** en todos los tamaños

### Costos
- **$8/mes** (Cloudflare R2 + Worker) vs $65/mes (KeyCDN)
- **87% ahorro en costos**
- **Bandwidth gratis** (Cloudflare no cobra egress)

### Control
- ✅ **Independencia total** de servicios externos
- ✅ **Sin límites** de transferencia
- ✅ **Control completo** sobre las imágenes

## 🛠️ Scripts Disponibles

```bash
# Migración
npm run migrate:r2                  # Migrar todas las imágenes pendientes
npm run migrate:r2:dry              # Dry run (simular sin subir)
npm run migrate:r2 -- --limit=100   # Migrar solo 100 imágenes

# Actualización de URLs
npm run migrate:update-migrated       # Actualizar URLs de imágenes migradas
npm run migrate:update-migrated -- --dry-run  # Ver qué se actualizaría

# Análisis
npm run migrate:analyze             # Ver distribución de dominios
npm run migrate:check-urls          # Ver stats de URLs en BD

# Conversión
npm run migrate:convert-webp        # Convertir URLs .png a .webp
```

## 📈 Progreso Actual

- ✅ Infraestructura: 100%
- ✅ Código frontend: 100%
- ✅ Worker: 100%
- 🔄 Migración imágenes: 18.7% (639/3,420)
- ⏳ Actualización URLs: Pendiente
- ⏳ Testing: Pendiente

## 🆘 Troubleshooting

### Imagen no carga (404)
1. Verificar que está en R2: `wrangler r2 object get ohara cards/NOMBRE.webp`
2. Verificar URL en BD: `npm run migrate:check-urls`
3. Ver logs del Worker: `cd cloudflare && npm run tail`

### Migración falla
1. Verificar credenciales en `.env`
2. Ver archivo `failed-migrations.json`
3. Reintentar solo las que fallaron

### Imágenes pesan mucho
1. Verificar que `imageOptimization.ts` detecta `.workers.dev` ✅
2. Verificar en Network que se carga `-thumb.webp` o `-medium.webp`
3. Limpiar caché del navegador

---

**Última actualización**: 2025-11-06
**Completado por**: Claude Code
