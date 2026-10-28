/* eslint-disable check-file/folder-naming-convention */
/*
 * Proxy to the existing BigCommerce sitemap index on the canonical URL
 */

import { getChannelIdFromLocale } from '~/channels.config';
import { client } from '~/client';
import { bigcommerceConnected } from '~/lib/bigcommerce-connection';

export const GET = async () => {
  if (!bigcommerceConnected()) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>',
      { headers: { 'Content-Type': 'application/xml' } },
    );
  }

  // Outside the proxy, so there is no request locale: a bare call resolves the default channel.
  const sitemapIndex = await client.fetchSitemapIndex(getChannelIdFromLocale());

  return new Response(sitemapIndex, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
};
