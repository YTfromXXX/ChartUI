import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((request) => {
  if (request.auth) return NextResponse.next();

  const loginUrl = new URL("/", request.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/gallery/:path*", "/live/:path*", "/profile/:path*", "/matrix/:path*"],
};