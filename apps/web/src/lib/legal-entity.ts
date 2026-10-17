import type { SiteSettingsDto } from '@dt/contracts';
import { site } from '@/config/site';

/**
 * Сторона договору не може називатися брендом.
 *
 * У налаштуваннях сайту поле «Повна назва» стоїть «Фізична особа-підприємець
 * БАБАКА», і воно потрапляло у футер, оферту й політику. ФОП — це людина,
 * назвою бренду він бути не може, а для покупця, якого просять ввести
 * картку, це сигнал «щось не так» (аудит 17.10, C-5). Поки поле в адмінці не
 * виправили, назву з брендом замінюємо реквізитами з коду (`config/site.ts`).
 * Щойно в адмінці стоятиме справжнє імʼя, ця заміна перестане спрацьовувати.
 */
export function withLegalEntity(settings: SiteSettingsDto): SiteSettingsDto {
  const brand = settings.brand.trim().toLowerCase();
  const isBrand = (name: string) => brand !== '' && name.toLowerCase().includes(brand);
  if (!isBrand(settings.legalEntityName) && !isBrand(settings.legalEntityShort)) return settings;
  return { ...settings, legalEntityName: site.legalEntityName, legalEntityShort: site.legalEntityShort };
}
