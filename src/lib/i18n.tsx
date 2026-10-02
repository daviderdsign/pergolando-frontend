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
    "wizard.dimensionsSection": "Dimensioni",
    "wizard.larghezza": "Larghezza L (cm)",
    "wizard.sporgenza": "Sporgenza SP (cm)",
    "wizard.altezza": "Altezza a parete H (cm)",
    "wizard.altezzaInclinazione": "Altezza per calcolo inclinazione H1 (cm)",
    "wizard.larghezzaHint": "Massimo per questa variante:",
    "wizard.sporgenzaHint": "Intervallo consentito:",
    "wizard.colorsSection": "Colori",
    "wizard.coloreStruttura": "Colore struttura",
    "wizard.colorePlastica": "Colore parti plastiche",
    "wizard.coloreSupplemento": "supplemento",
    "wizard.coloreSupplementoHint": "Questo colore richiede un supplemento non incluso nel calcolo automatico del prezzo.",
    "wizard.fissaggioSection": "Fissaggio",
    "wizard.fissaggioParete": "A parete",
    "wizard.fissaggioSoffitto": "A soffitto",
    "wizard.comandoSection": "Comandi",
    "wizard.comando": "Comando",
    "wizard.comandoNessuno": "Nessuno (solo motore di serie incluso)",
    "wizard.accessoriSection": "Accessori",
    "wizard.accessoriHint": "Il prezzo esatto (variabile per dimensione) verrà mostrato nel calcolo finale.",
    "wizard.calcola": "Calcola preventivo",
    "wizard.calcolando": "Calcolo in corso…",
    "wizard.calcoloErrorGeneric": "Si è verificato un errore nel calcolo. Riprova.",
    "wizard.risultatoSection": "Preventivo",
    "wizard.prezzoTotale": "Totale:",
    "wizard.h1NonVerificato": "l'altezza minima per il corretto deflusso dell'acqua non è ancora verificata automaticamente — controllare con l'ufficio tecnico.",
    "wizard.loadingCatalog": "Caricamento catalogo…",
    "wizard.generaRendering": "Genera rendering",
    "wizard.generandoRendering": "Generazione in corso…",
    "wizard.renderingErrorGeneric": "Si è verificato un errore nella generazione del rendering. Riprova.",
    "wizard.renderingAlt": "Rendering fotorealistico della configurazione",
    "wizard.fotoAmbienteSection": "Foto del luogo di installazione",
    "wizard.fotoAmbienteHint": "Scatta o carica una foto del punto dove verrà installata la pergola: verrà usata per comporre il modello 3D nella prospettiva reale.",
    "wizard.fotoAmbienteScegli": "Scatta o carica foto",
    "wizard.fotoAmbienteSostituisci": "Sostituisci foto",
    "wizard.fotoAmbienteRimuovi": "Rimuovi foto",
    "wizard.fotoAmbienteAlt": "Foto del luogo di installazione",
    "wizard.fotoAmbienteErrorTipo": "Seleziona un file immagine (JPEG, PNG, ecc.).",
    "wizard.puntiRiferimentoSection": "Linea di riferimento",
    "wizard.puntiRiferimentoHint": "Traccia sulla foto la riga dove il muro incontra il pavimento, esattamente dove inizierà la pergola — l'inclinazione della camera viene calcolata automaticamente dalla foto stessa.",
    "wizard.puntiRiferimentoProssimo": "Tocca ora: {etichetta}.",
    "wizard.puntiRiferimentoPronti": "Riga tracciata — indica la sua lunghezza reale per continuare.",
    "wizard.puntiRiferimentoContatore": "punti selezionati",
    "wizard.lunghezzaLineaLabel": "Lunghezza reale della riga (cm)",
    "wizard.lunghezzaLineaHint": "Se questa riga corrisponde esattamente alla larghezza della pergola, lascia il valore precompilato. Altrimenti misurala e correggi il numero.",
    "wizard.grigliaHint": "Trascina sulla griglia per indicare dove va posizionata la pergola (dimensioni reali del preventivo, non quelle del rettangolo disegnato) — poi genera l'anteprima 3D. Ogni quadretto = 50cm.",
    "wizard.puntoControllo": "punto di controllo",
    "wizard.aggiungiControllo": "Aggiungi riga di controllo (consigliato)",
    "wizard.aggiungiControlloAttivo": "Tocca ora il punto di controllo…",
    "wizard.controlloHint": "Una seconda riga, perpendicolare alla prima (es. il bordo del terrazzo contro il muro), rende la prospettiva più precisa — parte dal primo punto già toccato.",
    "wizard.lunghezzaControlloLabel": "Lunghezza reale della riga di controllo (cm)",
    "wizard.puntoRiferimentoRimuovi": "Rimuovi questo punto",
    "wizard.puntiRiferimentoReset": "Ricomincia",
    "wizard.puntoAnterioreSinistro": "inizio riga (sinistra)",
    "wizard.puntoAnterioreDestro": "fine riga (destra)",
    "wizard.calcolaProspettiva": "Calcola prospettiva",
    "wizard.calcolandoProspettiva": "Calcolo prospettiva in corso…",
    "wizard.prospettivaErrorGeneric": "Si è verificato un errore nel calcolo della prospettiva. Riprova.",
    "wizard.generaScena3d": "Genera anteprima 3D",
    "wizard.generandoScena3d": "Generazione anteprima 3D in corso…",
    "wizard.scena3dErrorGeneric": "Si è verificato un errore nella generazione dell'anteprima 3D. Riprova.",
    "wizard.finaleSection": "Immagine finale",
    "wizard.finaleHint": "Genera l'immagine fotorealistica definitiva: la pergola con i materiali e i colori reali, ambientata nella foto con arredi e illuminazione.",
    "wizard.generaFinale": "Genera immagine finale",
    "wizard.generandoFinale": "Generazione in corso… (può richiedere qualche secondo)",
    "wizard.finaleErrorGeneric": "Si è verificato un errore nella generazione dell'immagine finale. Riprova.",
    "wizard.finaleAlt": "Immagine fotorealistica finale della pergola installata",
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
    "wizard.dimensionsSection": "Dimensions",
    "wizard.larghezza": "Width L (cm)",
    "wizard.sporgenza": "Projection SP (cm)",
    "wizard.altezza": "Wall height H (cm)",
    "wizard.altezzaInclinazione": "Height for inclination H1 (cm)",
    "wizard.larghezzaHint": "Maximum for this variant:",
    "wizard.sporgenzaHint": "Allowed range:",
    "wizard.colorsSection": "Colors",
    "wizard.coloreStruttura": "Structure color",
    "wizard.colorePlastica": "Plastic parts color",
    "wizard.coloreSupplemento": "surcharge",
    "wizard.coloreSupplementoHint": "This color requires a surcharge not included in the automatic price calculation.",
    "wizard.fissaggioSection": "Mounting",
    "wizard.fissaggioParete": "Wall mount",
    "wizard.fissaggioSoffitto": "Ceiling mount",
    "wizard.comandoSection": "Controls",
    "wizard.comando": "Control",
    "wizard.comandoNessuno": "None (standard motor only)",
    "wizard.accessoriSection": "Accessories",
    "wizard.accessoriHint": "The exact price (which varies by dimension) will be shown in the final calculation.",
    "wizard.calcola": "Calculate quote",
    "wizard.calcolando": "Calculating…",
    "wizard.calcoloErrorGeneric": "Something went wrong calculating the price. Please try again.",
    "wizard.risultatoSection": "Quote",
    "wizard.prezzoTotale": "Total:",
    "wizard.h1NonVerificato": "the minimum height for proper water drainage isn't automatically checked yet — verify with the technical office.",
    "wizard.loadingCatalog": "Loading catalog…",
    "wizard.generaRendering": "Generate rendering",
    "wizard.generandoRendering": "Generating…",
    "wizard.renderingErrorGeneric": "Something went wrong generating the rendering. Please try again.",
    "wizard.renderingAlt": "Photorealistic rendering of the configuration",
    "wizard.fotoAmbienteSection": "Installation site photo",
    "wizard.fotoAmbienteHint": "Take or upload a photo of the spot where the pergola will be installed: it will be used to compose the 3D model in the real perspective.",
    "wizard.fotoAmbienteScegli": "Take or upload photo",
    "wizard.fotoAmbienteSostituisci": "Replace photo",
    "wizard.fotoAmbienteRimuovi": "Remove photo",
    "wizard.fotoAmbienteAlt": "Installation site photo",
    "wizard.fotoAmbienteErrorTipo": "Please select an image file (JPEG, PNG, etc.).",
    "wizard.puntiRiferimentoSection": "Reference line",
    "wizard.puntiRiferimentoHint": "Trace the line on the photo where the wall meets the floor, exactly where the pergola will start — camera tilt is estimated automatically from the photo itself.",
    "wizard.puntiRiferimentoProssimo": "Tap now: {etichetta}.",
    "wizard.puntiRiferimentoPronti": "Line traced — enter its real length to continue.",
    "wizard.puntiRiferimentoContatore": "points selected",
    "wizard.lunghezzaLineaLabel": "Real length of the line (cm)",
    "wizard.lunghezzaLineaHint": "If this line matches the pergola's width exactly, leave the prefilled value. Otherwise measure it and correct the number.",
    "wizard.grigliaHint": "Drag on the grid to set where the pergola goes (real quote dimensions, not the drawn rectangle's own size) — then generate the 3D preview. Each square = 50cm.",
    "wizard.puntoControllo": "control point",
    "wizard.aggiungiControllo": "Add a control line (recommended)",
    "wizard.aggiungiControlloAttivo": "Tap the control point now…",
    "wizard.controlloHint": "A second line, perpendicular to the first (e.g. the terrace edge against the wall), makes the perspective more precise — starts from the first point you already tapped.",
    "wizard.lunghezzaControlloLabel": "Real length of the control line (cm)",
    "wizard.puntoRiferimentoRimuovi": "Remove this point",
    "wizard.puntiRiferimentoReset": "Start over",
    "wizard.puntoAnterioreSinistro": "line start (left)",
    "wizard.puntoAnterioreDestro": "line end (right)",
    "wizard.calcolaProspettiva": "Calculate perspective",
    "wizard.calcolandoProspettiva": "Calculating perspective…",
    "wizard.prospettivaErrorGeneric": "Something went wrong calculating the perspective. Please try again.",
    "wizard.generaScena3d": "Generate 3D preview",
    "wizard.generandoScena3d": "Generating 3D preview…",
    "wizard.scena3dErrorGeneric": "Something went wrong generating the 3D preview. Please try again.",
    "wizard.finaleSection": "Final image",
    "wizard.finaleHint": "Generate the final photorealistic image: the pergola with real materials and colors, staged in the photo with furniture and lighting.",
    "wizard.generaFinale": "Generate final image",
    "wizard.generandoFinale": "Generating… (can take a few seconds)",
    "wizard.finaleErrorGeneric": "Something went wrong generating the final image. Please try again.",
    "wizard.finaleAlt": "Final photorealistic image of the installed pergola",
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
