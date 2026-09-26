import "i18next";
import type fr from "./fr.json";

// Type-checks every t("…") call against the keys of fr.json.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof fr;
    };
    keySeparator: false;
    nsSeparator: false;
    returnNull: false;
  }
}
