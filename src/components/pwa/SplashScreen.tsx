"use client";

import { useEffect, useState } from "react";

export function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Hide splash screen once the first content paint is complete
    const handleLoad = () => {
      // Give a brief moment for the content to render
      requestAnimationFrame(() => {
        setVisible(false);
      });
    };

    if (document.readyState === "complete") {
      handleLoad();
    } else {
      window.addEventListener("load", handleLoad);
      return () => window.removeEventListener("load", handleLoad);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden="true"
      role="presentation"
    >
      {/* Transcend Logo */}
      <svg
        width="200"
        height="60"
        viewBox="0 0 200 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Transcend"
      >
        {/* Stylized "T" mark */}
        <rect x="60" y="8" width="80" height="8" rx="4" fill="#C9984A" />
        <rect x="92" y="8" width="16" height="44" rx="4" fill="#C9984A" />
      </svg>
      <p
        className="mt-4 font-serif text-lg tracking-[4px] text-[#C9984A]"
        style={{ fontFamily: "var(--font-playfair-display), Georgia, serif" }}
      >
        TRANSCEND
      </p>
      <p className="mt-2 text-xs tracking-wider text-[#C9984A]/60">
        Wellness & Recovery
      </p>
    </div>
  );
}
