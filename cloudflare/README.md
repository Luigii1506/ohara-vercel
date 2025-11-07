# Cloudflare R2 + Workers - Configuración

## 📋 Requisitos Previos

1. Cuenta de Cloudflare (Free o Paid)
2. Dominio configurado en Cloudflare (opcional pero recomendado)
3. Node.js 18+ y npm instalado
4. Wrangler CLI instalado globalmente

## 🚀 Paso 1: Instalar Wrangler

```bash
npm install -g wrangler

# Login a Cloudflare
wrangler login
```

## 🗄️ Paso 2: Crear R2 Bucket

```bash
# Crear bucket para imágenes
wrangler r2 bucket create ohara-cards-images

# Verificar creación
wrangler r2 bucket list
```

## 🔑 Paso 3: Obtener Credenciales R2

1. Ve a Cloudflare Dashboard → R2
2. Click en "Manage R2 API Tokens"
3. Crear nuevo token con permisos:
   - **Object Read & Write**
   - Scope: `ohara-cards-images` bucket

4. Guardar credenciales (necesitarás estos valores):
   - `CLOUDFLARE_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME` = `ohara-cards-images`

## 📝 Paso 4: Configurar Variables de Entorno

Agregar a tu archivo `.env.local`:

```env
# Cloudflare R2 Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
R2_ACCESS_KEY_ID=your_access_key_here
R2_SECRET_ACCESS_KEY=your_secret_key_here
R2_BUCKET_NAME=ohara-cards-images
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

Para obtener `R2_PUBLIC_URL`:
```bash
wrangler r2 bucket domain add ohara-cards-images
# Esto te dará una URL como: https://pub-xxxxx.r2.dev
```

## 🌐 Paso 5: (Opcional) Configurar Dominio Personalizado

Si quieres usar tu propio dominio (ej: `images.oharatcg.com`):

1. En Cloudflare Dashboard → R2 → tu bucket
2. Click "Settings" → "Public access"
3. Add Custom Domain → `images.oharatcg.com`
4. Cloudflare creará automáticamente el DNS record

Beneficios:
- URLs más profesionales
- Mejor branding
- Fácil migración futura si cambias de provider

## ✅ Verificación

Sube una imagen de prueba:

```bash
# Desde la carpeta /cloudflare
npm run test:upload
```

Deberías ver: `✅ Test image uploaded successfully to R2`

## 📊 Costos Estimados

Para 30,000 imágenes (~200GB almacenamiento):

- Almacenamiento: $3/mes
- Class A Operations (writes): ~$0.10/mes
- Class B Operations (reads): ~$0.00 (incluido)
- Bandwidth egress: **$0** 🎉

**Total estimado: ~$3-5/mes**

## 🔒 Seguridad

El bucket debe estar **privado** por defecto. Todo el acceso público será a través del Worker que:
- Valida requests
- Aplica rate limiting
- Transforma imágenes on-the-fly
- Cachea agresivamente en edge

## 📚 Documentación Oficial

- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
