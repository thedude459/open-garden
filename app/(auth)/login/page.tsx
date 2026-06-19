import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="container">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
