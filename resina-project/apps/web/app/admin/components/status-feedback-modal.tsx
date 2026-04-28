"use client";

import { useEffect, useRef, useState } from "react";
import Portal from "../../components/portal";

type StatusVariant = "success" | "error" | "info";

type StatusFeedbackModalProps = {
  visible: boolean;
  message: string;
  variant: StatusVariant;
  onClose?: () => void;
};

const SUCCESS_DURATION_MS = 2600;

export default function StatusFeedbackModal({
  visible,
  message,
  variant,
  onClose,
}: StatusFeedbackModalProps) {
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successFadingOut, setSuccessFadingOut] = useState(false);
  const [errorFadingOut, setErrorFadingOut] = useState(false);
  const [isProgressRunning, setIsProgressRunning] = useState(false);

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  const closeErrorModal = () => {
    setErrorFadingOut(true);
    fadeTimerRef.current = setTimeout(() => {
      setShowErrorModal(false);
      setErrorFadingOut(false);
      onClose?.();
    }, 180);
  };

  useEffect(() => {
    if (!visible || !message.trim()) {
      return;
    }

    clearTimers();

    if (variant === "success") {
      setShowSuccessToast(true);
      setSuccessFadingOut(false);
      setIsProgressRunning(false);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsProgressRunning(true);
        });
      });

      closeTimerRef.current = setTimeout(() => {
        setSuccessFadingOut(true);
        fadeTimerRef.current = setTimeout(() => {
          setShowSuccessToast(false);
          setSuccessFadingOut(false);
          onClose?.();
        }, 180);
      }, SUCCESS_DURATION_MS);

      return;
    }

    setShowErrorModal(true);
    setErrorFadingOut(false);
  }, [visible, message, variant]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  const hasMessage = visible && Boolean(message.trim());
  const shouldRender = hasMessage || showSuccessToast || showErrorModal;

  if (!shouldRender) {
    return null;
  }

  return (
    <Portal>
      <>
        {showSuccessToast ? (
          <div
            className={`pointer-events-none fixed bottom-5 left-1/2 z-[70] w-[calc(100%-24px)] max-w-[460px] -translate-x-1/2 transition-opacity duration-200 ${
              successFadingOut ? "opacity-0" : "opacity-100"
            }`}
          >
            <div className="relative overflow-hidden rounded-lg border border-[#d9dee5] bg-[#f2f3f5] px-3 py-2.5 shadow-[0_6px_14px_rgba(0,0,0,0.14)]">
              <div className="flex items-center gap-2.5 pr-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-[#c8e2bf] text-[#5f9f4a]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-[22px] leading-none text-[#4b5563]">{message}</p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#e2e8f0]">
                <div
                  className={`h-full bg-[#9ca3af] transition-[width] ease-linear duration-[2600ms] ${
                    isProgressRunning ? "w-0" : "w-full"
                  }`}
                />
              </div>
            </div>
          </div>
        ) : null}

        {showErrorModal ? (
          <div
            className={`fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,23,42,0.35)] px-4 transition-opacity duration-200 ${
              errorFadingOut ? "opacity-0" : "opacity-100"
            }`}
          >
            <div className="w-full max-w-[520px] rounded-[10px] border border-[#e5e7eb] bg-[#f8fafc] px-5 pb-5 pt-6 text-center shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:px-6">
              <div className="mx-auto mb-3 flex h-[66px] w-[66px] items-center justify-center rounded-full border-4 border-[#e56f75] text-[#e56f75]">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </div>
              <h3 className="mb-2 text-[22px] font-semibold leading-none text-[#4b5563]">Action Failed</h3>
              <p className="mb-5 text-[16px] leading-[1.35] text-[#334155]">{message}</p>
              <button
                type="button"
                onClick={closeErrorModal}
                className="rounded-[10px] border-2 border-[#b8b5ec] bg-[#6b5fd6] px-5 py-2 text-[15px] font-semibold text-white"
              >
                OK
              </button>
            </div>
          </div>
        ) : null}
      </>
    </Portal>
  );
}
