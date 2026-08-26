-- SEO на рівні сайту.
--
-- Три поля, і кожне закриває дірку, яку інакше довелося б закривати деплоєм:
-- превʼю в месенджерах, підтвердження власності в Search Console і головний
-- вимикач індексації.
--
-- `allowIndexing` за замовчуванням FALSE, і для наявного сайту теж. Це
-- навмисно: зараз він однаково `noindex`, бо живе на *.vercel.app, а момент
-- виходу в пошук має бути свідомою дією в адмінці — після того, як зʼявиться
-- домен і назва. Увімкнути індексацію сайту, у якого ще стара назва в
-- заголовках, коштує дорожче, ніж зайвий клік.

ALTER TABLE "SiteSettings" ADD COLUMN "defaultOgImage" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteSettings" ADD COLUMN "googleSiteVerification" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteSettings" ADD COLUMN "allowIndexing" BOOLEAN NOT NULL DEFAULT false;

-- Картинка або порожньо, або справжня адреса. Порожньо краще за чужу
-- картинку: превʼю без зображення виглядає скромно, а превʼю з чужим
-- зображенням виглядає як помилка.
ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_ogImage_shape" CHECK (
  "defaultOgImage" = '' OR "defaultOgImage" ~ '^(/|https?://)'
);
