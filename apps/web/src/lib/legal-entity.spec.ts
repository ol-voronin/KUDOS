import { describe, expect, it } from 'vitest';
import { site } from '@/config/site';
import { withLegalEntity } from './legal-entity';

const BASE = {
  brand: 'БАБАКА', legalEntityName: '', legalEntityShort: '', taxNumber: '', phone: '', phoneDisplay: '',
  telegram: '', telegramUrl: '', email: '', city: '', cityIn: '', workingHours: '',
  freeShippingFromMinor: 0, returnDays: 14, productionDaysMin: 1, productionDaysMax: 5, defaultOgImage: '',
  googleSiteVerification: '', ga4MeasurementId: '', googleAdsId: '', allowIndexing: true,
};

describe('withLegalEntity', () => {
  it('замінює назву ФОП, у якій стоїть бренд, реквізитами з коду', () => {
    const fixed = withLegalEntity({
      ...BASE,
      legalEntityName: 'Фізична особа-підприємець БАБАКА',
      legalEntityShort: 'ФОП БАБАКА',
    });
    expect(fixed.legalEntityName).toBe(site.legalEntityName);
    expect(fixed.legalEntityShort).toBe('ФОП Воронін О. П.');
  });

  it('не чіпає справжнє імʼя з адмінки', () => {
    const real = { ...BASE, legalEntityName: 'Фізична особа-підприємець Іваненко І. І.', legalEntityShort: 'ФОП Іваненко І. І.' };
    expect(withLegalEntity(real)).toBe(real);
  });
});
