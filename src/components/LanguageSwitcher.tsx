"use client";

import { useI18n } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang-switcher" role="group" aria-label="Lingua / Language">
      <button
        type="button"
        aria-pressed={lang === "it"}
        onClick={() => setLang("it")}
        disabled={lang === "it"}
      >
        IT
      </button>
      <button
        type="button"
        aria-pressed={lang === "en"}
        onClick={() => setLang("en")}
        disabled={lang === "en"}
      >
        EN
      </button>
    </div>
  );
}
