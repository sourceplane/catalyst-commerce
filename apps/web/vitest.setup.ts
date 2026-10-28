// URLPattern is a global in Node 24 and in workerd (where the storefront
// runs), not in the Node 22 this workspace's lanes run tests on; the proxies
// build their matchers from it at import. The polyfill fills it in only where
// it is missing, so the specs run the same code they would on Node 24.
if (!('URLPattern' in globalThis)) {
  await import('urlpattern-polyfill');
}

export {};
