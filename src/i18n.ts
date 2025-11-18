import fr from "./locales/fr.json";
import en from "./locales/en.json";
import de from "./locales/de.json";
import es from "./locales/es.json";
import it from "./locales/it.json";
import pt from "./locales/pt.json";
import nl from "./locales/nl.json";
import pl from "./locales/pl.json";

type Dict = Record<string, unknown>;

const locales: Record<string, Dict> = {
  fr,
  en,
  de,
  es,
  it,
  pt,
  nl,
  pl,
};

export const availableLocaleCodes = [
  "fr",
  "en",
  "de",
  "es",
  "it",
  "pt",
  "nl",
  "pl",
] as const;

let currentLocale = localStorage.getItem("locale") ?? "fr";

if (!locales[currentLocale]) {
  currentLocale = "fr";
}

function get(obj: Dict, path: string, fallback: string = ""): string {
  return (
    path
      .split(".")
      .reduce(
        (acc: any, key: string) =>
          acc != null && (acc as any)[key] != null
            ? (acc as any)[key]
            : undefined,
        obj
      ) ?? fallback
  );
}

export const i18n = {
  t(key: string, fallback = ""): string {
    return (
      get(locales[currentLocale] as Dict, key, fallback) ||
      get(locales.en as Dict, key, fallback) ||
      fallback
    );
  },
  getLocale(): string {
    return currentLocale;
  },
  setLocale(locale: string): void {
    if (locales[locale]) {
      currentLocale = locale;
      localStorage.setItem("locale", locale);
      window.dispatchEvent(new Event("localechange"));
    }
  },
};
