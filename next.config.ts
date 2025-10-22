import type {NextConfig} from 'next';

// Load environment variables
if (typeof process !== 'undefined') {
  require('dotenv').config({ path: '.env' });
  require('dotenv').config({ path: '.env.local', override: true });
}

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    '3001-firebase-studio-1760663381478.cluster-hllxpfasbba62ri4b2ygaupuxu.cloudworkstations.dev',
    '*.cloudworkstations.dev',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
