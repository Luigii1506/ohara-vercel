# 🚀 Guía de Despliegue - Ohara TCG

Este proyecto consta de **dos aplicaciones separadas** que se despliegan de forma independiente:

1. **Next.js App** (Vercel) - Aplicación web principal
2. **Cloudflare Worker** (Cloudflare) - Optimización y servicio de imágenes desde R2

---

## 📦 1. Desplegar Next.js App a Vercel

### Pre-requisitos
- Cuenta en Vercel
- Repositorio conectado a Vercel

### Variables de Entorno en Vercel

Configura estas variables en el Dashboard de Vercel:

```bash
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="https://tu-dominio.com"
NEXTAUTH_SECRET="tu-secret-aquí"

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Cloudflare R2 (para subir imágenes desde admin)
R2_ACCOUNT_ID="tu-account-id"
R2_ACCESS_KEY_ID="tu-access-key"
R2_SECRET_ACCESS_KEY="tu-secret-key"
R2_BUCKET_NAME="ohara"

# Cloudflare Worker URL (después de desplegar el worker)
NEXT_PUBLIC_WORKER_URL="https://images.oharatcg.com"

# Otras variables
NODE_ENV="production"
```

### Despliegue

```bash
# Opción 1: Push a main/master (auto-deploy)
git push origin main

# Opción 2: Manual desde CLI
npm install -g vercel
vercel --prod
```

### Verificación
```bash
# Verificar que el sitio esté funcionando
curl https://tu-dominio.com

# Verificar build logs en Vercel Dashboard
```

---

## ☁️ 2. Desplegar Cloudflare Worker

### Pre-requisitos

```bash
# Instalar Wrangler CLI
npm install -g wrangler

# Login a Cloudflare
wrangler login
```

### Paso 1: Configurar R2 Bucket

```bash
# Crear bucket (si no existe)
wrangler r2 bucket create ohara

# Listar buckets para verificar
wrangler r2 bucket list
```

### Paso 2: Configurar wrangler.toml

Edita `cloudflare/wrangler.toml`:

```toml
# Producción
[env.production]
name = "ohara-image-worker-prod"
route = { pattern = "images.oharatcg.com/*", zone_name = "oharatcg.com" }

# Asegúrate que el bucket_name coincida
[[r2_buckets]]
binding = "IMAGES_BUCKET"
bucket_name = "ohara"  # Tu bucket de R2
```

### Paso 3: Desplegar Worker

```bash
cd cloudflare

# Instalar dependencias
npm install

# Deploy a staging (primero probar)
npm run deploy:staging

# Verificar staging
curl https://ohara-image-worker-staging.workers.dev/health

# Deploy a producción
npm run deploy:production
```

### Paso 4: Configurar Custom Domain

#### Opción 1: Usar Cloudflare Dashboard (Recomendado)

1. Ve a **Workers & Pages** en Cloudflare Dashboard
2. Selecciona tu worker: `ohara-image-worker-prod`
3. Ve a **Settings → Triggers**
4. Click en **Add Custom Domain**
5. Ingresa: `images.oharatcg.com`
6. Cloudflare configurará automáticamente DNS y SSL

#### Opción 2: Usar Route (Avanzado)

Ya configurado en `wrangler.toml`:
```toml
route = { pattern = "images.oharatcg.com/*", zone_name = "oharatcg.com" }
```

Verifica que el DNS esté apuntando a Cloudflare.

### Verificación

```bash
# Health check
curl https://images.oharatcg.com/health
# Debería retornar: OK

# Ver logs en tiempo real
cd cloudflare
npm run tail

# Verificar una imagen (después de migrar)
curl -I https://images.oharatcg.com/cards/OP01-001-medium.webp
```

Headers esperados:
```
HTTP/2 200
content-type: image/webp
cache-control: public, max-age=31536000, immutable
x-cache: HIT
access-control-allow-origin: *
```

---

## 🔄 3. Workflow Completo de Despliegue

### Para un nuevo despliegue completo:

```bash
# 1. Asegurarse que todo compila localmente
npm run build

# 2. Commit y push a GitHub
git add .
git commit -m "Deploy: descripción de cambios"
git push origin main

# 3. Vercel desplegará automáticamente Next.js
# Monitorear en: https://vercel.com/dashboard

# 4. Si hay cambios en el worker de Cloudflare
cd cloudflare
npm run deploy:staging  # Probar primero
npm run deploy:production  # Luego a producción
cd ..
```

---

## 🔍 Troubleshooting

### Error: "Cannot find name 'R2Bucket'" al desplegar a Vercel

**Solución:** Ya está resuelto con estos cambios:
- `tsconfig.json` excluye el directorio `cloudflare`
- `.vercelignore` ignora el directorio `cloudflare`

Vercel NO necesita compilar el worker de Cloudflare.

### Las imágenes no cargan desde el worker

1. Verifica que el worker esté desplegado:
   ```bash
   curl https://images.oharatcg.com/health
   ```

2. Verifica que las imágenes existan en R2:
   ```bash
   wrangler r2 object list ohara --prefix=cards/
   ```

3. Verifica los logs del worker:
   ```bash
   cd cloudflare
   npm run tail
   ```

### El worker responde 404

- Verifica que el R2 bucket binding esté correcto en `wrangler.toml`
- Verifica que las imágenes estén en la ruta correcta en R2
- El path debe ser: `cards/nombre-imagen.webp`

---

## 📊 Monitoreo Post-Despliegue

### Vercel (Next.js)
- Dashboard: https://vercel.com/dashboard
- Analytics: Requests, performance, errors
- Logs: Real-time function logs

### Cloudflare Workers
- Dashboard: https://dash.cloudflare.com → Workers & Pages
- Métricas: Requests/sec, cache hit rate, latency
- Logs: `npm run tail` en directorio cloudflare/

### R2 Storage
- Dashboard: https://dash.cloudflare.com → R2
- Métricas: Storage used, requests, bandwidth

---

## 💰 Costos Esperados

### Vercel
- **Hobby**: GRATIS (hasta 100GB bandwidth)
- **Pro**: $20/mes (si necesitas más)

### Cloudflare
- **Workers Paid**: $5/mes + $0.50/millón requests
- **R2 Storage**: ~$3/mes (200GB de imágenes)
- **R2 Bandwidth**: GRATIS (sin límite)

**Total estimado**: $8-11/mes vs $65/mes con KeyCDN

---

## 🎯 Checklist de Despliegue

- [ ] Variables de entorno configuradas en Vercel
- [ ] Next.js desplegado en Vercel
- [ ] R2 bucket creado
- [ ] Imágenes migradas a R2 (ver `cloudflare/ADDING-NEW-IMAGES.md`)
- [ ] Cloudflare Worker desplegado a staging
- [ ] Cloudflare Worker desplegado a producción
- [ ] Custom domain configurado: `images.oharatcg.com`
- [ ] SSL/HTTPS funcionando
- [ ] Health check OK: `curl https://images.oharatcg.com/health`
- [ ] Imágenes cargando correctamente en la app
- [ ] Cache hit rate >90% después de 24 horas
- [ ] Monitoring configurado

---

## 📚 Documentación Adicional

- [Cloudflare Worker Deployment](cloudflare/DEPLOYMENT.md)
- [Adding New Images to R2](cloudflare/ADDING-NEW-IMAGES.md)
- [Cloudflare R2 Start Guide](cloudflare/README-START-HERE.md)

---

## 🆘 Soporte

Si encuentras problemas:
1. Revisa los logs de Vercel y Cloudflare
2. Verifica las variables de entorno
3. Consulta la documentación en `/cloudflare/`
