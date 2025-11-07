/**
 * Script de prueba para subir una imagen a R2
 * Uso: node scripts/test-upload.js
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno (busca en carpeta cloudflare primero, luego en raíz)
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'ohara-cards-images';

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.error('❌ Error: Missing R2 credentials in .env.local');
  console.error('Required variables:');
  console.error('  - CLOUDFLARE_ACCOUNT_ID');
  console.error('  - R2_ACCESS_KEY_ID');
  console.error('  - R2_SECRET_ACCESS_KEY');
  process.exit(1);
}

// Configurar S3 client para R2
const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

async function uploadTestImage() {
  try {
    console.log('🚀 Starting test upload to R2...\n');

    // Crear una imagen de prueba simple (1x1 pixel PNG)
    const testImageData = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const testKey = `test/sample-${Date.now()}.png`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: testImageData,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable',
    });

    await S3.send(command);

    console.log('✅ Test image uploaded successfully!');
    console.log(`   Bucket: ${BUCKET_NAME}`);
    console.log(`   Key: ${testKey}`);
    console.log(`   Size: ${testImageData.length} bytes`);
    console.log('\n📝 Next steps:');
    console.log('   1. Deploy the Worker: npm run deploy');
    console.log('   2. Test the URL: https://your-worker.workers.dev/' + testKey);
    console.log('   3. Run migration script: npm run migrate');

  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    if (error.$metadata) {
      console.error('   Status:', error.$metadata.httpStatusCode);
    }
    process.exit(1);
  }
}

uploadTestImage();
