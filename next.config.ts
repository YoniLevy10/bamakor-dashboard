import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Sentry organization and project (set via env or Sentry wizard)
  silent: true, // suppress build output noise

  // Upload source maps only in CI / production builds
  widenClientFileUpload: true,

  // Avoids shipping Sentry debug code to the browser
  hideSourceMaps: true,

  // Tree-shake Sentry logger statements
  disableLogger: true,
});
