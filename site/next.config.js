/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Pulse lives at /pulse; the bare address goes there.
  async redirects() {
    return [{ source: "/", destination: "/pulse", permanent: false }];
  },
  // content/speed-round.md is read as plain text (lib/pulse/speedTopics.ts).
  webpack(config) {
    config.module.rules.push({ test: /\.md$/, type: "asset/source" });
    return config;
  },
};

module.exports = nextConfig;
