/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lunar-javascript'],
  ...(process.env.PAGES_STATIC_EXPORT === '1' && {
    output: 'export',
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
    trailingSlash: true,
    env: { NEXT_PUBLIC_PAGES_STATIC_EXPORT: '1' },
  }),
};

module.exports = nextConfig;
