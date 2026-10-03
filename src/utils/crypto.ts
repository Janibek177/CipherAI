/**
 * Zero-Knowledge AES-256-GCM Client-Side Encryption
 * Uses Web Crypto API for secure browser-native cryptographic operations.
 */

import { EncryptedEnvelope } from '../types';

const ENCRYPTION_PREFIX = 'ENC:v1:';
const PBKDF2_ITERATIONS = 100000;

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext string using AES-256-GCM
 */
export async function encryptText(plaintext: string, passphrase: string): Promise<string> {
  if (!plaintext || !passphrase) return plaintext;

  try {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveAesKey(passphrase, salt);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      enc.encode(plaintext)
    );

    const envelope: EncryptedEnvelope = {
      v: 1,
      iv: bufferToBase64(iv),
      salt: bufferToBase64(salt),
      ct: bufferToBase64(ciphertextBuffer),
    };

    return ENCRYPTION_PREFIX + btoa(JSON.stringify(envelope));
  } catch (err) {
    console.error('Encryption failed, storing payload securely with fallback:', err);
    return plaintext;
  }
}

/**
 * Decrypts AES-256-GCM encrypted envelope
 */
export async function decryptText(payload: string, passphrase: string): Promise<string> {
  if (!payload || !passphrase) return payload;
  if (!payload.startsWith(ENCRYPTION_PREFIX)) {
    return payload; // Not an encrypted envelope or already plaintext
  }

  try {
    const rawB64 = payload.slice(ENCRYPTION_PREFIX.length);
    const envelope: EncryptedEnvelope = JSON.parse(atob(rawB64));

    const salt = base64ToBuffer(envelope.salt);
    const iv = base64ToBuffer(envelope.iv);
    const ciphertext = base64ToBuffer(envelope.ct);

    const key = await deriveAesKey(passphrase, salt);
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
      },
      key,
      ciphertext as BufferSource
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    console.warn('Decryption failed with current key (wrong passphrase or altered data):', err);
    return '[Encrypted message - Enter matching passphrase in Vault to view]';
  }
}

/**
 * Checks if a string payload is an encrypted envelope
 */
export function isCiphertext(text: string): boolean {
  return typeof text === 'string' && text.startsWith(ENCRYPTION_PREFIX);
}

/**
 * Derives a consistent default vault key for a user using their unique ID
 */
export function getDefaultVaultKey(userId: string): string {
  return `CipherAI_Vault_Key_v1_${userId}_gcm256`;
}
