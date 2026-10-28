import { bigcommerceConnected } from '~/lib/bigcommerce-connection';

export const dynamic = 'force-dynamic';

// The deploy's smoke test and the deployment record's probe: the Worker
// itself answers (no static file can), and says whether a BigCommerce store
// is connected. It calls nothing, so it answers while the store is down.
export function GET() {
  return Response.json({
    ok: true,
    bigcommerce: bigcommerceConnected() ? 'connected' : 'not-connected',
  });
}
