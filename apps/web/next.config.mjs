/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `standalone` empacota apenas o runtime necessário e segue obrigatório no
  // Docker/CI (Linux). No Windows local, o Next precisa criar symlinks que o
  // sistema pode negar mesmo fora do sandbox; o build continua completo sem
  // alterar o artefato produzido em Linux.
  output: process.platform === 'win32' ? undefined : 'standalone',
  transpilePackages: ['@total-campanha/shared'],
};

export default nextConfig;
