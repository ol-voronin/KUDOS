import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import type { KeyObject } from 'node:crypto';
import { ErrorCode } from '@dt/contracts';
import { parseMonobankPublicKey, verifyMonobankSignature } from './webhook-signature';

const MONOBANK_API = 'https://api.monobank.ua';

export interface CreateInvoiceInput {
  readonly amountMinor: number;
  readonly reference: string;
  readonly destination: string;
  readonly redirectUrl: string;
  readonly webHookUrl: string;
  readonly validitySeconds?: number;
}

export interface CreateInvoiceResult {
  readonly invoiceId: string;
  readonly pageUrl: string;
}

/**
 * Thin client for Monobank's Acquiring API (v2410).
 *
 * Cannot be exercised against the real API in this environment — that needs
 * a real or test `MONOBANK_TOKEN` from https://api.monobank.ua/, which is not
 * available here. The token is checked lazily, at call time (same pattern as
 * `TELEGRAM_BOT_TOKEN`), so the rest of the API keeps working without it.
 */
@Injectable()
export class MonobankService {
  private readonly logger = new Logger(MonobankService.name);
  private cachedPublicKey: KeyObject | null = null;

  private token(): string {
    const token = process.env['MONOBANK_TOKEN'];
    if (!token || token === '__replace_me__') {
      throw new Error(
        'MONOBANK_TOKEN не задано — оплата готовими принтами вимкнена. ' +
        'Токен: https://web.monobank.ua/ (бойовий) або https://api.monobank.ua/ (тестовий).',
      );
    }
    return token;
  }

  async createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
    const res = await fetch(`${MONOBANK_API}/api/merchant/invoice/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Token': this.token() },
      body: JSON.stringify({
        amount: input.amountMinor,
        ccy: 980,
        merchantPaymInfo: { reference: input.reference, destination: input.destination },
        redirectUrl: input.redirectUrl,
        webHookUrl: input.webHookUrl,
        validity: input.validitySeconds ?? 3600,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Monobank invoice/create HTTP ${res.status}: ${body.slice(0, 300)}`);
      throw new BadGatewayException({
        code: ErrorCode.PAYMENT_PROVIDER_ERROR,
        message: 'Не вдалося створити рахунок на оплату. Спробуйте ще раз або напишіть нам.',
      });
    }

    return (await res.json()) as CreateInvoiceResult;
  }

  /**
   * Fetched once, cached for the process lifetime. Monobank's docs say
   * explicitly not to re-fetch on every webhook — only when verification with
   * the cached key starts failing (key rotation), handled in
   * `verifyWebhook` below.
   */
  private async fetchPublicKey(): Promise<KeyObject> {
    const res = await fetch(`${MONOBANK_API}/api/merchant/pubkey`, {
      headers: { 'X-Token': this.token() },
    });
    if (!res.ok) throw new Error(`Monobank pubkey HTTP ${res.status}`);

    const { key } = (await res.json()) as { key: string };
    return parseMonobankPublicKey(key);
  }

  /** Verifies `X-Sign` against the raw webhook body. Never trust an unverified webhook. */
  async verifyWebhook(rawBody: Buffer, signatureBase64: string): Promise<boolean> {
    try {
      this.cachedPublicKey ??= await this.fetchPublicKey();
      if (verifyMonobankSignature(rawBody, signatureBase64, this.cachedPublicKey)) return true;

      // Might be a rotated key rather than a forged webhook — refetch once
      // before concluding the signature is invalid.
      this.cachedPublicKey = await this.fetchPublicKey();
      return verifyMonobankSignature(rawBody, signatureBase64, this.cachedPublicKey);
    } catch (error) {
      this.logger.error(
        `Не вдалося перевірити підпис вебхука: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
