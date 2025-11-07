# 📸 Cómo Agregar Nuevas Imágenes a R2

Después de completar la migración, usa esta guía para agregar nuevas imágenes.

---

## 🎯 **Opciones para Subir Nuevas Imágenes**

### Opción 1: Script Automatizado (Recomendado)
### Opción 2: Wrangler CLI (Manual)
### Opción 3: Cloudflare Dashboard (Visual)
### Opción 4: API/SDK (Programático)

---

## 🚀 **Opción 1: Script Automatizado** ⭐

Crea un script que automáticamente:
1. Toma imagen original
2. Genera 7 tamaños optimizados
3. Sube todos a R2
4. Inserta URL en base de datos

### Script: `scripts/add-card-image.ts`

```typescript
/**
 * Script para agregar nuevas imágenes de cartas a R2
 * Uso: npx ts-node scripts/add-card-image.ts --path ./image.jpg --code OP01-001
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'ohara-cards-images';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

const IMAGE_SIZES = {
  tiny: { width: 20, height: 28, quality: 40, suffix: '-tiny' },
  xs: { width: 100, height: 140, quality: 60, suffix: '-xs' },
  thumb: { width: 200, height: 280, quality: 70, suffix: '-thumb' },
  small: { width: 300, height: 420, quality: 75, suffix: '-small' },
  medium: { width: 600, height: 840, quality: 80, suffix: '-medium' },
  large: { width: 800, height: 1120, quality: 85, suffix: '-large' },
  original: { width: null, height: null, quality: 90, suffix: '' },
};

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function uploadCardImage(imagePath: string, cardCode: string) {
  console.log(`🚀 Uploading image for card: ${cardCode}\n`);

  // Leer imagen original
  const imageBuffer = await fs.readFile(imagePath);

  // Generar y subir cada tamaño
  for (const [sizeName, config] of Object.entries(IMAGE_SIZES)) {
    const r2Key = `cards/${cardCode}${config.suffix}.webp`;

    console.log(`   Processing ${sizeName}...`);

    // Transform image
    let transformer = sharp(imageBuffer);

    if (config.width || config.height) {
      transformer = transformer.resize({
        width: config.width || undefined,
        height: config.height || undefined,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    }

    const transformedBuffer = await transformer
      .webp({ quality: config.quality, effort: 6 })
      .toBuffer();

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      Body: transformedBuffer,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    });

    await s3Client.send(command);

    const fileSize = Math.round(transformedBuffer.length / 1024);
    console.log(`   ✅ Uploaded ${sizeName}: ${r2Key} (${fileSize}KB)`);
  }

  // Return URL for database
  const publicUrl = `${R2_PUBLIC_URL}/cards/${cardCode}.webp`;
  console.log(`\n✅ All sizes uploaded!`);
  console.log(`📝 Use this URL in your database:`);
  console.log(`   ${publicUrl}\n`);

  return publicUrl;
}

// Parse CLI args
const args = process.argv.slice(2);
const pathIndex = args.indexOf('--path');
const codeIndex = args.indexOf('--code');

if (pathIndex === -1 || codeIndex === -1) {
  console.error('Usage: npx ts-node scripts/add-card-image.ts --path <path> --code <code>');
  console.error('Example: npx ts-node scripts/add-card-image.ts --path ./OP01-001.jpg --code OP01-001');
  process.exit(1);
}

const imagePath = args[pathIndex + 1];
const cardCode = args[codeIndex + 1];

uploadCardImage(imagePath, cardCode)
  .then((url) => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
```

### Uso:

```bash
# Agregar script a package.json
npm run add-image -- --path ./downloads/OP01-001.jpg --code OP01-001

# O directamente
npx ts-node scripts/add-card-image.ts --path ./OP01-001.jpg --code OP01-001
```

### Batch Upload:

```bash
# Subir múltiples imágenes
for image in ./downloads/*.jpg; do
  code=$(basename "$image" .jpg)
  npx ts-node scripts/add-card-image.ts --path "$image" --code "$code"
done
```

---

## 🖥️ **Opción 2: Wrangler CLI**

Subir archivo directamente con Wrangler.

### Upload Single File:

```bash
# Subir imagen original
wrangler r2 object put ohara-cards-images/cards/OP01-001.webp --file ./OP01-001.webp

# Verificar
wrangler r2 object get ohara-cards-images/cards/OP01-001.webp
```

**Nota:** Esto sube solo UNA versión. Deberías generar los 7 tamaños manualmente primero.

### Generar Tamaños Manualmente:

```bash
# Usar sharp-cli o ImageMagick
npm install -g sharp-cli

# Generar tamaños
sharp -i OP01-001.jpg -o OP01-001-tiny.webp resize 20 28 --format webp --quality 40
sharp -i OP01-001.jpg -o OP01-001-xs.webp resize 100 140 --format webp --quality 60
sharp -i OP01-001.jpg -o OP01-001-thumb.webp resize 200 280 --format webp --quality 70
sharp -i OP01-001.jpg -o OP01-001-small.webp resize 300 420 --format webp --quality 75
sharp -i OP01-001.jpg -o OP01-001-medium.webp resize 600 840 --format webp --quality 80
sharp -i OP01-001.jpg -o OP01-001-large.webp resize 800 1120 --format webp --quality 85
sharp -i OP01-001.jpg -o OP01-001.webp --format webp --quality 90

# Subir todos
wrangler r2 object put ohara-cards-images/cards/OP01-001-tiny.webp --file ./OP01-001-tiny.webp
wrangler r2 object put ohara-cards-images/cards/OP01-001-xs.webp --file ./OP01-001-xs.webp
# ... etc
```

