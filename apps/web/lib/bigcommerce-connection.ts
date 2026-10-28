// Whether a BigCommerce store is connected: its store hash and storefront
// token are set (Orun secrets, read at build and at run time). Without them the
// storefront deploys anyway: `/` says how to connect a store, every other page
// redirects to `/`, and nothing asks BigCommerce for anything.
export function bigcommerceConnected(): boolean {
  return Boolean(process.env.BIGCOMMERCE_STORE_HASH && process.env.BIGCOMMERCE_STOREFRONT_TOKEN);
}
