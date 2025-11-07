# ✅ Checklist de Migración a Cloudflare R2

Usa este checklist para trackear tu progreso. Marca cada item cuando lo completes.

---

## 📋 Pre-Migración

- [ ] Leer [MIGRATION-GUIDE.md](MIGRATION-GUIDE.md) completo
- [ ] Leer [R2-MIGRATION-SUMMARY.md](R2-MIGRATION-SUMMARY.md)
- [ ] Crear cuenta de Cloudflare (si no tienes)
- [ ] Verificar que tienes acceso a la base de datos de producción
- [ ] Estimar cuántas imágenes tienes (para calcular tiempo)
- [ ] Planificar ventana de mantenimiento (opcional, no es necesario downtime)

---

## 🔧 Setup Inicial

### Wrangler CLI
- [ ] Instalar Wrangler: `npm install -g wrangler`
- [ ] Login: `wrangler login`
- [ ] Verificar login: `wrangler whoami`

### Cloudflare R2 Bucket
- [ ] Navegar a carpeta cloudflare: `cd cloudflare`
- [ ] Instalar dependencias: `npm install`
- [ ] Crear bucket: `npm run create:bucket`
- [ ] Verificar bucket: `wrangler r2 bucket list`
- [ ] Ver "ohara-cards-images" en la lista

### Credenciales R2
- [ ] Ir a Cloudflare Dashboard → R2
- [ ] Click "Manage R2 API Tokens"
- [ ] Crear nuevo token con permisos Read & Write
- [ ] Copiar Account ID
- [ ] Copiar Access Key ID
- [ ] Copiar Secret Access Key
- [ ] **GUARDAR ESTAS CREDENCIALES EN LUGAR SEGURO**

### Variables de Entorno
- [ ] Copiar `.env.example` → `.env.local`
- [ ] Rellenar `CLOUDFLARE_ACCOUNT_ID`
- [ ] Rellenar `R2_ACCESS_KEY_ID`
- [ ] Rellenar `R2_SECRET_ACCESS_KEY`
- [ ] Rellenar `R2_BUCKET_NAME` = `ohara-cards-images`
- [ ] Obtener R2_PUBLIC_URL (siguiente paso)

### Obtener R2 Public URL
- [ ] Ejecutar: `wrangler r2 bucket domain list ohara-cards-images`
- [ ] Copiar URL (ej: `https://pub-xxxxx.r2.dev`)
- [ ] Agregar a `.env.local` como `R2_PUBLIC_URL`

### (Opcional) Dominio Personalizado
- [ ] Ir a R2 Dashboard → Settings
- [ ] Click "Add Custom Domain"
- [ ] Ingresar: `images.oharatcg.com` (o tu dominio)
- [ ] Esperar que DNS se propague (~5 mins)
- [ ] Actualizar `R2_PUBLIC_URL=https://images.oharatcg.com`

### Test de Setup
- [ ] Volver a raíz: `cd ..`
- [ ] Instalar deps: `npm install`
- [ ] Test upload: `cd cloudflare && npm run test:upload`
- [ ] Ver mensaje: "✅ Test image uploaded successfully"

---

## 🚀 Deploy del Worker

### Staging
- [ ] En carpeta cloudflare: `cd cloudflare`
- [ ] Deploy staging: `npm run deploy:staging`
- [ ] Ver URL de staging en output
- [ ] Test health: `curl https://your-worker-staging.workers.dev/health`
- [ ] Debería retornar: `OK`

### Producción
- [ ] Deploy prod: `npm run deploy:production`
- [ ] Ver URL de producción en output
- [ ] Test health: `curl https://your-worker.workers.dev/health`
- [ ] Debería retornar: `OK`

### (Opcional) Custom Domain para Worker
- [ ] Workers Dashboard → Settings → Triggers
- [ ] Add Route: `images.oharatcg.com/*`, zone: `oharatcg.com`
- [ ] Esperar propagación DNS (~5 mins)
- [ ] Test: `curl https://images.oharatcg.com/health`

### Verificar Worker Funciona
- [ ] Abrir logs: `npm run tail` (dejar corriendo)
- [ ] En otra terminal, hacer request de prueba
- [ ] Ver request en logs
- [ ] Verificar que no hay errores

---

## 📦 Migración de Imágenes

### Preparación
- [ ] Volver a raíz: `cd ..`
- [ ] Verificar que `.env.local` tiene todas las variables
- [ ] Estimar tiempo (ej: 10,000 imágenes = ~3-4 horas)

