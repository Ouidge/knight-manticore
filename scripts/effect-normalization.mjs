import fs from "node:fs";

const EFFECT_CATALOG = JSON.parse(
  fs.readFileSync(new URL("./effect-catalog.json", import.meta.url), "utf8"),
);

const EFFECT_DEFINITIONS = {
  antianatheme: ["Anti-Anathème", false],
  antivehicule: ["Anti-véhicule", false],
  artillerie: ["Artillerie", false],
  assassin: ["Assassin", true],
  assistanceattaque: ["Assistance à l’attaque", false],
  barrage: ["Barrage", true],
  boost: ["Boost", true],
  bourreau: ["Bourreau", true],
  briserlaresilience: ["Briser la résilience", false],
  cadence: ["Cadence", true],
  cataclysme: ["Cataclysme", false],
  chargeur: ["Chargeur", true],
  chirurgical: ["Chirurgical", false],
  choc: ["Choc", true],
  conviction: ["Conviction", false],
  defense: ["Défense", true],
  degatscontinus: ["Dégâts continus", true],
  demoralisant: ["Démoralisant", false],
  designation: ["Désignation", false],
  destructeur: ["Destructeur", false],
  deuxmains: ["Deux mains", false],
  devastation: ["Dévastation", true],
  deviation: ["Déviation", false],
  dispersion: ["Dispersion", true],
  enchaine: ["En chaîne", false],
  esperance: ["Espérance", false],
  excellence: ["Excellence", false],
  exposer: ["Exposer", false],
  fatal: ["Fatal", false],
  frappeaportee: ["Frappe à portée", false],
  fureur: ["Fureur", false],
  ignorearmure: ["Ignore armure", false],
  ignorecdf: ["Ignore CdF", false],
  ignorechampdeforce: ["Ignore CdF", false],
  jumeleakimbo: ["Jumelé (akimbo)", false],
  jumeleambidextrie: ["Jumelé (ambidextrie)", false],
  leste: ["Lesté", false],
  lourd: ["Lourd", false],
  lumiere: ["Lumière", true],
  meurtrier: ["Meurtrier", false],
  mobile: ["Mobile", false],
  nonletal: ["Non létal", false],
  obliteration: ["Oblitération", false],
  orfevrerie: ["Orfèvrerie", false],
  parasitage: ["Parasitage", true],
  penetrant: ["Pénétrant", true],
  percearmure: ["Perce armure", true],
  pillage: ["Pillage", false],
  precision: ["Précision", false],
  reaction: ["Réaction", true],
  regularite: ["Régularité", false],
  rempart: ["Rempart", false],
  retribution: ["Rétribution", false],
  sensitif: ["Sensitif", false],
  silencieux: ["Silencieux", false],
  soumission: ["Soumission", false],
  sournois: ["Sournois", false],
  specialiste: ["Spécialiste", true],
  tenebricide: ["Ténébricide", false],
  terrifiant: ["Terrifiant", false],
  tirelite: ["Tir d’élite", false],
  tirenrafale: ["Tir en rafale", false],
  tirensecurite: ["Tir en sécurité", false],
  titanicide: ["Titanicide", false],
  ultraviolence: ["Ultraviolence", false],
  unemain: ["Une main", false],
};

const UNLINKED_LABELS = {
  anatheme: "Anathème",
  aucundegatsviolence: "Aucun dégât ni violence",
  boucliergrave: "Bouclier gravé",
  canonlong: "Canon long",
  electrifiee: "Choc 1 (Électrifiée)",
  faucheusegravee: "Faucheuse gravée",
  jumelle: "Jumelle",
  pointeurlaser: "Pointeur laser",
  soeur: "Sœur",
  surmesure: "Sur mesure",
};

export function normalizeEffectKey(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

export function effectSlug(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function effectPresentation(rawEffect) {
  const raw = String(rawEffect ?? "").trim();
  const match = raw.match(/^(.*?)(?:\s*)(-?\d+)$/);
  const base = (match?.[1] || raw).trim();
  const value = match?.[2] ?? "";
  const key = normalizeEffectKey(base);
  if (key === "aucundegatsviolence") return null;

  const definition = EFFECT_DEFINITIONS[key];
  const definitionCatalogKey = definition ? normalizeEffectKey(definition[0]) : key;
  const catalogKey = EFFECT_CATALOG[key] ? key : definitionCatalogKey;
  const catalogEntry = EFFECT_CATALOG[catalogKey];
  const noteTitle = definition?.[0] ?? catalogEntry?.title ?? null;
  const variable = definition?.[1] ?? catalogEntry?.variable ?? Boolean(value);
  const baseLabel = noteTitle ?? UNLINKED_LABELS[key] ?? base.replace(/^./u, (character) => character.toLocaleUpperCase("fr"));
  const label = `${baseLabel}${value ? ` ${value}` : ""}`;
  const ruleSlug = `${effectSlug(baseLabel)}${variable ? "-x" : ""}`;

  return {
    raw,
    key,
    catalogKey,
    value,
    variable,
    baseLabel,
    label,
    noteTitle,
    isPublic: Boolean(noteTitle),
    ruleUrl: catalogEntry?.url ?? (noteTitle ? `https://beta.knightools.fr/fr/effect/${ruleSlug}/` : null),
  };
}

export function effectWikiLink(rawEffect) {
  const effect = effectPresentation(rawEffect);
  if (!effect) return "";
  const target = effect.noteTitle ?? effect.baseLabel;
  return effect.label === target
    ? `[[${target}]]`
    : `[[${target}|${effect.label}]]`;
}
