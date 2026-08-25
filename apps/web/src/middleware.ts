import { NextResponse, type NextRequest } from "next/server";

const productionHosts = new Set(["trungtamgiasuskv.cloud", "www.trungtamgiasuskv.cloud"]);

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (productionHosts.has(host) && forwardedProto === "http") {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*"
};
