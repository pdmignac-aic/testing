/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "webcams.nyctmc.org" },
    ],
  },
};

module.exports = nextConfig;
