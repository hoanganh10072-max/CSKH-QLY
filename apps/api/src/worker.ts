import { httpServerHandler } from "cloudflare:node";

// Cloudflare Workers exposes parts of process.versions for Node compatibility.
// iconv-lite treats that as a full Node process and loads its stream extension,
// which fails during Worker validation. Disable only this detection before
// loading Express/body-parser.
delete (process.versions as Record<string, string | undefined>).node;

const { app } = await import("./app.js");
const server = app.listen(4000);
const handler = httpServerHandler(server) as {
  fetch: (request: Request, env: unknown, context: unknown) => Promise<Response>;
};

const stripApiPrefix = (request: Request) => {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api")) return request;

  url.pathname = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  return new Request(url, request);
};

export default {
  fetch(request: Request, env: unknown, context: unknown) {
    return handler.fetch(stripApiPrefix(request), env, context);
  }
};
