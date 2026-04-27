type Props = {
  searchParams: Promise<{ error?: string; from?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { error, from } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-zinc-100">
      <form
        method="post"
        action="/api/auth/login"
        className="w-full max-w-sm space-y-4 p-6 rounded-lg border border-zinc-800 bg-zinc-900"
      >
        <h1 className="text-lg font-medium">Open Brain</h1>
        <input type="hidden" name="from" value={from ?? "/"} />
        <label className="block">
          <span className="text-sm text-zinc-400">Password</span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
          />
        </label>
        {error ? (
          <p className="text-sm text-red-400">Incorrect password.</p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
