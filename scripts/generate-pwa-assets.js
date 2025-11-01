const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuración de iconos PWA
const iconSizes = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' },
];

// Configuración de Apple Touch Icons
const appleTouchIconSizes = [
  { size: 120, name: 'apple-touch-icon-120x120.png' },
  { size: 152, name: 'apple-touch-icon-152x152.png' },
  { size: 167, name: 'apple-touch-icon-167x167.png' },
  { size: 180, name: 'apple-touch-icon-180x180.png' },
];

// Configuración de Splash Screens para iOS
const appleSplashScreens = [
  // iPhone SE, iPod touch 5th generation and later
  { width: 640, height: 1136, name: 'apple-splash-640-1136.png', media: '(device-width: 320px) and (device-height: 568px)' },
  // iPhone 8, 7, 6s, 6
  { width: 750, height: 1334, name: 'apple-splash-750-1334.png', media: '(device-width: 375px) and (device-height: 667px)' },
  // iPhone 8 Plus, 7 Plus, 6s Plus, 6 Plus
  { width: 1242, height: 2208, name: 'apple-splash-1242-2208.png', media: '(device-width: 414px) and (device-height: 736px)' },
  // iPhone X, Xs, 11 Pro, 12 mini
  { width: 1125, height: 2436, name: 'apple-splash-1125-2436.png', media: '(device-width: 375px) and (device-height: 812px)' },
  // iPhone Xs Max, 11 Pro Max
  { width: 1242, height: 2688, name: 'apple-splash-1242-2688.png', media: '(device-width: 414px) and (device-height: 896px)' },
  // iPhone Xr, 11
  { width: 828, height: 1792, name: 'apple-splash-828-1792.png', media: '(device-width: 414px) and (device-height: 896px)' },
  // iPhone 12, 12 Pro, 13, 13 Pro, 14
  { width: 1170, height: 2532, name: 'apple-splash-1170-2532.png', media: '(device-width: 390px) and (device-height: 844px)' },
  // iPhone 12 Pro Max, 13 Pro Max, 14 Plus
  { width: 1284, height: 2778, name: 'apple-splash-1284-2778.png', media: '(device-width: 428px) and (device-height: 926px)' },
  // iPhone 14 Pro
  { width: 1179, height: 2556, name: 'apple-splash-1179-2556.png', media: '(device-width: 393px) and (device-height: 852px)' },
  // iPhone 14 Pro Max
  { width: 1290, height: 2796, name: 'apple-splash-1290-2796.png', media: '(device-width: 430px) and (device-height: 932px)' },
  // iPad mini, Air
  { width: 1536, height: 2048, name: 'apple-splash-1536-2048.png', media: '(device-width: 768px) and (device-height: 1024px)' },
  // iPad Pro 10.5"
  { width: 1668, height: 2224, name: 'apple-splash-1668-2224.png', media: '(device-width: 834px) and (device-height: 1112px)' },
  // iPad Pro 11"
  { width: 1668, height: 2388, name: 'apple-splash-1668-2388.png', media: '(device-width: 834px) and (device-height: 1194px)' },
  // iPad Pro 12.9"
  { width: 2048, height: 2732, name: 'apple-splash-2048-2732.png', media: '(device-width: 1024px) and (device-height: 1366px)' },
];

const sourceImage = path.join(__dirname, '../public/new_favicon.png');
const iconsDir = path.join(__dirname, '../public/icons');
const splashDir = path.join(__dirname, '../public/splash');

