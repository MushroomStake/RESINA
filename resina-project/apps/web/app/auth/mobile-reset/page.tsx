"use client";

import { useEffect, useMemo, useState } from "react";

function getRecoveryData() {
  if (typeof window === "undefined") {
    return {
      deepLink: "resina://auth/reset-password?view=change-password",
      webFallbackLink: "/reset-password",
    };
  }

  const url = new URL(window.location.href);
  const hashRaw = url.hash.startsWith("#") ? url.hash.slice(1) : "";
  const hashParams = new URLSearchParams(hashRaw);

  const queryParams = new URLSearchParams();
  queryParams.set("view", "change-password");

  const authKeys = [
    "access_token",
    "refresh_token",
    "expires_at",
    "expires_in",
    "token_type",
    "type",
    "code",
  ];

  authKeys.forEach((key) => {
    const value = hashParams.get(key) ?? url.searchParams.get(key);
    if (value) {
      queryParams.set(key, value);
    }
  });

  const deepLink = `resina://auth/reset-password?${queryParams.toString()}`;

  const webFallbackParams = new URLSearchParams(url.searchParams);
  webFallbackParams.set("view", "change-password");
  const webFallbackLink = `/reset-password?${webFallbackParams.toString()}${url.hash || ""}`;

  return { deepLink, webFallbackLink };
}

export default function MobileResetBridgePage() {
  const [showFallback, setShowFallback] = useState(false);
  const { deepLink, webFallbackLink } = useMemo(() => getRecoveryData(), []);

  useEffect(() => {
    window.location.href = deepLink;
    const timer = setTimeout(() => {
      setShowFallback(true);
    }, 1500);

    return () => {
      clearTimeout(timer);
    };
  }, [deepLink]);

  return (
    <main className="min-h-dvh bg-[#f3f5f5] px-4 py-10 text-[#0f2744]">
      <div className="mx-auto w-full max-w-[520px] rounded-2xl border border-[#dbe3e7] bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Open RESINA App</h1>
        <p className="mt-2 text-sm text-[#4b5563]">
          We are opening RESINA so you can set your new password securely.
        </p>

        {showFallback ? (
          <div className="mt-5 space-y-3">
            <a
              href={deepLink}
              className="block rounded-xl bg-[#2e9d5a] px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              Open RESINA App
            </a>
            <a
              href={webFallbackLink}
              className="block rounded-xl border border-[#d1d5db] px-4 py-2.5 text-center text-sm font-semibold text-[#1f2937]"
            >
              Continue On Web Instead
            </a>
            <p className="text-xs text-[#6b7280]">
              If the app does not open, make sure RESINA is installed and then tap Open RESINA App again.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
