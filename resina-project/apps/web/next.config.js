/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true,
  },
  images: {
    domains: ["openweathermap.org"],
  },
};

export default nextConfig;
