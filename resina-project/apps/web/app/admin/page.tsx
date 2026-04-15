"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import StatusFeedbackModal from "./components/status-feedback-modal";

function normalizeAuthMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "Unable to sign in.";

  const normalized = trimmed.toLowerCase();
  if (normalized.includes("invalid login credentials") || normalized.includes("invalid credentials")) {
    return "Wrong email or password. Please try again.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Your email is not confirmed yet. Please check your inbox and confirm your account.";
  }

  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "Cannot connect right now. Please check your internet connection and try again.";
  }

  if (normalized.includes("unauthorized") || normalized.includes("forbidden") || normalized.includes("permission")) {
    return "You have no access privilege in this portal.";
  }

  return trimmed;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasPortalAccess = (role: string | null | undefined) => role === "admin" || role === "member";

  const isRecoveryRequest = () => {
    if (typeof window === "undefined") {
      return false;
    }

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(window.location.search);
    const hashType = (hashParams.get("type") ?? "").toLowerCase();
    const queryView = (searchParams.get("view") ?? "").toLowerCase();

    return hashType === "recovery" || queryView === "change-password";
  };

  useEffect(() => {
    if (isRecoveryRequest()) {
      window.location.replace(`/reset-password${window.location.search}${window.location.hash}`);
    }

    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(normalizeAuthMessage(error.message));
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMessage("Unable to verify your account.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (profileError) {
        setErrorMessage(normalizeAuthMessage(profileError.message));
        await supabase.auth.signOut();
        return;
      }

      if (!hasPortalAccess((profile?.role as string | undefined) ?? null)) {
        await supabase.auth.signOut();
        setErrorMessage("You have no access privilege in this portal.");
        return;
      }

      setSuccessMessage("Login successful.");
      redirectTimerRef.current = setTimeout(() => {
        router.push("/admin/dashboard");
      }, 900);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in.";
      setErrorMessage(normalizeAuthMessage(message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResetLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = forgotEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage("Please enter your email address.");
      setSuccessMessage(null);
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSendingReset(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });

      if (error) {
        setErrorMessage(normalizeAuthMessage(error.message));
        return;
      }

      setSuccessMessage("A password reset link has been sent. Please check your inbox.");
      setEmail(normalizedEmail);
      setIsForgotOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send reset link.";
      setErrorMessage(normalizeAuthMessage(message));
    } finally {
      setIsSendingReset(false);
    }
  };

  const feedbackMessage = errorMessage || successMessage || "";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-between bg-[#f3f5f5] px-4 py-10">
      <StatusFeedbackModal
        visible={Boolean(feedbackMessage)}
        message={feedbackMessage}
        variant={errorMessage ? "error" : "success"}
        onClose={() => {
          setErrorMessage(null);
          setSuccessMessage(null);
        }}
      />

      <div className="flex flex-1 flex-col items-center justify-center w-full">
        {/* Logo */}
        <div className="mb-4 flex flex-col items-center gap-2">
          <Image
            src="/images/resina%20logo.png"
            alt="RESINA logo"
            width={72}
            height={72}
            priority
          />
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-wide text-[#0f2744]">
            RESINA
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-[#4b5563]">
            <svg className="h-4 w-4 text-[#2e9d5a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            Admin Access Portal
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-[360px] rounded-2xl bg-white px-8 py-8 shadow-md">
          {isForgotOpen ? (
            <form onSubmit={handleSendResetLink}>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#111827]">Password Reset</p>
                <button
                  type="button"
                  onClick={() => setIsForgotOpen(false)}
                  className="text-xs font-medium text-[#2e9d5a] hover:underline"
                >
                  Back to Login
                </button>
              </div>

              <p className="mb-4 text-xs text-[#4b5563]">
                Enter your admin email and we will send a password reset link.
              </p>

              <div className="mb-5">
                <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-[#111827]">
                  Email Address
                </label>
                <div className="flex items-center gap-2.5 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 focus-within:border-[#2e9d5a] focus-within:ring-2 focus-within:ring-[#2e9d5a]/20">
                  <svg className="h-4 w-4 shrink-0 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    placeholder="admin@email.com"
                    required
                    value={forgotEmail}
                    onChange={(event) => setForgotEmail(event.target.value)}
                    className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSendingReset}
                className="w-full rounded-xl bg-[#2e9d5a] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#257a48] focus:outline-none focus:ring-2 focus:ring-[#2e9d5a]/40"
              >
                {isSendingReset ? "Sending link..." : "Send Reset Link"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
                {/* Email */}
                <div className="mb-5">
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#111827]">
                    Email Address
                  </label>
                  <div className="flex items-center gap-2.5 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 focus-within:border-[#2e9d5a] focus-within:ring-2 focus-within:ring-[#2e9d5a]/20">
                    <svg className="h-4 w-4 shrink-0 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="admin@email.com"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="mb-6">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-medium text-[#111827]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotOpen(true);
                        setForgotEmail(email.trim().toLowerCase());
                      }}
                      className="text-xs font-medium text-[#2e9d5a] hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 focus-within:border-[#2e9d5a] focus-within:ring-2 focus-within:ring-[#2e9d5a]/20">
                    <svg className="h-4 w-4 shrink-0 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••••••"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="shrink-0 text-[#9ca3af] hover:text-[#4b5563]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-xl bg-[#2e9d5a] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#257a48] focus:outline-none focus:ring-2 focus:ring-[#2e9d5a]/40"
                >
                  {isLoading ? "Logging in..." : "Log In"}
                </button>
              </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-center text-xs font-medium uppercase tracking-widest text-[#9ca3af]">
        © 2026 Sta. Rita Municipality. All rights reserved.
      </p>
    </main>
  );
}
