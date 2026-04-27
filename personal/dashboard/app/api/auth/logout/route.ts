import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const cookie = clearSessionCookie();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  const res = NextResponse.redirect(url, { status: 303 });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
