const RESEND_API_URL = "https://api.resend.com/emails";

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

const DEFAULT_FROM = process.env.EMAIL_FROM || "Ohara TCG <no-reply@oharatcg.com>";

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not configured. Rendering email payload to console.", {
      to,
      subject,
    });
    console.info(html);
    return;
  }

  await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: DEFAULT_FROM,
      to: [to],
      subject,
      html,
      text: text ?? html.replace(/<[^>]+>/g, ""),
    }),
  });
}

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: {
  to: string;
  name?: string | null;
  resetUrl: string;
}) {
  const safeName = name?.trim() || "Nakama";
  const subject = "Recupera tu contraseña de OharaTCG";
  const html = `
    <h2>Hola ${safeName},</h2>
    <p>Recibimos una solicitud para restablecer tu contraseña.</p>
    <p>
      <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
        Restablecer contraseña
      </a>
    </p>
    <p>O copia y pega este enlace en tu navegador:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p>Este enlace expira en 30 minutos. Si no solicitaste este cambio puedes ignorar este correo.</p>
  `;

  await sendEmail({ to, subject, html });
}
