import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * @xenova/transformers loads ONNX binaries and model files off disk at runtime.
   * Bundling it breaks those paths, so it has to stay a native Node require.
   */
  serverExternalPackages: ["@xenova/transformers"],

  /**
   * Next blocks cross-origin requests to dev-only assets (HMR, chunks) by default,
   * so hitting the dev server on anything other than localhost fails.
   * These are this machine's LAN/virtual adapter addresses — needed if you present
   * the demo from a phone or another laptop. Dev-only; ignored in production builds.
   */
  allowedDevOrigins: [
    "192.168.18.18", // Wi-Fi
    "192.168.247.1", // VMware VMnet1
    "192.168.159.1", // VMware VMnet8
    "172.29.208.1", // WSL vEthernet
  ],
};

export default nextConfig;