### Dry-Run (Simulación)
- [ ] Ejecutar: `npm run migrate:r2:dry`
- [ ] Revisar output: cantidad de imágenes, tamaños a generar
- [ ] Verificar que todo se ve correcto
- [ ] NO sube nada todavía, solo simula

### Migración de Prueba
- [ ] Ejecutar: `npm run migrate:r2:test`
- [ ] Migrar solo 10 imágenes
- [ ] Verificar en R2 Dashboard que se subieron
- [ ] Ver estructura: `cards/{filename}-{size}.webp`

### Verificar URLs de Prueba
- [ ] Ir a R2 Dashboard → ohara-cards-images
- [ ] Click en un archivo, copiar URL
- [ ] Abrir en navegador
- [ ] Debería verse la imagen
- [ ] Verificar headers (F12 → Network):
  - `cache-control: public, max-age=31536000, immutable`
  - `content-type: image/webp`
  - `x-cache-status: MISS` (primera vez) luego `HIT`

### Migración Completa

**IMPORTANTE:** Este paso puede tomar 2-4 horas o más.

- [ ] Abrir `screen` o `tmux` (recomendado)
- [ ] Ejecutar: `npm run migrate:r2`
- [ ] Monitorear progreso
- [ ] Si usas screen: `Ctrl+A, D` para detach
- [ ] Esperar a que complete
- [ ] Si hay errores, revisar `migration-failed.json`

### Post-Migración
- [ ] Revisar estadísticas finales
- [ ] Verificar cantidad de imágenes migradas vs total
- [ ] Si hubo errores, identificar patrón
- [ ] Re-ejecutar para imágenes fallidas si es necesario
- [ ] Spot-check: verificar 10-20 URLs random funcionan

---

## 🗄️ Actualizar Base de Datos

### IMPORTANTE: Backup Primero
- [ ] **HACER BACKUP DE LA BASE DE DATOS**
- [ ] PostgreSQL: `pg_dump $DATABASE_URL > backup.sql`
- [ ] O usar UI de Neon/Vercel/Supabase
- [ ] Verificar que backup existe y no está corrupto

### Dry-Run
- [ ] Ejecutar: `npm run migrate:update-db -- --dry-run`
- [ ] Revisar output: URLs viejas vs nuevas
- [ ] Verificar que conversión es correcta
- [ ] Estimar cantidad de registros a actualizar

### Actualización Real
- [ ] Confirmar que backup está hecho ✅
- [ ] Ejecutar: `npm run migrate:update-db`
- [ ] Monitorear progreso
- [ ] Esperar a que complete
- [ ] Revisar estadísticas finales
- [ ] Si hay errores, revisar `update-db-failed.json`

### Verificación en BD
- [ ] Abrir Prisma Studio: `npx prisma studio`
- [ ] Ir a tabla `Card`
- [ ] Filtrar por `src` contains "r2.dev" o "oharatcg.com"
- [ ] Verificar que las URLs son correctas
- [ ] Spot-check: copiar 5-10 URLs y abrirlas en navegador

---

## 🧪 Testing

### Testing Local
- [ ] Ejecutar: `npm run dev`
- [ ] Abrir: http://localhost:3000/card-list
- [ ] Verificar que todas las imágenes cargan
- [ ] Probar lazy loading (scroll)
- [ ] Probar scroll infinito
- [ ] Abrir DevTools → Network
- [ ] Verificar que URLs son de R2
- [ ] Verificar headers de cache

### Testing de Performance Local
- [ ] Lighthouse en DevTools
- [ ] Performance score: ≥90
- [ ] LCP (Largest Contentful Paint): <2.5s
- [ ] CLS (Cumulative Layout Shift): <0.1
- [ ] Comparar con scores anteriores

### Testing en Mobile (Local)
- [ ] Abrir en mobile device (o emulador)
- [ ] Verificar lazy loading funciona
- [ ] Verificar imágenes cargan rápido
- [ ] Verificar scroll infinito funciona
- [ ] No hay errores en consola

### Preview Deployment
- [ ] Crear branch: `git checkout -b migration-r2`
- [ ] Commit cambios: `git add . && git commit -m "feat: migrate to R2"`
- [ ] Push: `git push origin migration-r2`
- [ ] Esperar a que Vercel cree preview
- [ ] Abrir URL de preview

