"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Lang = "en" | "ur";

const LangContext = createContext<{
  lang: Lang;
  toggle: () => void;
}>({ lang: "en", toggle: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const saved = (localStorage.getItem("ilm_lang") ?? "en") as Lang;
    setLang(saved);
    applyLang(saved);
  }, []);

  function toggle() {
    const next: Lang = lang === "en" ? "ur" : "en";
    setLang(next);
    localStorage.setItem("ilm_lang", next);
    applyLang(next);
  }

  return (
    <LangContext.Provider value={{ lang, toggle }}>
      {children}
    </LangContext.Provider>
  );
}

function applyLang(lang: Lang) {
  const html = document.documentElement;
  if (lang === "ur") {
    html.setAttribute("dir", "rtl");
    html.setAttribute("lang", "ur");
    html.style.fontFamily = "'Noto Nastaliq Urdu', serif";
  } else {
    html.setAttribute("dir", "ltr");
    html.setAttribute("lang", "en");
    html.style.fontFamily = "";
  }
}

export function useLang() {
  return useContext(LangContext);
}
