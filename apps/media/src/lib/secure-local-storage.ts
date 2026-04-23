"use client";

/**
 * Utility to convert Uint8Array to ArrayBuffer safely.
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

/**
 * Converts an ArrayBuffer to a URL-safe Base64 string.
 */
function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Converts a URL-safe Base64 string back to a Uint8Array.
 */
function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Imports a raw key byte array as an AES-GCM CryptoKey.
 */
async function deriveKeyFromRaw(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Derives an AES-GCM key from a user passphrase using PBKDF2.
 */
async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toArrayBuffer(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a plaintext string using AES-GCM 256-bit.
 */
async function encryptData(
  key: CryptoKey,
  plaintext: string
): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, enc.encode(plaintext));
  return { iv, ciphertext };
}

/**
 * Decrypts ciphertext using AES-GCM and the provided IV.
 */
async function decryptData(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: ArrayBuffer
): Promise<string> {
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

/**
 * Encrypts and saves a JSON object to localStorage.
 * Uses AES-GCM with a randomly generated 256-bit key per save.
 *
 * @param dataKey - Storage key for the encrypted payload
 * @param keyKey - Storage key for the base64-encoded decryption key
 * @param value - The data to encrypt and save
 */
export async function saveEncryptedJson<T>(dataKey: string, keyKey: string, value: T): Promise<void> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const key = await deriveKeyFromRaw(rawKey);
  const { iv, ciphertext } = await encryptData(key, JSON.stringify(value));

  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);

  localStorage.setItem(keyKey, toBase64Url(toArrayBuffer(rawKey)));
  localStorage.setItem(dataKey, toBase64Url(toArrayBuffer(combined)));
}

/**
 * Loads and decrypts a JSON object from localStorage.
 *
 * @param dataKey - Storage key for the encrypted payload
 * @param keyKey - Storage key for the base64-encoded decryption key
 * @returns The decrypted and parsed data, or null if loading fails
 */
export async function loadEncryptedJson<T>(dataKey: string, keyKey: string): Promise<T | null> {
  try {
    const keyStr = localStorage.getItem(keyKey);
    const dataStr = localStorage.getItem(dataKey);
    if (!keyStr || !dataStr) return null;

    const rawKey = fromBase64Url(keyStr);
    const key = await deriveKeyFromRaw(rawKey);
    const combined = fromBase64Url(dataStr);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const plaintext = await decryptData(key, iv, toArrayBuffer(ciphertext));
    return JSON.parse(plaintext) as T;
  } catch (err) {
    console.error("[loadEncryptedJson] Failed:", err);
    return null;
  }
}

/**
 * Clears both the data and key from localStorage.
 */
export function clearEncryptedJson(dataKey: string, keyKey: string): void {
  localStorage.removeItem(dataKey);
  localStorage.removeItem(keyKey);
}

/**
 * Exports data to an encrypted string derived from a passphrase.
 * Suitable for usage in URL fragments.
 *
 * @param value - The data to export
 * @param passphrase - User-provided passphrase for key derivation
 * @returns Passphrase-encrypted base64url string
 */
export async function exportEncryptedJsonToFragment<T>(
  value: T,
  passphrase: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKeyFromPassphrase(passphrase, salt);
  const { iv, ciphertext } = await encryptData(key, JSON.stringify(value));

  const combined = new Uint8Array(16 + 12 + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, 16);
  combined.set(new Uint8Array(ciphertext), 28);

  return toBase64Url(toArrayBuffer(combined));
}

/**
 * Exports data to an encrypted string with an embedded key.
 *
 * @param value - The data to export
 * @returns Self-contained encrypted base64url string
 */
export async function exportEncryptedJsonToShareToken<T>(value: T): Promise<string> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const key = await deriveKeyFromRaw(rawKey);
  const { iv, ciphertext } = await encryptData(key, JSON.stringify(value));

  const combined = new Uint8Array(32 + 12 + ciphertext.byteLength);
  combined.set(rawKey, 0);
  combined.set(iv, 32);
  combined.set(new Uint8Array(ciphertext), 44);

  return toBase64Url(toArrayBuffer(combined));
}

/**
 * Decrypts and imports data from a passphrase-encrypted fragment.
 */
export async function importEncryptedJsonFromFragment<T>(
  fragment: string,
  passphrase: string
): Promise<T> {
  const combined = fromBase64Url(fragment);
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);

  const key = await deriveKeyFromPassphrase(passphrase, salt);
  const plaintext = await decryptData(key, iv, toArrayBuffer(ciphertext));
  return JSON.parse(plaintext) as T;
}

/**
 * Decrypts and imports data from a self-contained share token.
 */
export async function importEncryptedJsonFromShareToken<T>(token: string): Promise<T> {
  const combined = fromBase64Url(token);
  const rawKey = combined.slice(0, 32);
  const iv = combined.slice(32, 44);
  const ciphertext = combined.slice(44);

  const key = await deriveKeyFromRaw(rawKey);
  const plaintext = await decryptData(key, iv, toArrayBuffer(ciphertext));
  return JSON.parse(plaintext) as T;
}
