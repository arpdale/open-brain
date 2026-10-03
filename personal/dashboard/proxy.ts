import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const protect = auth.middleware({ loginUrl: "/login" });

export default function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/login") return NextResponse.next();
  return protect(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
