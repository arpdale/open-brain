"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isOwnerEmail, safeReturnPath } from "@/lib/auth-policy";

export type LoginState = { email: string; sent: boolean; error?: string };

export async function login(_previous: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const sent = form.get("step") === "verify";
  if (!isOwnerEmail(email, process.env.BRAIN_OWNER_EMAIL)) {
    return { email, sent: false, error: "This account does not have access to Open Brain." };
  }
  try {
    if (!sent) {
      const { error } = await auth.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
      return error
        ? { email, sent: false, error: "Could not send a code. Please wait a minute and try again." }
        : { email, sent: true };
    }
    const otp = String(form.get("otp") ?? "").trim();
    if (!/^\d{6}$/.test(otp)) return { email, sent: true, error: "Enter the six-digit code from your email." };
    const { data, error } = await auth.signIn.emailOtp({ email, otp });
    if (error) return { email, sent: true, error: "That code is incorrect or expired. Try again or request a new code." };
    // Better Auth can return the pre-verification user on the first OTP login.
    // Check identity here; requireOwner checks a fresh, verified session on the
    // redirected page and again before any data access.
    if (!data?.user || !isOwnerEmail(data.user.email, process.env.BRAIN_OWNER_EMAIL)) {
      await auth.signOut();
      return { email, sent: false, error: "This account does not have access to Open Brain." };
    }
  } catch {
    return { email, sent, error: "Sign-in is temporarily unavailable. Please try again." };
  }
  redirect(safeReturnPath(String(form.get("from") ?? "/")));
}

export async function signOut(): Promise<void> {
  const { error } = await auth.signOut();
  if (error) throw new Error("Could not sign out. Please try again.");
  redirect("/login");
}
