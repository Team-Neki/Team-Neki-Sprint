import path from "node:path";
import type { NextConfig } from "next";

// This project sits under a parent dir that also has lockfiles, so pin the
// workspace/trace root to this app for a correct standalone bundle.
const projectRoot = path.resolve();

const nextConfig: NextConfig = {
  // Emit a minimal standalone server bundle for small container images.
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  // The OG route reads its subset fonts through process.cwd(), which the file
  // tracer cannot follow, so name them explicitly or the standalone bundle
  // ships without them and image generation throws ENOENT.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/fonts/**"],
  },
  turbopack: {
    root: projectRoot,
  },
  images: {
    // Google profile photos.
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
