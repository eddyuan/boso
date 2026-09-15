const env = process.env;

// Sends an SMS through Twilio's Messages API. Uses a Messaging Service if
// configured (recommended: sender pools, compliance), else a From number.
export async function sendSms({ to, body }: { to: string; body: string }) {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    if (env.NODE_ENV === "production") throw new Error("Twilio is not configured");
    console.info(`[sms:dev] to=${to}\n${body}`);
    return;
  }

  const params = new URLSearchParams({ To: to, Body: body });
  if (env.TWILIO_MESSAGING_SERVICE_SID) params.set("MessagingServiceSid", env.TWILIO_MESSAGING_SERVICE_SID);
  else if (env.TWILIO_FROM_NUMBER) params.set("From", env.TWILIO_FROM_NUMBER);
  else throw new Error("Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER");

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Twilio send failed (${res.status}): ${detail}`);
  }
}
