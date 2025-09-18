import type { NextConfig } from "next";
import os from "os";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack(config, { isServer }) {
    if (process.platform === "win32") {
      try {
        const projectRoot = process.cwd();
        process.env.USERPROFILE = process.env.USERPROFILE || projectRoot;
        process.env.HOME = process.env.HOME || process.env.USERPROFILE;
      } catch (e) {
        // ignore
      }
    }

    return config;
  },
};

export default nextConfig;
