import * as crypto from 'node:crypto';

/**
 * Verification of Monobank's `X-Sign` webhook header.
 *
 * Split out from `MonobankService` on purpose: this is the single most
 * security-critical piece of the payment feature (an unverified webhook lets
 * anyone mark any order as paid), and a pure function is what makes it
 * exhaustively testable without a live Monobank token or network access.
 *
 * Per Monobank's Acquiring docs: `X-Sign` is an ECDSA signature (SHA-256 over
 * the raw request body) verified against the public key from
 * `GET /api/merchant/pubkey`, which is itself base64-encoded PEM (SPKI, P-256).
 */
export function verifyMonobankSignature(
  rawBody: Buffer,
  signatureBase64: string,
  publicKey: crypto.KeyObject | string,
): boolean {
  try {
    const signature = Buffer.from(signatureBase64, 'base64');
    return crypto.verify('SHA256', rawBody, publicKey, signature);
  } catch {
    // A malformed base64 signature or an incompatible key is not a crash,
    // it is "this webhook did not verify" — same outcome as a wrong signature.
    return false;
  }
}

/** Decodes Monobank's `{ key: "<base64>" }` pubkey response into a KeyObject. */
export function parseMonobankPublicKey(base64Pem: string): crypto.KeyObject {
  const pem = Buffer.from(base64Pem, 'base64').toString('utf-8');
  return crypto.createPublicKey(pem);
}
