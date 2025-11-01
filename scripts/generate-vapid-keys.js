const webpush = require('web-push');

console.log('🔑 Generando VAPID keys para Push Notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('✅ VAPID Keys generadas:\n');
console.log('Public Key (NEXT_PUBLIC_VAPID_PUBLIC_KEY):');
console.log(vapidKeys.publicKey);
console.log('\nPrivate Key (VAPID_PRIVATE_KEY):');
console.log(vapidKeys.privateKey);

console.log('\n📝 Agregar a tu archivo .env.local:');
console.log(`
NEXT_PUBLIC_VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"
VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"
`);

console.log('\n⚠️  IMPORTANTE:');
console.log('- Guarda estas keys de forma segura');
console.log('- NO las compartas públicamente');
console.log('- NO las subas a git');
console.log('- Agrégalas a .env.local y .gitignore');
