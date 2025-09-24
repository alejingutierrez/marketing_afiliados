/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  eslint: {
    dirs: ['src']
  },
  i18n: {
    locales: ['es', 'en'],
    defaultLocale: 'es'
  },
  transpilePackages: ['@marketing-afiliados/ui', '@marketing-afiliados/domain']
};

export default nextConfig;
