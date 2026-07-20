/**
 * Secure storage utilities for sensitive data like OAuth tokens
 */

const ENCRYPTION_KEY_NAME = 'mcp-encryption-key';

// Generate or retrieve encryption key
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyData = localStorage.getItem(ENCRYPTION_KEY_NAME);
  
  if (keyData) {
    try {
      const keyBuffer = new Uint8Array(JSON.parse(keyData));
      return await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
    } catch {
      // Key corrupted, generate new one
    }
  }
  
  // Generate new key
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  // Store key for future use
  const keyBuffer = await crypto.subtle.exportKey('raw', key);
  localStorage.setItem(ENCRYPTION_KEY_NAME, JSON.stringify(Array.from(new Uint8Array(keyBuffer))));
  
  return key;
}

// Encrypt sensitive data
export async function encryptData(data: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    );
    
    // Combine IV and encrypted data
    const result = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encryptedBuffer), iv.length);
    
    return btoa(String.fromCharCode(...result));
  } catch (error) {
    console.warn('Encryption failed, storing data unencrypted:', error);
    return data;
  }
}

// Decrypt sensitive data
export async function decryptData(encryptedData: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const dataBuffer = new Uint8Array(
      atob(encryptedData).split('').map(char => char.charCodeAt(0))
    );
    
    const iv = dataBuffer.slice(0, 12);
    const encrypted = dataBuffer.slice(12);
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.warn('Decryption failed, returning data as-is:', error);
    return encryptedData;
  }
}

// Secure storage wrapper for sensitive data
export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await encryptData(value);
    localStorage.setItem(`secure_${key}`, encrypted);
  },
  
  async getItem(key: string): Promise<string | null> {
    const encrypted = localStorage.getItem(`secure_${key}`);
    if (!encrypted) return null;
    
    return await decryptData(encrypted);
  },
  
  removeItem(key: string): void {
    localStorage.removeItem(`secure_${key}`);
  }
};