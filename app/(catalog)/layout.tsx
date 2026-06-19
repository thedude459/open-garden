import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { signOut } from "@/lib/auth/config";

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="container">
      <nav className="nav">
        <div className="row">
          <Link href="/plants">Plant Catalog</Link>
        </div>
        <div className="row">
          <span className="field-label">{session?.user?.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="btn secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </nav>
      {children}
    </div>
  );
}
