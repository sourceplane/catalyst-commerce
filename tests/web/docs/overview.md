# web-tests

The port's vitest suite — the store-name seam, the BigCommerce connection and the storefront before a store is connected (the proxy's redirects, the store-free routes, /api/health), and the generated auth secret

The test suite for **web**. It deploys nothing: its lane installs, builds and runs the tests.

|              |                      |
| ------------ | -------------------- |
| Type         | `turbo-package`      |
| Source       | `tests/web`          |
| Package      | `@app/web-tests`     |
| Environments | `dev`: `quick-check` |

## Depends on

- (none)

## Depended on by

- (none)
