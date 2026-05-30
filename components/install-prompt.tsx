"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed (running as standalone)
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Don't show if user dismissed before
    if (localStorage.getItem("ilm-install-dismissed") === "1") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!prompt || dismissed) return null;

  async function handleInstall() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setDismissed(true);
    }
    setPrompt(null);
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem("ilm-install-dismissed", "1");
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 bg-white border shadow-xl rounded-2xl p-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
      >
        <X size={16} />
      </button>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-[#1B4332] rounded-xl flex items-center justify-center shrink-0">
          <span className="text-[#F59E0B] text-lg font-bold">ع</span>
        </div>
        <div>
          <p className="font-semibold text-sm text-gray-900">Install Ilm</p>
          <p className="text-xs text-muted-foreground">Add to home screen for quick access</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleDismiss}
          className="flex-1 text-sm text-muted-foreground py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Not now
        </button>
        <button
          onClick={handleInstall}
          className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium bg-[#1B4332] text-white py-2 rounded-lg hover:bg-[#2D6A4F] transition-colors"
        >
          <Download size={14} /> Install
        </button>
      </div>
    </div>
  );
}
