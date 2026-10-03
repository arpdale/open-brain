import { safeReturnPath } from "@/lib/auth-policy";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ from?: string; redirectTo?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <LoginForm from={safeReturnPath(params.from ?? params.redirectTo ?? "/")} />
    </main>
  );
}
