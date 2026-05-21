/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 'standalone' empacota só o runtime necessário — usado pelo Dockerfile.
  output: 'standalone',
  transpilePackages: ['@total-campanha/shared'],
};

export default nextConfig;
