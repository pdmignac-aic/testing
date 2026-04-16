"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage(null);

    const allowed = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN;
    if (allowed && !email.toLowerCase().endsWith(`@${allowed.toLowerCase()}`)) {
      setStatus("error");
      setMessage(`Email must end with @${allowed}`);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Check your email for the login link.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 border border-white/10 rounded-lg p-6 bg-white/5"
      >
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-white/60">
          Enter your work email to receive a magic link.
        </p>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="w-full px-3 py-2 rounded bg-black/40 border border-white/10 focus:outline-none focus:border-white/40"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full py-2 rounded bg-white text-black font-medium disabled:opacity-60"
        >
          {status === "sending" ? "Sending..." : "Send magic link"}
        </button>
        {message && (
          <p
            className={`text-sm ${
              status === "error" ? "text-red-400" : "text-green-400"
            }`}
          >
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
