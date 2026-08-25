import { NextRequest, NextResponse } from "next/server";

const API_ORIGIN = "https://api.trungtamgiasuskv.cloud";
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host"
]);

const buildTargetUrl = (request: NextRequest, path: string[]) => {
  const target = new URL(`${API_ORIGIN}/${path.join("/")}`);
  target.search = request.nextUrl.search;
  return target;
};

const copyRequestHeaders = (request: NextRequest) => {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerKey)) return;
    if (lowerKey.startsWith("x-middleware")) return;
    headers.set(key, value);
  });

  return headers;
};

const copyResponseHeaders = (response: Response) => {
  const headers = new Headers();

  response.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerKey)) return;
    if (lowerKey === "content-encoding") return;
    if (lowerKey === "content-length") return;
    if (lowerKey.startsWith("access-control-")) return;
    headers.set(key, value);
  });

  headers.set("Cache-Control", "no-store");
  return headers;
};

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const method = request.method.toUpperCase();
  const targetUrl = buildTargetUrl(request, path || []);
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  const response = await fetch(targetUrl, {
    method,
    headers: copyRequestHeaders(request),
    body,
    cache: "no-store"
  });

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: copyResponseHeaders(response)
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
