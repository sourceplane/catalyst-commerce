#!/usr/bin/env node
// A stand-in BigCommerce Storefront API, for testing a CONNECTED storefront
// offline.
//
//   node fake-bigcommerce.mjs --schema <bigcommerce.graphql> --graphql <package dir> --port <n>
//
// It executes every query and mutation the storefront sends against
// BigCommerce's published Storefront schema (the one the storefront's types
// are generated from), with one default resolver that answers by the field's
// TYPE and NAME — so it needs no list of the storefront's queries and cannot
// drift from them. The answers are deterministic and consistent: lists hold
// three items; URL-shaped fields are real URLs on this server (an image's
// `urlTemplate` keeps BigCommerce's `{:size}`); a route's node is a Product,
// a Category or a Brand by its path (`/sample-category-2/` is a category);
// the store is LAUNCHED; nothing redirects; nobody is signed in.
//
// Control (for the e2e's cache assertions):
//   GET  /__calls   → {"<operationName>": <reads>, …} since the last reset
//   POST /__reset   → zero the counts
//   POST /__bump    → every product name says the next version ("v2", …), so
//                     a page that still says "v1" was served from a cache
//   GET  /media/*   → a tiny SVG, for every image URL it hands out
//   GET  /xmlsitemap.php → the store's sitemap index
//
// The storefront reaches it through BIGCOMMERCE_GRAPHQL_API_ORIGIN
// (packages/client), which a deploy never sets. `graphql` is resolved from
// --graphql (the storefront's package, apps/web): testing/ ships no
// dependencies of its own.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const schemaPath = arg("schema");
const graphqlDir = arg("graphql");
const port = Number(arg("port") ?? 4010);
if (!schemaPath || !graphqlDir) {
  console.error("usage: fake-bigcommerce.mjs --schema <bigcommerce.graphql> --graphql <package dir> --port <n>");
  process.exit(2);
}
const require = createRequire(join(resolve(graphqlDir), "noop.js"));
const {
  buildSchema,
  getNamedType,
  getNullableType,
  graphql,
  isAbstractType,
  isEnumType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
} = require("graphql");

const schema = buildSchema(readFileSync(schemaPath, "utf8"));
const origin = `http://127.0.0.1:${port}`;
let version = 1;
const calls = {};

const EDITOR_JS = JSON.stringify({
  time: 1,
  blocks: [{ id: "b1", type: "paragraph", data: { text: "A sample description from the stand-in store." } }],
  version: "2.30.0",
});
const SCALARS = {
  String: () => "Sample",
  ID: () => "U2FtcGxlOjE=",
  Int: () => 3,
  Float: () => 19.99,
  Boolean: () => false,
  JSONString: () => "{}",
  JSON: () => ({}),
  GenericScalar: () => ({}),
  DateTime: () => "2026-10-01T00:00:00+00:00",
  BigDecimal: () => 19.99,
  Long: () => 3,
  URL: () => "https://store.example.invalid/",
  IpAddress: () => "127.0.0.1",
  Date: () => "2026-10-01",
  Day: () => 1,
  Hour: () => 1,
  Minute: () => 1,
  Decimal: () => 19.99,
  PositiveDecimal: () => 19.99,
  PositiveInt: () => 3,
  UUID: () => "00000000-0000-4000-8000-000000000001",
  Upload: () => null,
  WeightScalar: () => 1,
  Metadata: () => ({}),
  _Any: () => null,
};
// Booleans that gate what a shopper sees: a product that is on sale, visible
// and in stock.
const TRUE = new Set(["isAvailable", "isActive", "isPublished", "isAvailableForPurchase", "isVisible", "isVisibleInListings"]);
// Null where "absent" is the honest answer: no translation (base names win),
// nobody signed in, no checkout or order the stand-in never created.
const NULL = new Set([
  "translation", "me", "user", "checkout", "order", "orderByToken", "parent", "discount", "undiscountedPrice",
  // No SEO overrides: the storefront then titles a page by the entity's name.
  "seoTitle", "seoDescription",
  // BigCommerce: a route is never a redirect here.
  "redirect",
]);
// Errors lists on mutation payloads: always empty.
const EMPTY = new Set(["errors", "checkoutErrors", "accountErrors"]);

// The entity a value belongs to, carried down the tree: `{slug, index}`.
function scoped(parent, extra) {
  return { __scope: { ...(parent?.__scope ?? {}), ...extra } };
}

function value(type, parent, info, index) {
  const nullable = getNullableType(type);
  if (isListType(nullable)) {
    return [0, 1, 2].map((i) => value(nullable.ofType, parent, info, i));
  }
  const named = getNamedType(type);
  if (isScalarType(named)) return SCALARS[named.name]?.() ?? null;
  if (isEnumType(named)) {
    if (named.name === "StorefrontStatusType") return "LAUNCHED";
    return named.getValues()[0].value;
  }
  // An object (or interface/union): the fields resolve below; carry the
  // list index so each item in a list is a different entity.
  return { ...scoped(parent, index === undefined ? {} : { index: index + 1 }) };
}

