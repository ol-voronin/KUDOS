import * as crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseMonobankPublicKey, verifyMonobankSignature } from './webhook-signature';

/**
 * Monobank signs with ECDSA over P-256 (the sample key in their docs decodes
 * to exactly this curve). Generating a real keypair here — rather than
 * mocking `crypto.verify` — means these tests catch a wrong algorithm name or
 * a wrong argument order, not just "the mock was called".
 */
function generateTestKeypair() {
  return crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
}

function sign(privateKey: crypto.KeyObject, body: Buffer): string {
  return crypto.sign('SHA256', body, privateKey).toString('base64');
}

describe('verifyMonobankSignature', () => {
  it('accepts a signature made with the matching private key', () => {
    const { publicKey, privateKey } = generateTestKeypair();
    const body = Buffer.from(JSON.stringify({ invoiceId: 'p2_test', status: 'success' }));

    expect(verifyMonobankSignature(body, sign(privateKey, body), publicKey)).toBe(true);
  });

  it('rejects a signature made with a different keypair', () => {
    const { publicKey } = generateTestKeypair();
    const { privateKey: otherPrivateKey } = generateTestKeypair();
    const body = Buffer.from(JSON.stringify({ invoiceId: 'p2_test', status: 'success' }));

    expect(verifyMonobankSignature(body, sign(otherPrivateKey, body), publicKey)).toBe(false);
  });

  it('rejects when the body was tampered with after signing', () => {
    const { publicKey, privateKey } = generateTestKeypair();
    const original = Buffer.from(JSON.stringify({ invoiceId: 'p2_test', status: 'created' }));
    const tampered = Buffer.from(JSON.stringify({ invoiceId: 'p2_test', status: 'success' }));

    expect(verifyMonobankSignature(tampered, sign(privateKey, original), publicKey)).toBe(false);
  });

  it('rejects garbage base64 instead of throwing', () => {
    const { publicKey } = generateTestKeypair();
    const body = Buffer.from('{}');

    expect(verifyMonobankSignature(body, 'not-a-real-signature', publicKey)).toBe(false);
  });
});

describe('parseMonobankPublicKey', () => {
  it('decodes a base64-wrapped PEM key back into a usable KeyObject', () => {
    const { publicKey, privateKey } = generateTestKeypair();
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const base64Wrapped = Buffer.from(pem).toString('base64');

    const parsed = parseMonobankPublicKey(base64Wrapped);
    const body = Buffer.from('hello');
    expect(verifyMonobankSignature(body, sign(privateKey, body), parsed)).toBe(true);
  });
});
