# 🚀 Guía de Migración a Cloudflare R2

Esta guía te llevará paso a paso para migrar todas tus imágenes de KeyCDN a Cloudflare R2.

---

## 📋 **Pre-requisitos**

- [ ] Cuenta de Cloudflare (gratuita o de pago)
- [ ] Dominio configurado en Cloudflare (opcional pero recomendado)
- [ ] Node.js 18+ instalado
- [ ] Acceso a la base de datos de producción
- [ ] ~2-4 horas para completar la migración completa

---

## 🎯 **Paso 1: Configurar Cloudflare R2**

### 1.1 Instalar Wrangler CLI

```bash
npm install -g wrangler

# Login a tu cuenta de Cloudflare
wrangler login
```

### 1.2 Crear R2 Bucket

```bash
cd cloudflare
npm install

# Crear el bucket
npm run create:bucket

# Verificar
wrangler r2 bucket list
```

Deberías ver: `ohara-cards-images`

### 1.3 Obtener Credenciales

1. Ve a [Cloudflare Dashboard](https://dash.cloudflare.com) → R2
2. Click en "Manage R2 API Tokens"
3. Click "Create API Token"
4. Configurar:
   - **Token name**: `ohara-r2-token`
   - **Permissions**: Object Read & Write
   - **TTL**: No expiry (o según prefieras)
   - **Buckets**: ohara-cards-images

5. **GUARDAR ESTAS CREDENCIALES** (solo se muestran una vez):
   - Account ID
   - Access Key ID
   - Secret Access Key

### 1.4 Configurar Variables de Entorno

Crear/actualizar `.env.local` en la raíz del proyecto:

```env
# Cloudflare R2 Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
R2_ACCESS_KEY_ID=your_access_key_here
R2_SECRET_ACCESS_KEY=your_secret_key_here
R2_BUCKET_NAME=ohara-cards-images
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev  # Se obtiene en el siguiente paso
```

### 1.5 Habilitar Acceso Público (via Worker)

```bash
# En la carpeta cloudflare/
cd cloudflare
wrangler r2 bucket domain list ohara-cards-images
```

Copia la URL pública que aparece (ej: `https://pub-xxxxx.r2.dev`) y agrégala a `.env.local` como `R2_PUBLIC_URL`.

### 1.6 (Opcional) Configurar Dominio Personalizado

Si quieres usar `images.oharatcg.com` en lugar de `pub-xxxxx.r2.dev`:

1. Ve a R2 Dashboard → tu bucket → Settings
2. Click "Add Custom Domain"
3. Ingresar: `images.oharatcg.com`
4. Cloudflare creará automáticamente el DNS record
5. Actualizar `.env.local`:
   ```env
   R2_PUBLIC_URL=https://images.oharatcg.com
   ```

---

## ⚙️ **Paso 2: Probar Configuración**

```bash
# Volver a la raíz del proyecto
cd ..

# Instalar dependencias nuevas
npm install

# Probar subida a R2
cd cloudflare
npm run test:upload
```

✅ Deberías ver: `Test image uploaded successfully to R2`

---

## 🚀 **Paso 3: Deploy del Cloudflare Worker**

El Worker sirve las imágenes desde R2 con cache agresivo.

```bash
cd cloudflare

# Deploy a staging primero
npm run deploy:staging

# Probar que funciona
curl https://your-worker-staging.workers.dev/health
# Debería retornar: OK
```

Si todo funciona, deploy a producción:

```bash
npm run deploy:production
```

### Verificar el Worker

```bash
# Ver logs en tiempo real
npm run tail
```

Abre otra terminal y haz una request de prueba:

```bash
curl https://your-worker.workers.dev/test/sample.png
```

Deberías ver el request en los logs.

---

## 📦 **Paso 4: Migración de Imágenes**

Este paso descarga todas las imágenes de KeyCDN, las optimiza en 7 tamaños diferentes, y las sube a R2.

### 4.1 Prueba en Dry-Run (Recomendado)

```bash
# Simular migración sin subir nada
npm run migrate:r2:dry

# O con límite para probar
npm run migrate:r2:test
```

Esto te mostrará:
- Cuántas imágenes se van a procesar
- Tamaños que se van a generar
- Estimación de tiempo

### 4.2 Migración de Prueba (10 imágenes)

```bash
npm run migrate:r2:test
```

Esto migrará solo las primeras 10 imágenes para verificar que todo funciona.

**Verificar:**
1. Ve a R2 Dashboard → ohara-cards-images
2. Deberías ver carpeta `cards/` con archivos como:
   - `OP01-001-tiny.webp`
   - `OP01-001-thumb.webp`
   - `OP01-001-medium.webp`
   - etc.

3. Probar una URL en el navegador:
   ```
   https://images.oharatcg.com/cards/OP01-001-medium.webp
   ```

### 4.3 Migración Completa

⚠️ **IMPORTANTE**: Este proceso puede tomar varias horas dependiendo de cuántas imágenes tengas.

```bash
# Migración completa
npm run migrate:r2
```

El script mostrará:
- Progreso en tiempo real
- Estimación de tiempo restante
- Errores si ocurren

**Recomendaciones:**
- Ejecutar en servidor/VPS con buena conexión
- Usar `screen` o `tmux` para que no se interrumpa:
  ```bash
  screen -S migration
  npm run migrate:r2
  # Ctrl+A, D para detach
  # screen -r migration para re-attach
  ```

### 4.4 Revisar Resultados

Al finalizar, el script generará:
- `migration-failed.json` (si hubo errores)
- Estadísticas completas en consola

Si hubo errores, puedes re-ejecutar solo las imágenes fallidas editando el script.

---

## 🗄️ **Paso 5: Actualizar Base de Datos**

Una vez que TODAS las imágenes estén en R2, actualiza las URLs en la base de datos.

### 5.1 Dry-Run (Ver qué se va a cambiar)

```bash
npm run migrate:update-db -- --dry-run
```

Esto mostrará:
- URLs antiguas vs nuevas
- Cantidad de registros a actualizar
- Sin hacer cambios reales

### 5.2 Actualización Real

⚠️ **IMPORTANTE**: Hacer backup de la base de datos primero.

```bash
# Backup de la BD
pg_dump $DATABASE_URL > backup-before-migration.sql

# O si usas Neon/Vercel Postgres, usa su UI para crear snapshot
```

Luego ejecutar:

```bash
npm run migrate:update-db
```

### 5.3 Verificar Cambios

```bash
# Conectar a la BD y verificar
psma studio

# O ejecutar query
SELECT src FROM "Card" WHERE src LIKE '%r2.dev%' OR src LIKE '%oharatcg.com%' LIMIT 10;
```

---

## ✅ **Paso 6: Testing y Validación**

### 6.1 Testing Local

```bash
npm run dev

# Abrir http://localhost:3000/card-list
```

Verificar:
- [ ] Las imágenes cargan correctamente
- [ ] Lazy loading funciona
- [ ] Scroll infinito funciona
- [ ] Diferentes tamaños se cargan según contexto
- [ ] No hay errores en consola

### 6.2 Testing en Staging/Preview

```bash
# Deploy a Vercel preview
git checkout -b migration-r2
git add .
git commit -m "feat: migrate to Cloudflare R2"
git push origin migration-r2
```

Vercel creará un preview deployment automáticamente.

**Verificar en preview:**
- [ ] Todas las páginas con imágenes
- [ ] Performance (debería ser igual o mejor)
- [ ] Lighthouse score
- [ ] Network tab: verificar headers de cache

### 6.3 Testing de Performance

Usar Chrome DevTools → Network:

```
Status: 200
Cache-Control: public, max-age=31536000, immutable
X-Cache-Status: HIT (después del primer load)
Content-Type: image/webp
```

Lighthouse:
- Performance: 90+
- Largest Contentful Paint: <2.5s
- Cumulative Layout Shift: <0.1

---

## 🚀 **Paso 7: Deploy a Producción**

### 7.1 Merge y Deploy

```bash
git checkout main
git merge migration-r2
git push origin main
```

Vercel hará deploy automáticamente.

### 7.2 Monitoreo Post-Deploy

**Primeras 24 horas:**

1. **Cloudflare Dashboard:**
   - R2 → Analytics
   - Workers → Analytics
   - Ver requests, bandwidth, errors

2. **Vercel Analytics:**
   - Ver Core Web Vitals
   - Comparar con métricas anteriores

3. **Logs:**
   ```bash
   # Worker logs
   cd cloudflare
   npm run tail

   # Vercel logs
   vercel logs
   ```

### 7.3 Checklist de Validación

- [ ] Todas las imágenes cargan en producción
- [ ] No hay errores 404 en consola
- [ ] Cache funciona (HIT rate > 90% después de 1 hora)
- [ ] Performance igual o mejor que antes
- [ ] Mobile funciona correctamente
- [ ] Lazy loading funciona
- [ ] Scroll infinito funciona

---

## 🧹 **Paso 8: Limpieza (Después de 7 días)**

Si todo funciona perfectamente después de una semana:

### 8.1 Desactivar KeyCDN

1. Login a KeyCDN dashboard
2. Detener el servicio (NO eliminar todavía)
3. Esperar 2-3 días más
4. Si no hay problemas, cancelar suscripción

### 8.2 Limpiar Código Legacy

Remover código relacionado con KeyCDN en `imageOptimization.ts` (opcional):

```typescript
// Esto se puede mantener como fallback o remover
```

### 8.3 Documentación

Actualizar README con:
- URLs nuevas de imágenes
- Proceso para subir nuevas imágenes
- Troubleshooting común

---

## 📊 **Métricas de Éxito**

Después de la migración, deberías ver:

| Métrica | Antes (KeyCDN) | Después (R2) | Objetivo |
|---------|----------------|--------------|----------|
| Costo mensual | ~$65 | ~$8 | ✅ -87% |
| Tiempo de carga (LCP) | ~2.1s | <2.0s | ✅ Mejor |
| Cache Hit Rate | ~85% | >95% | ✅ Mejor |
| Bandwidth usado | 1TB | 1TB | ✅ $0 egress |
| Uptime | 99.9% | 99.99% | ✅ Mejor |

---

## 🆘 **Troubleshooting**

### Problema: Imágenes no cargan (404)

**Causa:** URL no actualizada o imagen no migrada.

**Solución:**
```bash
# Verificar que la imagen existe en R2
wrangler r2 object get ohara-cards-images cards/nombre-imagen.webp

# Si no existe, re-ejecutar migración para esa imagen
```

### Problema: Imágenes cargan lento

**Causa:** Cache no está funcionando.

**Solución:**
```bash
# Ver logs del worker
cd cloudflare
npm run tail

# Verificar X-Cache-Status header
# Debería ser HIT después del primer load
```

### Problema: Worker no responde

**Causa:** Error en el código o binding de R2.

**Solución:**
```bash
# Ver logs de errores
npm run tail

# Re-deploy
npm run deploy:production

# Verificar bindings en wrangler.toml
```

### Problema: Costos más altos de lo esperado

**Causa:** Demasiadas Class A operations (writes).

**Solución:**
- Verificar que no estás sobre-escribiendo archivos
- Revisar R2 Analytics → Operations
- Ajustar TTL de cache si es necesario

---

## 📚 **Recursos Adicionales**

- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)

---

## 🎉 **¡Felicidades!**

Has migrado exitosamente a Cloudflare R2. Ahora tienes:

✅ Costos 87% más bajos
✅ Mejor performance
✅ Zero egress fees
✅ Mejor cache
✅ Infraestructura más moderna

**Próximos pasos opcionales:**

- Configurar alertas en Cloudflare para monitorear uptime
- Implementar Image Resizing on-the-fly con Workers (upgrade)
- Agregar AVIF support para browsers modernos
- Configurar CDN warmup para releases de nuevos sets
