export interface EncryptedPayload {
  ciphertextHex: string;
  ivHex: string;
  authTagHex: string;
  saltHex: string;
}

const PBKDF2_ITERATIONS = 600000;

export async function deriveMasterKey(masterPassword: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPrivateKey(
  privateKeyHex: string,
  masterPassword: string,
  existingSalt?: Uint8Array
): Promise<EncryptedPayload> {
  const salt = existingSalt || crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const masterKey = await deriveMasterKey(masterPassword, salt);

  const enc = new TextEncoder();
  const encodedPlaintext = enc.encode(privateKeyHex);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    masterKey,
    encodedPlaintext
  );

  const cipherBytes = new Uint8Array(encryptedBuffer);
  // WebCrypto AES-GCM appends 16-byte authentication tag at the end of ciphertext
  const tagBytes = cipherBytes.slice(cipherBytes.length - 16);
  const dataBytes = cipherBytes.slice(0, cipherBytes.length - 16);

  return {
    ciphertextHex: bufToHex(dataBytes),
    ivHex: bufToHex(iv),
    authTagHex: bufToHex(tagBytes),
    saltHex: bufToHex(salt),
  };
}

export async function decryptPrivateKey(
  payload: EncryptedPayload,
  masterPassword: string
): Promise<string> {
  const salt = hexToBuf(payload.saltHex);
  const iv = hexToBuf(payload.ivHex);
  const data = hexToBuf(payload.ciphertextHex);
  const tag = hexToBuf(payload.authTagHex);

  const combined = new Uint8Array(data.length + tag.length);
  combined.set(data, 0);
  combined.set(tag, data.length);

  const masterKey = await deriveMasterKey(masterPassword, salt);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    masterKey,
    combined
  );

  return new TextDecoder().decode(decryptedBuffer);
}

function bufToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): Uint8Array {
  const match = hex.match(/.{1,2}/g);
  if (!match) return new Uint8Array();
  return new Uint8Array(match.map((byte) => parseInt(byte, 16)));
}
