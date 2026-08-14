// Server-only module — mã hoá/giải mã các secret nhạy cảm (App Secret Zalo, API Key Resend...)
// bằng AES-256-GCM (Web Crypto). Khoá mã hoá lấy từ một biến môi trường server-only riêng cho
// từng loại secret (mỗi tích hợp một khoá, xoay khoá độc lập được). Không bao giờ import file
// này từ code chạy trên trình duyệt.

const ALGORITHM = "AES-GCM";
const IV_LENGTH_BYTES = 12;

async function deriveKey(envVarName: string): Promise<CryptoKey> {
  const rawKey = process.env[envVarName];
  if (!rawKey) {
    throw new Error(`Thiếu biến môi trường ${envVarName} (khoá mã hoá secret) trên server.`);
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey));
  return crypto.subtle.importKey("raw", digest, ALGORITHM, false, ["encrypt", "decrypt"]);
}

/** Encrypts plaintext using the key derived from envVarName, returning base64(iv || ciphertext). */
export async function encryptSecret(plaintext: string, envVarName: string): Promise<string> {
  const key = await deriveKey(envVarName);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, new TextEncoder().encode(plaintext));

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return Buffer.from(combined).toString("base64");
}

/** Reverses encryptSecret — expects base64(iv || ciphertext), decrypted with the same envVarName's key. */
export async function decryptSecret(ciphertextB64: string, envVarName: string): Promise<string> {
  const key = await deriveKey(envVarName);
  const combined = Buffer.from(ciphertextB64, "base64");
  const iv = combined.subarray(0, IV_LENGTH_BYTES);
  const ciphertext = combined.subarray(IV_LENGTH_BYTES);
  const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
