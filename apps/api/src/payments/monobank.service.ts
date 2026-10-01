import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import type { KeyObject } from 'node:crypto';
import { ErrorCode } from '@dt/contracts';
import { parseMonobankPublicKey, verifyMonobankSignature } from './webhook-signature';

const MONOBANK_API = 'https://api.monobank.ua';

/**
 * A discount on a basket line or the whole order. Live-verified 2026-08-22:
 * `type`/`mode` must be UPPERCASE (`{type: "discount", mode: "percent"}`, as
 * shown in some copy-pasted "AI prompt" guides, is rejected outright —
 * `INVALID_MERCHANT_PAYM_INFO`). Only `type: "DISCOUNT"` is confirmed working
 * here; a surcharge type (docs suggest `"EXTRA"`) was tried and rejected too
 * (`invalid 'type'`) — the real value for that is unconfirmed, so it is not
 * exposed until it's been checked against Monobank support/updated docs.
 */
export interface MonobankDiscount {
  readonly type: 'DISCOUNT';
  readonly mode: 'PERCENT' | 'VALUE';
  readonly value: number;
}

/** One fiscal-receipt line. `tax` are Monobank/pRRO tax-group codes, e.g. `[0]` = no VAT, `[1]` = 20% VAT. */
export interface MonobankBasketItem {
  readonly name: string;
  readonly qty: number;
  /** Price for one unit, minor units (kopiykas). */
  readonly sum: number;
  /** `qty * sum`, after this item's own `discounts` (if any) — minor units. */
  readonly total: number;
  readonly code: string;
  readonly barcode?: string;
  readonly tax: readonly number[];
  readonly discounts?: readonly MonobankDiscount[];
}

export interface CreateInvoiceInput {
  readonly amountMinor: number;
  readonly reference: string;
  readonly destination: string;
  readonly redirectUrl: string;
  readonly webHookUrl: string;
  readonly validitySeconds?: number;
  /** Omitted = Monobank's own default ("debit", capture immediately). */
  readonly paymentType?: 'debit' | 'hold';
  /** Fiscal-receipt line items. Omitted = no receipt line detail (still creates a valid invoice). */
  readonly basketOrder?: readonly MonobankBasketItem[];
  /** Order-level discount/surcharge (e.g. -10% cart-wide, or +delivery). Per-item ones go on the basket item itself. */
  readonly discounts?: readonly MonobankDiscount[];
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

  /**
   * Чи задано токен — без винятку. Потрібно оформленню: без токена
   * замовлення просто лишається на ручний рахунок, а не падає.
   */
  isConfigured(): boolean {
    const token = process.env['MONOBANK_TOKEN'];
    return Boolean(token) && token !== '__replace_me__';
  }

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
    if (input.basketOrder) {
      const basketTotal = input.basketOrder.reduce((sum, item) => sum + item.total, 0);
      if (basketTotal !== input.amountMinor) {
        // Monobank's own rule (Сума всіх total ПОВИННА = amount інвойсу) — catch a mismatch here,
        // not as a rejected/malformed invoice on Monobank's side.
        throw new Error(
          `basketOrder total (${basketTotal}) != invoice amount (${input.amountMinor})`,
        );
      }
    }

    const res = await fetch(`${MONOBANK_API}/api/merchant/invoice/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Token': this.token() },
      body: JSON.stringify({
        amount: input.amountMinor,
        ccy: 980,
        merchantPaymInfo: {
          reference: input.reference,
          destination: input.destination,
          ...(input.basketOrder ? { basketOrder: input.basketOrder } : {}),
          ...(input.discounts ? { discounts: input.discounts } : {}),
        },
        redirectUrl: input.redirectUrl,
        webHookUrl: input.webHookUrl,
        validity: input.validitySeconds ?? 3600,
        ...(input.paymentType ? { paymentType: input.paymentType } : {}),
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
   * Captures a HOLD invoice — the money actually leaves the card only now.
   * `amountMinor` below the held amount is a partial finalize; omitted means
   * "the full held amount". Monobank confirms the outcome asynchronously via
   * the `success` webhook, same as a normal debit.
   */
  async finalizeInvoice(invoiceId: string, amountMinor?: number): Promise<void> {
    const res = await fetch(`${MONOBANK_API}/api/merchant/invoice/finalize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Token': this.token() },
      body: JSON.stringify({ invoiceId, ...(amountMinor ? { amount: amountMinor } : {}) }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Monobank invoice/finalize HTTP ${res.status}: ${body.slice(0, 300)}`);
      throw new BadGatewayException({
        code: ErrorCode.PAYMENT_PROVIDER_ERROR,
        message: 'Не вдалося списати заблоковані кошти. Спробуйте ще раз або напишіть нам.',
      });
    }
  }

  /**
   * Refunds an already-captured invoice. Only valid once `status` is
   * `success` — Monobank rejects this on a HOLD/pending invoice with
   * `errCode: "1004"` ("invoice not paid"). To invalidate an unpaid HOLD or
   * DEBIT invoice instead, use `/api/merchant/invoice/remove` (not needed for
   * HOLD: an un-finalized hold self-expires, see `holdExpiresAt`).
   */
  async cancelInvoice(invoiceId: string, amountMinor?: number): Promise<void> {
    const res = await fetch(`${MONOBANK_API}/api/merchant/invoice/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Token': this.token() },
      body: JSON.stringify({ invoiceId, ...(amountMinor ? { amount: amountMinor } : {}) }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Monobank invoice/cancel HTTP ${res.status}: ${body.slice(0, 300)}`);
      throw new BadGatewayException({
        code: ErrorCode.PAYMENT_PROVIDER_ERROR,
        message: 'Не вдалося скасувати оплату. Спробуйте ще раз або напишіть нам.',
      });
    }
  }

  /**
   * Fiscal-receipt info (pRRO) for a paid invoice — a link to the PDF among
   * other fields. Live-checked once (2026-08-22, unpaid test invoice):
   * confirmed 200 OK with `{ checks: [] }` — so the top-level shape is a
   * `checks` array. What each entry looks like once an invoice is actually
   * paid/fiscalised is NOT verified — this environment cannot fetch
   * monobank.ua/api-docs (client-rendered, redirects through an ad-tracking
   * pixel for this tool). Returned as-is (untyped); confirm the per-check
   * fields against a real paid invoice before building more than "hand the
   * customer whatever URL/field is in there" on top of this.
   */
  async getFiscalChecks(invoiceId: string): Promise<unknown> {
    const res = await fetch(
      `${MONOBANK_API}/api/merchant/invoice/fiscal-checks?invoiceId=${encodeURIComponent(invoiceId)}`,
      { headers: { 'X-Token': this.token() } },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Monobank invoice/fiscal-checks HTTP ${res.status}: ${body.slice(0, 300)}`);
      throw new BadGatewayException({
        code: ErrorCode.PAYMENT_PROVIDER_ERROR,
        message: 'Не вдалося отримати фіскальний чек. Спробуйте ще раз або напишіть нам.',
      });
    }

    return res.json();
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
