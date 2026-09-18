import { Contact, ContactField } from 'expo-contacts';
import * as Crypto from 'expo-crypto';
import { getLocales } from 'expo-localization';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

import { apiFetch } from '@/lib/api';

export type FriendMatch = {
  id: string;
  username: string | null;
  name: string;
  image: string | null;
};

const MAX_HASHES = 2000;

function sha256(value: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

// Reads the address book, normalizes phone numbers to E.164 (using the
// device region for numbers saved without a country code) and emails to
// lowercase, and hashes everything on-device. Only hashes leave the phone.
export async function findFriendsFromContacts(): Promise<FriendMatch[]> {
  const region = (getLocales()[0]?.regionCode ?? 'US') as CountryCode;
  const contacts = await Contact.getAllDetails([ContactField.PHONES, ContactField.EMAILS] as const);

  const phones = new Set<string>();
  const emails = new Set<string>();
  for (const c of contacts) {
    for (const p of c.phones ?? []) {
      const parsed = p.number ? parsePhoneNumberFromString(p.number, region) : undefined;
      if (parsed?.isValid()) phones.add(parsed.number);
    }
    for (const e of c.emails ?? []) {
      const address = e.address?.trim().toLowerCase();
      if (address?.includes('@')) emails.add(address);
    }
  }

  const [phoneHashes, emailHashes] = await Promise.all([
    Promise.all([...phones].slice(0, MAX_HASHES).map(sha256)),
    Promise.all([...emails].slice(0, MAX_HASHES).map(sha256)),
  ]);
  if (phoneHashes.length === 0 && emailHashes.length === 0) return [];

  const { matches } = await apiFetch<{ matches: FriendMatch[] }>('/api/contacts/match', {
    method: 'POST',
    body: JSON.stringify({ phoneHashes, emailHashes }),
  });
  return matches;
}
