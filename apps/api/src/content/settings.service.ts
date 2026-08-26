import { Logger, Injectable, NotFoundException } from '@nestjs/common';
import {
  ErrorCode, type MenuItemCreateDto, type MenuItemDto, type MenuItemUpdateDto,
  type SiteChromeDto, type SiteSettingsDto, type SiteSettingsUpdateDto,
  tokenValues,
} from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { requireSiteId } from '../common/site-context';
import { RevalidateService } from './revalidate.service';

const SETTINGS_SELECT = {
  brand: true, legalEntityName: true, legalEntityShort: true, taxNumber: true,
  phone: true, phoneDisplay: true, telegram: true, telegramUrl: true, email: true,
  city: true, cityIn: true, workingHours: true,
  freeShippingFromMinor: true, returnDays: true,
  defaultOgImage: true, googleSiteVerification: true, allowIndexing: true,
  ga4MeasurementId: true, googleAdsId: true,
} as const;

/**
 * Налаштування сайту й меню.
 *
 * Окремий сервіс, бо цим користуються троє: публічна оболонка сайту, адмінка
 * і підстановка `{{токенів}}` у текстах сторінок. Останнє — головне: саме
 * тому реквізити мусять бути одним записом, а не константою в коді вебу й
 * копією в тексті офери.
 */
@Injectable()
export class SettingsService {
  private readonly log = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidate: RevalidateService,
  ) {}

  /**
   * Зміна налаштувань скидає весь кеш сайту, а не окремі сторінки.
   *
   * Телефон стоїть у футері кожної сторінки й у текстах половини з них.
   * Перелічити, «які саме сторінки залежать від телефону», неможливо — а
   * спроба це зробити закінчується сторінкою, яку забули, і старим номером,
   * що висить на ній місяцями.
   */
  private async refreshWholeSite(): Promise<void> {
    const error = await this.revalidate.revalidate(['*']);
    if (error !== '') {
      // Результат раніше просто викидався — і це коштувало довгої розмови
      // «змінив назву бренду, в адмінці збереглося, на сайті стара».
      // Збереження справді відбулося, кеш справді не скинувся, і ніде
      // жодного сліду: сторінки пишуть свою помилку в `Page.revalidateError`,
      // а налаштування не мали куди.
      //
      // Публікацію це не зриває (дані вже в базі, кеш протухне сам), але в
      // журналі тепер видно причину — зазвичай це незадані WEB_URL або
      // REVALIDATE_SECRET на боці API.
      this.log.warn(`Налаштування збережено, але кеш сайту не скинуто: ${error}`);
    }
  }

  /**
   * Налаштування сайту.
   *
   * Рядок мусить бути: його створює міграція разом із сайтом. Якщо його
   * немає — це не «ще не налаштували», а зламаний стан, і мовчки підставляти
   * порожні реквізити означало б надрукувати порожню оферту.
   */
  async settings(): Promise<SiteSettingsDto> {
    const row = await this.prisma.db.siteSettings.findFirst({ select: SETTINGS_SELECT });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Налаштування сайту не знайдено — перевірте, чи накотилася міграція.',
      });
    }
    return row;
  }

  /** Значення для `{{підстановок}}` у текстах блоків. */
  async tokens(): Promise<Readonly<Record<string, string>>> {
    return tokenValues(await this.settings());
  }

  async chrome(): Promise<SiteChromeDto> {
    const [settings, menu] = await Promise.all([
      this.settings(),
      this.menu(true),
    ]);
    return { settings, menu };
  }

  /** `onlyActive` — для сайту; адмінка бачить і вимкнені пункти. */
  async menu(onlyActive: boolean): Promise<MenuItemDto[]> {
    return this.prisma.db.menuItem.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: [{ area: 'asc' }, { group: 'asc' }, { position: 'asc' }],
      select: {
        id: true, area: true, group: true, label: true,
        href: true, position: true, isActive: true,
      },
    });
  }

  // ── адмінка ────────────────────────────────────────────────────────────────

  async update(dto: SiteSettingsUpdateDto): Promise<SiteChromeDto> {
    const siteId = requireSiteId('налаштувань', 'збереження');
    await this.prisma.db.siteSettings.update({ where: { siteId }, data: dto });
    await this.refreshWholeSite();
    return this.adminChrome();
  }

  async adminChrome(): Promise<SiteChromeDto> {
    const [settings, menu] = await Promise.all([this.settings(), this.menu(false)]);
    return { settings, menu };
  }

  async createMenuItem(dto: MenuItemCreateDto): Promise<SiteChromeDto> {
    await this.prisma.db.menuItem.create({ data: { ...dto, siteId: requireSiteId() } });
    await this.refreshWholeSite();
    return this.adminChrome();
  }

  async updateMenuItem(id: string, dto: MenuItemUpdateDto): Promise<SiteChromeDto> {
    const exists = await this.prisma.db.menuItem.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Пункт меню не знайдено' });
    await this.prisma.db.menuItem.update({ where: { id }, data: dto });
    await this.refreshWholeSite();
    return this.adminChrome();
  }

  async deleteMenuItem(id: string): Promise<SiteChromeDto> {
    await this.prisma.db.menuItem.deleteMany({ where: { id } });
    await this.refreshWholeSite();
    return this.adminChrome();
  }
}
