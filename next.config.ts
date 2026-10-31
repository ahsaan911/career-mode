import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/career-mode",
  assetPrefix: "/career-mode/",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;