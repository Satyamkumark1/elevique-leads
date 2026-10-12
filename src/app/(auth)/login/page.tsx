import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border bg-surface p-8">
        <h1 className="font-serif text-[28px] leading-tight">Elevique Leads</h1>
        <p className="mt-1 text-text-muted">Sign in with your team email.</p>
        {error === "link" && (
          <p role="alert" className="mt-4 text-error-fg">
            That sign-in link is invalid or expired. Request a new one.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
