import nodemailer, { type Transporter } from "nodemailer";

const env = process.env;

let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT ?? 587),
    // true for port 465 (implicit TLS); 587 upgrades via STARTTLS.
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : Number(env.SMTP_PORT) === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const t = getTransporter();
  if (!t) {
    if (env.NODE_ENV === "production") throw new Error("SMTP is not configured");
    console.info(`[mailer:dev] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  await t.sendMail({ from: env.SMTP_FROM, to, subject, text });
}
