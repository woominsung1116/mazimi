/**
 * lib/crypto.ts — Document vault encryption helpers
 *
 * MVP implementation: SHA-256 key derivation + XOR stream cipher.
 *
 * TODO: Upgrade to proper AES-256-CBC/GCM using react-native-aes-crypto once
 *       the library is vetted for Expo SDK 52. The current XOR approach is
 *       intentionally simple for an offline MVP and is NOT production-grade.
 *       Replace `encryptFile` / `decryptFile` with AES calls and store a random
 *       IV alongside each .enc file before shipping to production users.
 */

import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system";

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

/**
 * Derive a hex string key from a userId by hashing it with SHA-256.
 * The same userId always produces the same key (deterministic, no salt).
 *
 * TODO: Add a per-user random salt stored in expo-secure-store so that
 *       the key is not recoverable from the userId alone.
 */
export async function generateEncryptionKey(userId: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    userId,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return digest; // 64 hex chars = 256-bit key
}

// ---------------------------------------------------------------------------
// XOR stream helpers (internal)
// ---------------------------------------------------------------------------

/**
 * Expand the hex key into a repeating byte sequence of the required length,
 * then XOR each byte of `data` against it.
 *
 * Because XOR is its own inverse, the same function handles both
 * encryption and decryption.
 */
function xorBytes(data: Uint8Array, hexKey: string): Uint8Array {
  // Convert hex key to byte array
  const keyBytes = new Uint8Array(hexKey.length / 2);
  for (let i = 0; i < keyBytes.length; i++) {
    keyBytes[i] = parseInt(hexKey.slice(i * 2, i * 2 + 2), 16);
  }

  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return result;
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Read the file at `uri`, XOR-encrypt its contents with the derived key,
 * and write the result as `<originalUri>.enc`.
 *
 * Returns the URI of the encrypted file.
 */
export async function encryptFile(uri: string, key: string): Promise<string> {
  const encUri = `${uri}.enc`;

  // expo-file-system reads files as base64
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const plainBytes = base64ToBytes(base64);
  const cipherBytes = xorBytes(plainBytes, key);
  const cipherBase64 = bytesToBase64(cipherBytes);

  await FileSystem.writeAsStringAsync(encUri, cipherBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return encUri;
}

/**
 * Read the encrypted file at `encUri`, XOR-decrypt it, write the result to a
 * temp file in the cache directory, and return its URI.
 *
 * The caller is responsible for deleting the temp file when done (e.g. after
 * sharing or displaying). The temp file name mirrors the encrypted file name
 * but without the `.enc` suffix.
 */
export async function decryptFile(
  encUri: string,
  key: string
): Promise<string> {
  // Strip the .enc suffix to reconstruct the original extension
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
  const plainBytes = xorBytes(cipherBytes, key);
  const plainBase64 = bytesToBase64(plainBytes);

  await FileSystem.writeAsStringAsync(tempUri, plainBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return tempUri;
}
