import { NextResponse, type NextRequest } from "next/server";
import { checkPassword, issueSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const from = String(form.get("from") ?? "/");

  const safeFrom = from.startsWith("/") && !from.startsWith("//") ? from : "/";

  if (!checkPassword(password)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "1");
    if (safeFrom !== "/") url.searchParams.set("from", safeFrom);
    return NextResponse.redirect(url, { status: 303 });
  }

  const cookie = await issueSessionCookie();
  const url = req.nextUrl.clone();
  url.pathname = safeFrom;
  url.searchParams.delete("error");
  url.searchParams.delete("from");
  const res = NextResponse.redirect(url, { status: 303 });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
