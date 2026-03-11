import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@orderhub/types'],
};

export default nextConfig;
