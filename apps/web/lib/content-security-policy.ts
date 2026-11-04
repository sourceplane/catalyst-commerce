import builder from 'content-security-policy-builder';

const makeswiftEnabled = !!process.env.MAKESWIFT_SITE_API_KEY;

const makeswiftBaseUrl = process.env.MAKESWIFT_BASE_URL || 'https://app.makeswift.com';

const frameAncestors = makeswiftEnabled ? makeswiftBaseUrl : 'none';

// Dev server only: `next dev` sends no frame-ancestors, because orun.work's
// live Preview tab shows the dev server in a frame and its gateway can only
// add to a page's frame-ancestors, never loosen them. `next build` runs with
// NODE_ENV=production, so the deployed storefront keeps the directive.
const framing = process.env.NODE_ENV === 'development' ? {} : { frameAncestors: [frameAncestors] };

// customize the directives as needed
export const cspHeader = builder({
  directives: {
    baseUri: ['self'],
    ...framing,
    // formAction: ['self'],
    // defaultSrc: ['self'],
    // scriptSrc: ['self'],
    // styleSrc: ['self'],
    // imgSrc: ['self'],
    // connectSrc: ['self'],
    // fontSrc: ['self'],
    // objectSrc: ['none'],
    // mediaSrc: ['self'],
    // frameSrc: ['self'],
    // childSrc: ['self'],
    // manifestSrc: ['self'],
    // workerSrc: ['self'],
    // prefetchSrc: ['self'],
    // navigateTo: ['self'],
    // reportUri: ['none'],
  },
});
