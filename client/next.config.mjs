/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://ai-interview-prep-kit-wktx.onrender.com/api/:path*'
      }
    ];
  }
};

export default nextConfig;