function fieldResolver(source, args, _ctx, info) {
  const name = info.fieldName;
  const parentType = info.parentType.name;
  const scope = source?.__scope ?? {};
  const n = scope.index ?? 1;
  if (source && Object.prototype.hasOwnProperty.call(source, name)) return source[name];
  if (NULL.has(name) && !isNonNullType(info.returnType)) return null;
  if (EMPTY.has(name) && isListType(getNullableType(info.returnType))) return [];
  // A BigCommerce route read by path: the node's type follows the path.
  if (name === "route" && args?.path !== undefined) {
    return scoped(source, { path: args.path, index: Number(/-(\d+)\/?$/.exec(args.path)?.[1] ?? 1) });
  }
  if (name === "node" && parentType === "Route") {
    const path = scope.path ?? "";
    if (path === "/" || path === "") return null;
    return { ...scoped(source, {}), __bcType: /categor/.test(path) ? "Category" : /brand/.test(path) ? "Brand" : "Product" };
  }
  // An entity read by its slug names that slug from then on.
  if (args?.slug && isObjectType(getNamedType(info.returnType))) {
    return scoped(source, { slug: args.slug, index: Number(/-(\d+)$/.exec(args.slug)?.[1] ?? 1) });
  }
  const named = getNamedType(info.returnType);
  if (isScalarType(named) && named.name === "String") {
    // BigCommerce's URL-shaped fields: real URLs, so the storefront can parse them.
    if (name === "urlTemplate") return `${origin}/media/{:size}/${parentType.toLowerCase()}-${n}.svg`;
    if (name === "cdnUrl") return origin;
    if (/(^url$|Url$|^urlOriginal$|^href$|^link$)/.test(name)) return origin + "/";
    if (name === "path") return `/sample-${parentType.toLowerCase()}-${n}/`;
    if (name === "locale" || name === "code" && parentType.includes("Locale")) return "en";
  }
  if (isScalarType(named) && name === "entityId") return n;
  if (isScalarType(named)) {
    switch (name) {
      case "slug":
        if (parentType === "Channel") return "default-channel";
        return scope.slug ?? `sample-${parentType.toLowerCase()}-${n}`;
      case "name":
        if (parentType === "Product") return `Sample product ${n} v${version}`;
        if (parentType === "Channel") return "Default channel";
        return `Sample ${parentType} ${n}`;
      case "url":
      case "thumbnail":
        return `${origin}/media/${parentType.toLowerCase()}-${n}.svg`;
      case "email":
        return "shopper@example.invalid";
      case "currency":
      case "currencyCode":
        return "USD";
      case "description":
      case "content":
      case "richText":
        return named.name === "JSONString" ? EDITOR_JS : `A sample ${parentType}.`;
      case "id":
        return Buffer.from(`${parentType}:${scope.slug ?? n}`).toString("base64");
      case "totalCount":
        return 3;
      case "hasNextPage":
      case "hasPreviousPage":
        return false;
      default:
        if (TRUE.has(name)) return true;
    }
  }
  return value(info.returnType, source, info, undefined);
}

function typeResolver(_value, _ctx, info, abstractType) {
  if (_value?.__bcType) return _value.__bcType;
  if (isAbstractType(abstractType)) {
    const names = schema.getPossibleTypes(abstractType).map((t) => t.name);
    return names.includes("Product") ? "Product" : names[0];
  }
  return undefined;
}

const server = createServer(async (req, res) => {
  const send = (code, body, type = "application/json") => {
    res.writeHead(code, { "content-type": type });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  };
  if (req.url === "/__calls") return send(200, calls);
  if (req.url === "/__reset" && req.method === "POST") {
    for (const k of Object.keys(calls)) delete calls[k];
    return send(200, {});
  }
  if (req.url === "/__bump" && req.method === "POST") {
    version += 1;
    return send(200, { version });
  }
  if (req.url?.startsWith("/xmlsitemap.php")) {
    res.writeHead(200, { "content-type": "application/xml" });
    return res.end(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${origin}/xmlsitemap.php?type=products&amp;page=1</loc></sitemap></sitemapindex>`);
  }
  if (req.url?.startsWith("/media/")) {
    return send(200, '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>', "image/svg+xml");
  }
  if (req.method !== "POST") return send(404, { errors: [{ message: "not found" }] });
  let raw = "";
  for await (const chunk of req) raw += chunk;
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return send(400, { errors: [{ message: "the body is not JSON" }] });
  }
  const op = body.operationName || /(?:query|mutation)\s+(\w+)/.exec(body.query ?? "")?.[1] || "anonymous";
  calls[op] = (calls[op] ?? 0) + 1;
  const result = await graphql({
    schema,
    source: body.query,
    variableValues: body.variables,
    operationName: body.operationName,
    fieldResolver,
    typeResolver,
  });
  send(200, result);
});
server.listen(port, "127.0.0.1", () => console.log(`fake-bigcommerce: ${origin}/graphql`));
