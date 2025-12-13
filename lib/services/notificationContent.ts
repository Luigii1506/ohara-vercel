export const notificationContent = (cardName: string, price: string) => {
  const emojis = ["💥", "🔥", "⚠️", "🚨", "⚡", "💰"];
  const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

  const templates = [
    `${randomEmoji} La carta *${cardName}* ha cambiado de precio: ahora vale ${price}. ¡Revisa tus estrategias!`,
    `${randomEmoji} Atención: *${cardName}* alcanzó ${price}.`,
    `${randomEmoji} Mercado en movimiento: *${cardName}* cuesta ${price}.`,
    `${randomEmoji} Update: *${cardName}* se movió a ${price}.`,
    `${randomEmoji} 🔔 Notificación financiera: *${cardName}* ahora vale ${price}.` ,
    `${randomEmoji} Precios cambiantes: *${cardName}* tiene un nuevo valor de ${price}.` ,
    `${randomEmoji} 📈 Alerta: *${cardName}* alcanzó ${price}.` ,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
};
