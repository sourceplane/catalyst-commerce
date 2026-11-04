import bundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { writeBuildConfig } from './build-config/writer';
import { client } from './client';
import { graphql } from './client/graphql';
import { bigcommerceConnected } from './lib/bigcommerce-connection';
import { cspHeader } from './lib/content-security-policy';

const withNextIntl = createNextIntlPlugin({
  experimental: {
    createMessagesDeclaration: './messages/en.json',
  },
});

const SettingsQuery = graphql(`
  query SettingsQuery {
    site {
      settings {
        url {
          vanityUrl
          cdnUrl
          checkoutUrl
        }
      }
    }
  }
`);

async function writeSettingsToBuildConfig() {
  if (!bigcommerceConnected()) {
    return await writeBuildConfig({
      urls: {
        vanityUrl: '',
        checkoutUrl: '',
        cdnUrls: [process.env.NEXT_PUBLIC_BIGCOMMERCE_CDN_HOSTNAME || 'cdn11.bigcommerce.com'],
      },
    });
  }

  const { data } = await client.fetch({ document: SettingsQuery });

  const cdnEnvHostnames = process.env.NEXT_PUBLIC_BIGCOMMERCE_CDN_HOSTNAME;

  const cdnUrls = (
    cdnEnvHostnames
      ? cdnEnvHostnames.split(',').map((s) => s.trim())
      : [data.site.settings?.url.cdnUrl]
  ).filter((url): url is string => !!url);

  if (!cdnUrls.length) {
    throw new Error(
      'No CDN URLs found. Please ensure that NEXT_PUBLIC_BIGCOMMERCE_CDN_HOSTNAME is set correctly.',
    );
  }

  return await writeBuildConfig({
    urls: {
      ...data.site.settings?.url,
      cdnUrls,
    },
  });
}

export default async (): Promise<NextConfig> => {
  const settings = await writeSettingsToBuildConfig();

  let nextConfig: NextConfig = {
    reactStrictMode: true,
    output: 'standalone',
    // The workspace root: the standalone output OpenNext bundles from.
    outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
    outputFileTracingIncludes: {
      '*': [
        '../../node_modules/.pnpm/@opentelemetry+api@*/node_modules/@opentelemetry/api/build/**',
      ],
    },
    // Dev server only (`next build` ignores it): orun.work's live Preview tab
    // loads `next dev` from the preview's own host, and Next.js refuses the
    // hot reload and other /_next/* dev requests from an origin it is not told
    // about. These are the preview's hosts, prod's and stage's.
    allowedDevOrigins: ['*.orun-preview.app', 'preview-gateway-stage.oruncloud.workers.dev'],
    experimental: {
      optimizePackageImports: ['@icons-pack/react-simple-icons'],
      // Dev server only: behind orun.work's live Preview the browser's Origin
      // is the preview's host while `next dev` sees a local Host, and Next.js
      // refuses a Server Action from an origin it is not told about. `next
      // build` runs with NODE_ENV=production, so production keeps its
      // same-origin check.
      ...(process.env.NODE_ENV === 'development'
        ? {
            serverActions: {
              allowedOrigins: ['*.orun-preview.app', 'preview-gateway-stage.oruncloud.workers.dev'],
            },
          }
        : {}),
    },
    images: {
      // Allow product-video poster thumbnails (YouTube) through next/image.
      remotePatterns: [{ protocol: 'https', hostname: 'i.ytimg.com', pathname: '/vi/**' }],
    },
    typescript: {
      ignoreBuildErrors: !!process.env.CI,
    },
    // default URL generation in BigCommerce uses trailing slash
    trailingSlash: process.env.TRAILING_SLASH !== 'false',
    // eslint-disable-next-line @typescript-eslint/require-await
    async headers() {
      const cdnLinks = settings.urls.cdnUrls.map((url) => ({
        key: 'Link',
        value: `<https://${url}>; rel=preconnect`,
      }));

      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'Content-Security-Policy',
              value: cspHeader.replace(/\n/g, ''),
            },
            ...cdnLinks,
          ],
        },
      ];
    },
  };

  // Apply withNextIntl to the config
  nextConfig = withNextIntl(nextConfig);

  if (process.env.ANALYZE === 'true') {
    const withBundleAnalyzer = bundleAnalyzer();

    nextConfig = withBundleAnalyzer(nextConfig);
  }

  return nextConfig;
};