// Crear directorios si no existen
[iconsDir, splashDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function generateIcons() {
  console.log('🎨 Generando iconos PWA...');

  for (const { size, name } of iconSizes) {
    await sharp(sourceImage)
      .resize(size, size)
      .toFile(path.join(iconsDir, name));
    console.log(`✅ Generado: ${name}`);
  }

  console.log('\n🍎 Generando Apple Touch Icons...');
  for (const { size, name } of appleTouchIconSizes) {
    await sharp(sourceImage)
      .resize(size, size)
      .toFile(path.join(iconsDir, name));
    console.log(`✅ Generado: ${name}`);
  }
}

async function generateMaskableIcon() {
  console.log('\n🎭 Generando icono maskable (con padding)...');

  // Crear un icono maskable con padding del 20% (safe zone para Android)
  const size = 512;
  const padding = Math.floor(size * 0.1); // 10% de padding

  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 26, g: 26, b: 26, alpha: 1 } // #1a1a1a
    }
  });

  // Redimensionar el logo para que quepa con padding
  const logoSize = size - (padding * 2);
  const logo = await sharp(sourceImage)
    .resize(logoSize, logoSize)
    .toBuffer();

  await canvas
    .composite([{
      input: logo,
      top: padding,
      left: padding
    }])
    .toFile(path.join(iconsDir, 'icon-512x512-maskable.png'));

  console.log('✅ Generado: icon-512x512-maskable.png');
}

async function generateSplashScreens() {
  console.log('\n📱 Generando splash screens para iOS...');

  for (const { width, height, name } of appleSplashScreens) {
    // Calcular tamaño del logo (30% del ancho de la pantalla)
    const logoSize = Math.floor(width * 0.3);

    // Crear canvas con color de fondo
    const canvas = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 26, g: 26, b: 26, alpha: 1 } // #1a1a1a
      }
    });

    // Redimensionar logo
    const logo = await sharp(sourceImage)
      .resize(logoSize, logoSize)
      .toBuffer();

    // Centrar logo
    const top = Math.floor((height - logoSize) / 2);
    const left = Math.floor((width - logoSize) / 2);

    await canvas
      .composite([{
        input: logo,
        top,
        left
      }])
      .toFile(path.join(splashDir, name));

    console.log(`✅ Generado: ${name} (${width}x${height})`);
  }
}

async function generateManifestTemplate() {
  console.log('\n📝 Generando template de HTML con splash screens...');

  const splashLinks = appleSplashScreens.map(({ name, media }) =>
    `<link rel="apple-touch-startup-image" href="/splash/${name}" media="${media}" />`
  ).join('\n    ');

  const appleIconLinks = appleTouchIconSizes.map(({ size, name }) =>
    `<link rel="apple-touch-icon" sizes="${size}x${size}" href="/icons/${name}" />`
  ).join('\n    ');

  const template = `
<!-- ============================================ -->
<!-- SPLASH SCREENS PARA iOS -->
<!-- Agregar estos tags en el <head> de tu layout.tsx -->
<!-- ============================================ -->

<!-- Apple Touch Icons -->
${appleIconLinks}

<!-- Apple Splash Screens -->
${splashLinks}

<!-- Favicon standard -->
<link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-72x72.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-72x72.png" />
`;

  fs.writeFileSync(
    path.join(__dirname, '../public/splash-screens-template.html'),
    template.trim()
  );

  console.log('✅ Template guardado en: public/splash-screens-template.html');
}

async function updateManifest() {
  console.log('\n📱 Actualizando manifest.json...');

  const manifestPath = path.join(__dirname, '../public/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  manifest.icons = [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ];

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('✅ manifest.json actualizado');
}

async function main() {
  try {
    console.log('🚀 Iniciando generación de assets PWA...\n');

    await generateIcons();
    await generateMaskableIcon();
    await generateSplashScreens();
    await generateManifestTemplate();
    await updateManifest();

    console.log('\n✨ ¡Todos los assets PWA generados exitosamente!');
    console.log('\n📋 Siguiente paso:');
    console.log('   1. Revisa el archivo: public/splash-screens-template.html');
    console.log('   2. Copia los tags al <head> de tu app/layout.tsx');

  } catch (error) {
    console.error('❌ Error generando assets:', error);
    process.exit(1);
  }
}

main();
