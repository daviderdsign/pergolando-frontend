"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "it" | "en";

const dictionary = {
  it: {
    "login.title": "Accesso venditore",
    "login.email": "Email",
    "login.password": "Password",
    "login.submit": "Accedi",
    "login.registerInstead": "Non hai un account? Registrati",
    "login.error.invalidCredentials": "Email o password non corretti.",
    "login.error.accountLocked": "Troppi tentativi falliti. Riprova più tardi.",
    "login.error.emailNotVerified": "Devi prima confermare la tua email.",
    "login.error.generic": "Si è verificato un errore. Riprova.",
    "login.forgotPassword": "Password dimenticata?",
    "register.title": "Registrazione venditore",
    "register.submit": "Registrati",
    "register.loginInstead": "Hai già un account? Accedi",
    "register.error.emailTaken": "Un venditore con questa email è già registrato.",
    "verify.title": "Conferma la tua email",
    "verify.instructions": "Abbiamo inviato un codice a 6 cifre a {email}. Inseriscilo qui sotto.",
    "verify.code": "Codice",
    "verify.submit": "Conferma",
    "verify.resend": "Non hai ricevuto il codice? Invia di nuovo",
    "verify.resendSent": "Codice inviato di nuovo.",
    "verify.resendCooldown": "Attendi qualche secondo prima di richiederne un altro.",
    "verify.error.invalidCode": "Codice non valido o scaduto.",
    "verify.error.generic": "Si è verificato un errore. Riprova.",
    "verify.success": "Email confermata. Ora puoi accedere.",
    "forgotPassword.title": "Recupera password",
    "forgotPassword.instructions": "Inserisci la tua email: se è registrata, riceverai un codice per reimpostare la password.",
    "forgotPassword.submit": "Invia codice",
    "forgotPassword.backToLogin": "Torna al login",
    "resetPassword.title": "Reimposta password",
    "resetPassword.instructions": "Inserisci il codice ricevuto via email e la nuova password.",
    "resetPassword.newPassword": "Nuova password",
    "resetPassword.submit": "Reimposta password",
    "resetPassword.success": "Password reimpostata. Ora puoi accedere.",
    "wizard.title": "Nuovo preventivo",
    "wizard.clientSection": "Dati cliente",
    "wizard.clientFirstName": "Nome",
    "wizard.clientLastName": "Cognome",
    "wizard.clientAddress": "Indirizzo",
    "wizard.productSection": "Prodotto",
    "wizard.product": "Prodotto",
    "wizard.sottoModello": "Sotto-modello",
    "wizard.variante": "Variante di montaggio",
    "wizard.next": "Avanti",
    "wizard.loadingCatalog": "Caricamento catalogo…",
    "nav.logout": "Esci",
  },
  en: {
    "login.title": "Seller sign in",
    "login.email": "Email",
    "login.password": "Password",
    "login.submit": "Sign in",
    "login.registerInstead": "No account? Register",
    "login.error.invalidCredentials": "Incorrect email or password.",
    "login.error.accountLocked": "Too many failed attempts. Try again later.",
    "login.error.emailNotVerified": "You must confirm your email first.",
    "login.error.generic": "Something went wrong. Please try again.",
    "login.forgotPassword": "Forgot password?",
    "register.title": "Seller registration",
    "register.submit": "Register",
    "register.loginInstead": "Already have an account? Sign in",
    "register.error.emailTaken": "A seller with this email is already registered.",
    "verify.title": "Confirm your email",
    "verify.instructions": "We sent a 6-digit code to {email}. Enter it below.",
    "verify.code": "Code",
    "verify.submit": "Confirm",
    "verify.resend": "Didn't receive the code? Resend it",
    "verify.resendSent": "Code sent again.",
    "verify.resendCooldown": "Please wait a few seconds before requesting another.",
    "verify.error.invalidCode": "Invalid or expired code.",
    "verify.error.generic": "Something went wrong. Please try again.",
    "verify.success": "Email confirmed. You can now sign in.",
    "forgotPassword.title": "Recover password",
    "forgotPassword.instructions": "Enter your email: if it's registered, you'll receive a code to reset your password.",
    "forgotPassword.submit": "Send code",
    "forgotPassword.backToLogin": "Back to sign in",
    "resetPassword.title": "Reset password",
    "resetPassword.instructions": "Enter the code you received by email and your new password.",
    "resetPassword.newPassword": "New password",
    "resetPassword.submit": "Reset password",
    "resetPassword.success": "Password reset. You can now sign in.",
    "wizard.title": "New quote",
    "wizard.clientSection": "Client details",
    "wizard.clientFirstName": "First name",
    "wizard.clientLastName": "Last name",
    "wizard.clientAddress": "Address",
    "wizard.productSection": "Product",
    "wizard.product": "Product",
    "wizard.sottoModello": "Sub-model",
    "wizard.variante": "Mounting variant",
    "wizard.next": "Next",
    "wizard.loadingCatalog": "Loading catalog…",
    "nav.logout": "Log out",
  },
} as const;

export type TranslationKey = keyof (typeof dictionary)["it"];

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("it");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pergolando_lang");
      if (stored === "it" || stored === "en") setLangState(stored);
    } catch {
      // localStorage unavailable (private mode, etc.) — default stands.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function setLang(next: Lang) {
    setLangState(next);
    try {
      localStorage.setItem("pergolando_lang", next);
    } catch {
      // best-effort only
    }
  }

  function t(key: TranslationKey): string {
    return dictionary[lang][key];
  }

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
