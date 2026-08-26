import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PaymentsAdminService } from './payments-admin.service';

interface FakePayment {
  invoiceId: string;
  status: string;
  paymentType: string;
  amountMinor: number;
  createdAt: Date;
  holdExpiresAt: Date | null;
  finalizedAt: Date | null;
}

/**
 * Заглушка бази.
 *
 * Моделі під `db`, як у справжньому `PrismaService`: сирий клієнт там
 * приватний. Заглушка повторює цю форму навмисно — інакше тест проходив би
 * на структурі, якої в проді немає.
 */
function fakePrisma(payment: FakePayment | null) {
  const state = payment ? { ...payment } : null;
  const model = {
    findUnique: vi.fn(async () => state),
    update: vi.fn(async ({ data }: { data: Partial<FakePayment> }) => {
      Object.assign(state as FakePayment, data);
      return state;
    }),
  };
  return { db: { payment: model }, payment: model };
}

function fakeMonobank() {
  return {
    finalizeInvoice: vi.fn(async () => undefined),
    cancelInvoice: vi.fn(async () => undefined),
  };
}

function holdPayment(overrides: Partial<FakePayment> = {}): FakePayment {
  return {
    invoiceId: 'inv-1', status: 'HOLD', paymentType: 'HOLD', amountMinor: 10000,
    createdAt: new Date(), holdExpiresAt: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
    finalizedAt: null,
    ...overrides,
  };
}

describe('PaymentsAdminService.finalize', () => {
  it('captures a fresh HOLD invoice', async () => {
    const prisma = fakePrisma(holdPayment());
    const monobank = fakeMonobank();
    const service = new PaymentsAdminService(prisma as never, monobank as never);

    const result = await service.finalize('inv-1');

    expect(monobank.finalizeInvoice).toHaveBeenCalledWith('inv-1', undefined);
    expect(result.finalizedAt).not.toBeNull();
  });

  it('passes through a partial finalize amount', async () => {
    const prisma = fakePrisma(holdPayment());
    const monobank = fakeMonobank();
    const service = new PaymentsAdminService(prisma as never, monobank as never);

    await service.finalize('inv-1', 5000);

    expect(monobank.finalizeInvoice).toHaveBeenCalledWith('inv-1', 5000);
  });

  it('rejects an unknown invoiceId', async () => {
    const prisma = fakePrisma(null);
    const service = new PaymentsAdminService(prisma as never, fakeMonobank() as never);

    await expect(service.finalize('missing')).rejects.toThrow(NotFoundException);
  });

  it('rejects a DEBIT payment — nothing to finalize', async () => {
    const prisma = fakePrisma(holdPayment({ paymentType: 'DEBIT' }));
    const service = new PaymentsAdminService(prisma as never, fakeMonobank() as never);

    await expect(service.finalize('inv-1')).rejects.toThrow(BadRequestException);
  });

  it('rejects a HOLD payment that already finalized/settled', async () => {
    const prisma = fakePrisma(holdPayment({ status: 'SUCCESS' }));
    const service = new PaymentsAdminService(prisma as never, fakeMonobank() as never);

    await expect(service.finalize('inv-1')).rejects.toThrow(BadRequestException);
  });

  it('rejects finalizing a hold that is 8+ days old', async () => {
    const prisma = fakePrisma(holdPayment({ createdAt: new Date(Date.now() - 8.5 * 24 * 60 * 60 * 1000) }));
    const service = new PaymentsAdminService(prisma as never, fakeMonobank() as never);

    await expect(service.finalize('inv-1')).rejects.toThrow(/8\+ днів/);
  });

  it('rejects finalizing above the held amount', async () => {
    const prisma = fakePrisma(holdPayment({ amountMinor: 5000 }));
    const service = new PaymentsAdminService(prisma as never, fakeMonobank() as never);

    await expect(service.finalize('inv-1', 5001)).rejects.toThrow(BadRequestException);
  });
});

describe('PaymentsAdminService.cancel', () => {
  it('refunds an already-captured invoice', async () => {
    const prisma = fakePrisma(holdPayment({ status: 'SUCCESS' }));
    const monobank = fakeMonobank();
    const service = new PaymentsAdminService(prisma as never, monobank as never);

    await service.cancel('inv-1');

    expect(monobank.cancelInvoice).toHaveBeenCalledWith('inv-1', undefined);
  });

  it('rejects cancelling a HOLD — not paid yet, use finalize or let it expire', async () => {
    const prisma = fakePrisma(holdPayment({ status: 'HOLD' }));
    const service = new PaymentsAdminService(prisma as never, fakeMonobank() as never);

    await expect(service.cancel('inv-1')).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown invoiceId', async () => {
    const prisma = fakePrisma(null);
    const service = new PaymentsAdminService(prisma as never, fakeMonobank() as never);

    await expect(service.cancel('missing')).rejects.toThrow(NotFoundException);
  });
});
