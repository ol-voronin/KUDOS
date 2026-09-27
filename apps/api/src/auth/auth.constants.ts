/** Lockout window after too many wrong passwords for one account. */
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 15 * 60_000;

/**
 * Скільки живе сесія адмінки.
 *
 * Раніше кука й токен жили `JWT_ACCESS_TTL` = 15 хвилин без жодного
 * продовження. Для адмінки це означало: заповнюєш форму принта, відволікся,
 * натиснув «Зберегти» — і тебе викинуло на вхід разом із незбереженою формою.
 * Скаржились саме на це («розлогінює кожні 5 хвилин»).
 *
 * Тепер сесія ковзна:
 *   • токен живе 12 годин без жодної дії (ADMIN_SESSION_TTL);
 *   • будь-який запит в адмінку, зроблений пізніше ніж за 10 хвилин після
 *     видачі токена, отримує свіжий — тож поки людина працює, сесія не
 *     закінчується;
 *   • але не довше 30 днів від входу з паролем — далі пароль ще раз.
 */
export const ADMIN_SESSION_TTL_S = Number(process.env['ADMIN_SESSION_TTL'] ?? 12 * 60 * 60);
export const ADMIN_SESSION_RENEW_AFTER_S = 10 * 60;
export const ADMIN_SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;
