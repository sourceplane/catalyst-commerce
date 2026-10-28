import type { Metadata } from 'next';

import { SITE_NAME } from '~/lib/site';

export const dynamic = 'force-static';

export const metadata: Metadata = { title: SITE_NAME };

// What `/` shows until a BigCommerce store is connected (proxy.ts rewrites to
// it; every other page redirects to `/`). It reads nothing from BigCommerce.
export default function ConnectStorePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-3xl font-semibold">Connect your BigCommerce store</h1>
      <p className="mt-4">
        This storefront is deployed and ready. It shows your catalogue once a BigCommerce store is
        connected: set <code>BIGCOMMERCE_STORE_HASH</code> and{' '}
        <code>BIGCOMMERCE_STOREFRONT_TOKEN</code> (and <code>BIGCOMMERCE_CHANNEL_ID</code> if the
        storefront sells in a channel other than 1) as Orun secrets, then redeploy.
      </p>
    </main>
  );
}
