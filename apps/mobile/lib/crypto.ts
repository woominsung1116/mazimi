/**
 * lib/crypto.ts — Document vault encryption helpers
 *
 * AES-256-CBC encryption with PKCS7 padding.
 *
 * - Key derivation: HMAC-like double-hash with a per-user random salt
 *   stored in expo-secure-store.
 * - Each encrypted blob is prefixed with a 16-byte random IV.
 * - Uses `aes-js` for the AES primitive, `expo-crypto` for secure
 *   random bytes and SHA-256, and `expo-secure-store` for persisting
 *   the salt and master key material.
 */

import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import aesjs from "aes-js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IV_LENGTH = 16; // AES block size
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 32; // 256-bit random salt
const SECURE_STORE_SALT_PREFIX = "vault_salt_";
const SECURE_STORE_MASTER_KEY = "vault_master_key";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert a hex string to Uint8Array. */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Convert a Uint8Array to a hex string. */
function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/** Convert a base64 string to Uint8Array. */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Convert a Uint8Array to a base64 string. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Master key management (stored in SecureStore, never leaves the device)
// ---------------------------------------------------------------------------

/**
 * Retrieve or generate the app-wide master key.
 * This 256-bit random key is generated once and stored in SecureStore.
 * It is combined with the user-specific salt during key derivation.
 */
async function getOrCreateMasterKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(SECURE_STORE_MASTER_KEY);
  if (existing) {
    return existing;
  }

  const randomBytes = Crypto.getRandomBytes(KEY_LENGTH);
  const masterKeyHex = bytesToHex(randomBytes);
  await SecureStore.setItemAsync(SECURE_STORE_MASTER_KEY, masterKeyHex);
  return masterKeyHex;
}

/**
 * Retrieve or generate a per-user random salt.
 * Stored in SecureStore keyed by userId.
 */
async function getOrCreateSalt(userId: string): Promise<string> {
  const storeKey = `${SECURE_STORE_SALT_PREFIX}${userId}`;
  const existing = await SecureStore.getItemAsync(storeKey);
  if (existing) {
    return existing;
  }

  const randomBytes = Crypto.getRandomBytes(SALT_LENGTH);
  const saltHex = bytesToHex(randomBytes);
  await SecureStore.setItemAsync(storeKey, saltHex);
  return saltHex;
}

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

/**
 * Derive a 256-bit encryption key from the userId.
 *
 * Process: SHA256(masterKey + SHA256(salt + userId))
 *
 * - A per-user random salt prevents rainbow-table attacks on userId.
 * - A device-local master key (from SecureStore) ensures that knowing
 *   the userId alone is not enough to derive the key.
 */
export async function generateEncryptionKey(userId: string): Promise<string> {
  const masterKeyHex = await getOrCreateMasterKey();
  const saltHex = await getOrCreateSalt(userId);

  // Inner hash: SHA256(salt + userId)
  const innerDigest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    saltHex + userId,
    { encoding: Crypto.CryptoEncoding.HEX },
  );

  // Outer hash: SHA256(masterKey + innerDigest)
  const derivedKey = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    masterKeyHex + innerDigest,
    { encoding: Crypto.CryptoEncoding.HEX },
  );

  return derivedKey; // 64 hex chars = 256-bit key
}

// ---------------------------------------------------------------------------
// AES-256-CBC encryption / decryption
// ---------------------------------------------------------------------------

/**
 * Encrypt `plainBytes` with AES-256-CBC.
 * Returns IV (16 bytes) prepended to the ciphertext.
 */
function aesEncrypt(plainBytes: Uint8Array, keyHex: string): Uint8Array {
  const keyBytes = hexToBytes(keyHex.slice(0, KEY_LENGTH * 2));
  const iv = Crypto.getRandomBytes(IV_LENGTH);

  const padded = aesjs.padding.pkcs7.pad(plainBytes);
  const aesCbc = new aesjs.ModeOfOperation.cbc(keyBytes, iv);
  const cipherBytes = aesCbc.encrypt(padded);

  // Prepend IV to ciphertext
  const result = new Uint8Array(IV_LENGTH + cipherBytes.length);
  result.set(iv, 0);
  result.set(cipherBytes, IV_LENGTH);
  return result;
}

/**
 * Decrypt data produced by `aesEncrypt`.
 * Expects the first 16 bytes to be the IV.
 */
function aesDecrypt(data: Uint8Array, keyHex: string): Uint8Array {
  const keyBytes = hexToBytes(keyHex.slice(0, KEY_LENGTH * 2));
  const iv = data.slice(0, IV_LENGTH);
  const cipherBytes = data.slice(IV_LENGTH);

  const aesCbc = new aesjs.ModeOfOperation.cbc(keyBytes, iv);
  const paddedPlain = aesCbc.decrypt(cipherBytes);
  return aesjs.padding.pkcs7.strip(paddedPlain);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read the file at `uri`, encrypt its contents with AES-256-CBC,
 * and write the result as `<originalUri>.enc`.
 *
 * The encrypted file format is: IV (16 bytes) || AES-256-CBC ciphertext.
 *
 * Returns the URI of the encrypted file.
 */
export async function encryptFile(uri: string, key: string): Promise<string> {
  const encUri = `${uri}.enc`;

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const plainBytes = base64ToBytes(base64);
  const encryptedBytes = aesEncrypt(plainBytes, key);
  const encryptedBase64 = bytesToBase64(encryptedBytes);

  await FileSystem.writeAsStringAsync(encUri, encryptedBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return encUri;
}

/**
 * Read the encrypted file at `encUri`, decrypt it with AES-256-CBC,
 * write the result to a temp file in the cache directory, and return its URI.
 *
 * The caller is responsible for deleting the temp file when done (e.g. after
 * sharing or displaying).
 */
export async function decryptFile(
  encUri: string,
  key: string,
): Promise<string> {
  const originalUri = encUri.endsWith(".enc")
    ? encUri.slice(0, -4)
    : encUri;
  const fileName = originalUri.split("/").pop() ?? "decrypted_file";
  const tempUri = `${FileSystem.cacheDirectory}vault_tmp/${fileName}`;

  // Ensure the temp directory exists
  const tmpDir = `${FileSystem.cacheDirectory}vault_tmp`;
  const dirInfo = await FileSystem.getInfoAsync(tmpDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(tmpDir, { intermediates: true });
  }

  const cipherBase64 = await FileSystem.readAsStringAsync(encUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const cipherBytes = base64ToBytes(cipherBase64);
  const plainBytes = aesDecrypt(cipherBytes, key);
  const plainBase64 = bytesToBase64(plainBytes);

  await FileSystem.writeAsStringAsync(tempUri, plainBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return tempUri;
}
