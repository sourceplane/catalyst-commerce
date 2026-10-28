import { type NextRequest, NextResponse } from 'next/server';

import { bigcommerceConnected } from './lib/bigcommerce-connection';
import { composeProxies } from './proxies/compose-proxies';
import { withAnalyticsCookies } from './proxies/with-analytics-cookies';
import { withAuth } from './proxies/with-auth';
import { withChannelId } from './proxies/with-channel-id';
import { withGraphqlProxy } from './proxies/with-graphql-proxy';
import { withIntl } from './proxies/with-intl';
import { withRoutes } from './proxies/with-routes';
import { withUcpProxy } from './proxies/with-ucp-proxy';

const storefront = composeProxies(
  withUcpProxy,
  withAuth,
  withAnalyticsCookies,
  withIntl,
  withChannelId,
  withGraphqlProxy,
  withRoutes,
);

// No store connected: `/` is the connect page and every other page sends the
// visitor there; nothing below asks BigCommerce for anything.
export const proxy = (request: NextRequest, event: Parameters<typeof storefront>[1]) => {
  if (bigcommerceConnected()) return storefront(request, event);

  if (request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/connect-store', request.url));
  }

  return NextResponse.redirect(new URL('/', request.url), 307);
};

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _vercel (vercel internals, eg: web vitals)
     * - favicon.ico (favicon file)
     * - admin (admin panel)
     * - sitemap.xml (sitemap route)
     * - xmlsitemap.php (legacy sitemap route)
     * - robots.txt (robots route)
     */
    '/((?!api|admin|_next/static|_next/image|_vercel|favicon.ico|xmlsitemap.php|sitemap.xml|robots.txt).*)',
    /*
     * UCP endpoints, proxied to the store's canonical domain by `withUcpProxy`. Declared
     * separately so the `api` exclusion above keeps applying to every other API route.
     */
    '/api/ucp/:path*',
  ],
};
