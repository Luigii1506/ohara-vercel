import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUrls() {
  const samples = await prisma.card.findMany({
    select: { src: true, code: true },
    take: 10
  });

  console.log('Sample URLs from database:\n');
  samples.forEach(card => {
    console.log(`${card.code}: ${card.src}`);
  });

  const totalCards = await prisma.card.count();
  const pngCards = await prisma.card.count({
    where: { src: { endsWith: '.png' }}
  });
  const webpCards = await prisma.card.count({
    where: { src: { endsWith: '.webp' }}
  });
  const keyCDNCount = await prisma.card.count({
    where: { src: { contains: 'kxcdn.com' }}
  });
  const r2Count = await prisma.card.count({
    where: { src: { contains: 'workers.dev' }}
  });

  console.log('\n--- Stats ---');
  console.log(`Total cards: ${totalCards}`);
  console.log(`PNG URLs: ${pngCards}`);
  console.log(`WebP URLs: ${webpCards}`);
  console.log(`KeyCDN URLs: ${keyCDNCount}`);
  console.log(`R2 URLs: ${r2Count}`);

  await prisma.$disconnect();
}

checkUrls().catch(console.error);
