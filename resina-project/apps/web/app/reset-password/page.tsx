"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "../../lib/supabase/client";
import StatusFeedbackModal from "../admin/components/status-feedback-modal";

function normalizeAuthMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "Unable to update password.";

  const normalized = trimmed.toLowerCase();
  if (normalized.includes("invalid") || normalized.includes("expired")) {
    return "Recovery link is invalid or expired. Please request a new password reset link.";
  }

  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "Cannot connect right now. Please check your internet connection and try again.";
  }

  return trimmed;
}

function hasRecoveryIntent(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(window.location.search);

  const hashType = (hashParams.get("type") ?? "").toLowerCase();
  const queryView = (searchParams.get("view") ?? "").toLowerCase();

  return hashType === "recovery" || queryView === "change-password";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;

    const primeRecoverySession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (isMounted) {
        if (session) {
          setIsReady(true);
          setErrorMessage(null);
        } else if (!hasRecoveryIntent()) {
          setErrorMessage("Open this page using your password reset email link.");
        }
      }
    };

    void primeRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!isMounted) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || Boolean(session)) {
        setIsReady(true);
        setErrorMessage(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, [supabase]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isReady) {
      setErrorMessage("Recovery link is not ready yet. Please reopen the reset link from your email.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setErrorMessage("Please complete all password fields.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirm password do not match.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setErrorMessage("Recovery link is invalid or expired. Please request a new password reset link.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setErrorMessage(normalizeAuthMessage(error.message));
        return;
      }

      await supabase.auth.signOut();
      setSuccessMessage("Password updated successfully. Redirecting to landing page...");
      redirectTimerRef.current = setTimeout(() => {
        router.push("/");
      }, 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update password.";
      setErrorMessage(normalizeAuthMessage(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const feedbackMessage = errorMessage || successMessage || "";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f3f5f5] px-4 py-10">
      <StatusFeedbackModal
        visible={Boolean(feedbackMessage)}
        message={feedbackMessage}
        variant={errorMessage ? "error" : "success"}
        onClose={() => {
          setErrorMessage(null);
          setSuccessMessage(null);
        }}
      />

      <div className="w-full max-w-[420px] rounded-2xl bg-white px-8 py-8 shadow-md">
        <h1 className="text-2xl font-semibold text-[#0f2744]">Reset Password</h1>
        <p className="mt-2 text-sm text-[#4b5563]">Set your new account password below.</p>

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="mb-5">
            <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-[#111827]">
              New Password
            </label>
            <div className="flex items-center gap-2.5 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3">
              <input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                placeholder="Enter new password"
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((value) => !value)}
                className="shrink-0 text-xs font-semibold text-[#6b7280]"
              >
                {showNewPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-[#111827]">
              Confirm New Password
            </label>
            <div className="flex items-center gap-2.5 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3">
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm new password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#9ca3af] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="shrink-0 text-xs font-semibold text-[#6b7280]"
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !isReady}
            className="w-full rounded-xl bg-[#2e9d5a] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#257a48] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Updating password..." : "Update Password"}
          </button>
        </form>
      </div>
    </main>
  );
}
