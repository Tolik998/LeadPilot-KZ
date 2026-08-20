import type { NextConfig } from "next";

const deploymentId =
  process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA;

const nextConfig: NextConfig = {
  ...(deploymentId ? { deploymentId } : {}),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
