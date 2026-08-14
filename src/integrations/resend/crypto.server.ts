// Server-only module — mã hoá/giải mã Resend API Key bằng AES-256-GCM.
// Thực thi dùng chung với các tích hợp khác qua src/lib/secret-crypto.server.ts.
// Không bao giờ import file này từ code chạy trên trình duyệt.

import { decryptSecret as decrypt, encryptSecret as encrypt } from "@/lib/secret-crypto.server";

const ENV_VAR_NAME = "RESEND_CONFIG_ENCRYPTION_KEY";

/** Encrypts plaintext, returning base64(iv || ciphertext). */
export function encryptSecret(plaintext: string): Promise<string> {
  return encrypt(plaintext, ENV_VAR_NAME);
}

/** Reverses encryptSecret — expects base64(iv || ciphertext). */
export function decryptSecret(ciphertextB64: string): Promise<string> {
  return decrypt(ciphertextB64, ENV_VAR_NAME);
}
