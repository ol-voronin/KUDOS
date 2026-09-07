/**
 * Хост API. У проді — адреса Railway/Render; локально — той самий :4000.
 * Переписування нижче робить так, що браузер завжди звертається до домену
 * сайту, а не до чужого: інакше cookie сесії з `sameSite: 'lax'` не
 * надсилалась би, і адмінка мовчки не працювала б у проді.
 */
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@dt/contracts'],
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }];
  },
  async redirects() {
    return [
      /*
       * «Мистецтво бути шедевром» злито у Vintage (міграція
       * 20260907120000). Стара адреса вже могла розійтися посиланнями —
       * 301 веде їх на нову полицю, а не на 404.
       */
      { source: '/collections/mystetstvo', destination: '/collections/vintage', permanent: true },
    ];
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};
export default nextConfig;
