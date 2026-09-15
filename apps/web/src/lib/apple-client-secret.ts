import { importPKCS8, SignJWT } from "jose";

// Apple's OAuth "client secret" is a short-lived JWT signed with your
// Sign in with Apple private key (.p8), not a static string. We mint it at
// startup so there's no secret to rotate by hand every 6 months.
// https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret
export async function createAppleClientSecret({
  teamId,
  keyId,
  clientId,
  privateKey,
}: {
  teamId: string;
  keyId: string;
  clientId: string;
  privateKey: string;
}): Promise<string> {
  // Env vars often store the PEM with literal "\n" sequences.
  const pem = privateKey.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("180d") // Apple's maximum is 6 months
    .sign(key);
}
