import { signOut } from "../actions";

export default function NotAuthorisedPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border bg-surface p-8">
        <h1 className="font-serif text-[28px] leading-tight">Not authorised</h1>
        <p className="mt-2 text-text-muted">
          Your account is not on the Elevique team list. Ask the owner to add your email.
        </p>
        <form action={signOut} className="mt-6">
          <button type="submit" className="h-10 w-full rounded-md border bg-surface-2 font-medium">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
