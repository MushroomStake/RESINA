"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type PortalProps = {
  children?: React.ReactNode;
  containerId?: string;
};

export default function Portal({ children, containerId }: PortalProps) {
  const [mounted, setMounted] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    const target = containerId ? document.getElementById(containerId) : document.body;
    setContainer(target ?? document.body);
    return () => {
      setMounted(false);
    };
  }, [containerId]);

  if (!mounted || !container) return null;

  return createPortal(children ?? null, container);
}