---

## 🌐 **Opción 3: Cloudflare Dashboard**

Para pocas imágenes, puedes usar la interfaz web.

### Pasos:

1. Ir a [Cloudflare R2 Dashboard](https://dash.cloudflare.com/r2)
2. Click en `ohara-cards-images`
3. Click "Upload"
4. Seleccionar archivos
5. Esperar a que se suban

**Limitaciones:**
- Solo sube archivos tal cual (sin transformaciones)
- Debes generar los 7 tamaños antes
- Tedioso para muchas imágenes

---

## 📝 **Opción 4: API/SDK Programático**

Para integrar en tu app (ej: admin panel).

### Ejemplo en Next.js API Route:

```typescript
// pages/api/admin/upload-card-image.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import formidable from 'formidable';
import sharp from 'sharp';
import fs from 'fs/promises';

export const config = {
  api: {
    bodyParser: false,
  },
};

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'Upload failed' });
    }

    const file = files.image[0];
    const cardCode = fields.code[0];

    const imageBuffer = await fs.readFile(file.filepath);

    // Generate and upload all sizes
    const sizes = {
      thumb: { width: 200, height: 280, quality: 70, suffix: '-thumb' },
      medium: { width: 600, height: 840, quality: 80, suffix: '-medium' },
      large: { width: 800, height: 1120, quality: 85, suffix: '-large' },
    };

    for (const [name, config] of Object.entries(sizes)) {
      const transformed = await sharp(imageBuffer)
        .resize(config.width, config.height, { fit: 'contain' })
        .webp({ quality: config.quality })
        .toBuffer();

      const key = `cards/${cardCode}${config.suffix}.webp`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
          Body: transformed,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );
    }

    const url = `${process.env.R2_PUBLIC_URL}/cards/${cardCode}.webp`;
    res.status(200).json({ success: true, url });
  });
}
```

### Frontend (Admin Panel):

```tsx
// components/admin/UploadCardImage.tsx
import { useState } from 'react';

export default function UploadCardImage() {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);

    const formData = new FormData(e.currentTarget);

    const res = await fetch('/api/admin/upload-card-image', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    if (data.success) {
      alert(`Image uploaded! URL: ${data.url}`);
    } else {
      alert('Upload failed');
    }

    setUploading(false);
  };

  return (
    <form onSubmit={handleUpload}>
      <input type="text" name="code" placeholder="Card code (OP01-001)" required />
      <input type="file" name="image" accept="image/*" required />
      <button type="submit" disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
    </form>
  );
}
```

---

## ✅ **Flujo Recomendado para Nuevos Sets**

Cuando sale un nuevo set de cartas:

1. **Descargar imágenes originales** (alta calidad)
2. **Organizar en carpeta** (ej: `./downloads/OP08/`)
3. **Ejecutar batch upload:**
   ```bash
   for image in ./downloads/OP08/*.jpg; do
     code=$(basename "$image" .jpg)
     npx ts-node scripts/add-card-image.ts --path "$image" --code "$code"
   done
   ```
4. **Insertar en BD:**
   ```sql
   INSERT INTO "Card" (code, name, src, ...)
   VALUES ('OP08-001', 'Card Name', 'https://images.oharatcg.com/cards/OP08-001.webp', ...);
   ```
5. **Verificar en app:** http://localhost:3000/card-list?setCode=OP08

---

## 🔒 **Seguridad**

### Restringir Acceso a API de Upload

Si creas un API route para upload, asegúrate de protegerlo:

```typescript
// pages/api/admin/upload-card-image.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  // Solo admins pueden subir
  if (!session || session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // ... resto del código
}
```

---

## 💰 **Costos de Nuevas Imágenes**

### Por cada imagen nueva:

- **Storage:** ~2MB total (7 tamaños) = $0.00003/mes
- **Upload (Class A):** 7 requests = $0.000032
- **Download (Bandwidth):** $0 (gratis)

**Para 1000 nuevas imágenes:**
- Storage: ~$0.03/mes
- Upload: ~$0.032 (one-time)
- **Total:** ~$0.06/mes

Básicamente **casi gratis** agregar nuevas imágenes. 🎉

---

## 📊 **Monitoreo**

Después de agregar nuevas imágenes:

```bash
# Ver objetos en R2
wrangler r2 object list ohara-cards-images --prefix cards/OP08

# Ver analytics
# Cloudflare Dashboard → R2 → Analytics
```

---

## 🆘 **Troubleshooting**

### "Access Denied" al subir

**Causa:** Token no tiene permisos Write.

**Solución:**
1. Ir a R2 Dashboard → Manage API Tokens
2. Verificar que tu token tiene "Object Write"
3. Regenerar token si es necesario

### "Bucket not found"

**Causa:** Variable `R2_BUCKET_NAME` incorrecta.

**Solución:**
```bash
wrangler r2 bucket list
# Verificar el nombre exacto
```

### Imagen no se ve en la app

**Causa:** Cache o URL incorrecta.

**Solución:**
```bash
# Verificar URL
curl -I https://images.oharatcg.com/cards/OP08-001-medium.webp

# Debería retornar 200
# Si retorna 404, la imagen no se subió correctamente
```

---

¡Listo! Ahora puedes agregar nuevas imágenes fácilmente. 🚀