### Testing en Preview
- [ ] Verificar /card-list funciona
- [ ] Verificar todas las páginas con imágenes
- [ ] Lighthouse en preview
- [ ] Mobile testing en preview
- [ ] Verificar Network tab: cache headers
- [ ] No hay errores 404
- [ ] Performance igual o mejor que prod actual

---

## 🚀 Deploy a Producción

### Pre-Deploy
- [ ] Todas las pruebas en preview pasaron ✅
- [ ] Backup de BD confirmado ✅
- [ ] Plan de rollback listo (si algo falla)
- [ ] Notificar al equipo (si aplica)

### Deploy
- [ ] Merge a main: `git checkout main && git merge migration-r2`
- [ ] Push: `git push origin main`
- [ ] Vercel hace deploy automáticamente
- [ ] Esperar a que deployment complete
- [ ] Abrir URL de producción

### Verificación Inmediata
- [ ] Abrir homepage
- [ ] Abrir /card-list
- [ ] Verificar que imágenes cargan
- [ ] Abrir DevTools → Network
- [ ] Verificar URLs son de R2
- [ ] Verificar headers de cache
- [ ] No hay errores en consola

---

## 📊 Monitoreo Post-Deploy

### Primeras 15 minutos
- [ ] Monitorear Vercel logs: `vercel logs --follow`
- [ ] Monitorear Worker logs: `cd cloudflare && npm run tail`
- [ ] Verificar no hay errores 500
- [ ] Verificar no hay errores 404
- [ ] Spot-check: visitar 5-10 páginas con imágenes

### Primera 1 hora
- [ ] Cloudflare Dashboard → Workers → Analytics
- [ ] Verificar requests count está creciendo
- [ ] Verificar error rate es <1%
- [ ] Verificar cache hit rate (debería empezar en 0% e incrementar)

### Primer día
- [ ] Cloudflare R2 Analytics
- [ ] Verificar bandwidth usage
- [ ] Verificar storage size
- [ ] Vercel Analytics → Core Web Vitals
- [ ] Comparar LCP, FID, CLS con día anterior

### Primera semana
- [ ] Monitorear cache hit rate (objetivo: >90%)
- [ ] Monitorear error rate (objetivo: <0.1%)
- [ ] Revisar costos en Cloudflare dashboard
- [ ] Comparar con costos de KeyCDN
- [ ] User reports: verificar no hay quejas

---

## 🧹 Limpieza (Después de 7 días exitosos)

### Desactivar KeyCDN
- [ ] Login a KeyCDN dashboard
- [ ] Pausar servicio (NO eliminar todavía)
- [ ] Esperar 2-3 días más
- [ ] Si todo sigue bien, cancelar suscripción
- [ ] Documentar fecha de cancelación

### Limpiar Código (Opcional)
- [ ] Remover código legacy de KeyCDN en `imageOptimization.ts`
- [ ] O mantenerlo como fallback (recomendado por 30 días)
- [ ] Actualizar comentarios en código
- [ ] Crear PR con limpieza

### Documentación Final
- [ ] Actualizar README con nueva info de imágenes
- [ ] Documentar proceso para subir nuevas imágenes
- [ ] Crear guía de troubleshooting
- [ ] Actualizar docs de deployment

---

## 🎉 Post-Migración

### Métricas de Éxito
- [ ] Costo mensual: ~$65 → ~$8 (87% reducción) ✅
- [ ] Cache hit rate: >90% ✅
- [ ] Error rate: <0.1% ✅
- [ ] Performance igual o mejor ✅
- [ ] Zero quejas de usuarios ✅

### Celebración
- [ ] 🎉 ¡Migración exitosa!
- [ ] Actualizar este checklist con tu experiencia
- [ ] Compartir aprendizajes con el equipo
- [ ] Considerar aplicar misma estrategia a otros assets

---

## 📝 Notas y Observaciones

Usa esta sección para anotar cualquier issue, aprendizaje o mejora:

```
Fecha: ___________

Issues encontrados:
-

Tiempo real de migración:
- Setup: _____ minutos
- Deploy Worker: _____ minutos
- Migración imágenes: _____ horas
- Actualización BD: _____ minutos
- Testing: _____ minutos
- Total: _____ horas

Costos actuales (después de migración):
- R2 Storage: $_____ /mes
- Workers: $_____ /mes
- Total: $_____ /mes

Ahorro mensual: $_____
Ahorro anual: $_____

Notas adicionales:


```

---

**Pro tip:** Imprime este checklist o mantenerlo abierto en una ventana mientras haces la migración. ¡Buena suerte! 🚀
