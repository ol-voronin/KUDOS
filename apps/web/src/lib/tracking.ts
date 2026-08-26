import { cache } from 'react';
import { TrackingConfigDto } from '@dt/contracts';
import { serverFetchOrNull } from './server-api';

/**
 * Ідентифікатори тегів — з бази, на сервері.
 *
 * Запасний варіант тут порожній, і це правильний бік помилки: якщо API
 * мовчить, ми не знаємо, які теги налаштовані, і краще не завантажити
 * жодного, ніж завантажити чужий.
 */
export const getTracking = cache(async (): Promise<TrackingConfigDto> => {
  const data = await serverFetchOrNull('/analytics/config', TrackingConfigDto, 300);
  return data ?? { ga4MeasurementId: '', googleAdsId: '', conversions: [] };
});
