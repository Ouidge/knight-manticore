#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { effectPresentation } from "./effect-normalization.mjs";

const EFFECT_CATALOG = JSON.parse(
  fs.readFileSync(new URL("./effect-catalog.json", import.meta.url), "utf8"),
);

const args = process.argv.slice(2);
const inputPath = args.find((argument) => !argument.startsWith("--"));
const vaultArgument = args.find((argument) => argument.startsWith("--vault="));

if (!inputPath || !vaultArgument || args.includes("--help") || args.includes("-h")) {
  console.log("Usage : node export-foundry-effects.mjs <export.json> --vault=<coffre>");
  process.exit(inputPath && vaultArgument ? 0 : 1);
}

const vaultDirectory = path.resolve(vaultArgument.slice("--vault=".length));
const publicEffectsDirectory = path.join(vaultDirectory, "__public", "aides de jeu", "effets");
const parsed = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
const actors = parsed?.format === "knight-pnj-bundle" && Array.isArray(parsed.actors) ? parsed.actors : [parsed];

const PLACEHOLDER_PATTERN = /^Description à compléter pour l’effet «[^»]+»\.\s*$/m;

function legacyTruncatedSummary(description, limit = 24) {
  const words = String(description ?? "").split(/\s+/).filter(Boolean);
  if (words.length <= limit) return description;
  return `${words.slice(0, limit).join(" ").replace(/[ ,;:]+$/u, "")}…`;
}

function safeFilename(value) {
  return String(value).replace(/[<>:"/\\|?*]/g, "-").trim().replace(/[. ]+$/g, "") || "Effet";
}

function collectEffects(node, pathKeys = [], result = new Set()) {
  if (!node || typeof node !== "object") return result;
  if (Array.isArray(node)) {
    for (const entry of node) collectEffects(entry, pathKeys, result);
    return result;
  }

  if (pathKeys.some((key) => /effet/i.test(key))) {
    for (const key of ["raw", "custom"]) {
      if (!Array.isArray(node[key])) continue;
      for (const effect of node[key]) {
        if (typeof effect === "string" && effect.trim()) result.add(effect.trim());
      }
    }
  }

  for (const [key, value] of Object.entries(node)) collectEffects(value, [...pathKeys, key], result);
  return result;
}

fs.mkdirSync(publicEffectsDirectory, { recursive: true });
const effects = new Set();
for (const actor of actors) collectEffects(actor, [], effects);

let created = 0;
let preserved = 0;
let updated = 0;
const processedNotes = new Set();
for (const rawEffect of effects) {
  const effect = effectPresentation(rawEffect);
  if (!effect) continue;
  if (!effect.isPublic || !effect.ruleUrl || !EFFECT_CATALOG[effect.catalogKey]) {
    console.warn(`Effet sans correspondance publique, aucune note créée : ${rawEffect}`);
    continue;
  }
  const noteTitle = effect.noteTitle ?? effect.baseLabel;
  const visibilityKey = `${effect.isPublic ? "public" : "private"}:${noteTitle}`;
  if (processedNotes.has(visibilityKey)) continue;
  processedNotes.add(visibilityKey);
  const destinationDirectory = publicEffectsDirectory;
  const notePath = path.join(destinationDirectory, `${safeFilename(noteTitle)}.md`);
  if (fs.existsSync(notePath)) {
    const original = fs.readFileSync(notePath, "utf8");
    let migrated = original.replace(/^(---\r?\n[\s\S]*?\r?\n---)\r?\n\s*>\s*desc::\s*/i, "$1\n\n");
    if (!/^ref::\s*\S+/m.test(migrated)) {
      migrated = `${migrated.trimEnd()}\n\n---\nref:: ${effect.ruleUrl}\n`;
    }
    const catalogSummary = EFFECT_CATALOG[effect.catalogKey]?.summary;
    if (catalogSummary && PLACEHOLDER_PATTERN.test(migrated)) {
      migrated = migrated.replace(PLACEHOLDER_PATTERN, catalogSummary);
    }
    const truncatedSummary = legacyTruncatedSummary(catalogSummary);
    if (catalogSummary && truncatedSummary !== catalogSummary && migrated.includes(truncatedSummary)) {
      migrated = migrated.replace(truncatedSummary, catalogSummary);
    }
    if (migrated !== original) {
      fs.writeFileSync(notePath, migrated, "utf8");
      console.log(`Effet actualisé : ${notePath}`);
      updated++;
    } else {
      preserved++;
    }
    continue;
  }
  const description = EFFECT_CATALOG[effect.catalogKey]?.summary;
  if (!description) {
    console.warn(`Effet public sans résumé, aucune note créée : ${rawEffect}`);
    continue;
  }
  const footer = `\n\n---\nref:: ${effect.ruleUrl}`;
  fs.writeFileSync(notePath, `---\ntype: adj\nsubtype: effet\n---\n\n${description}${footer}\n`, "utf8");
  console.log(`Effet créé : ${notePath}`);
  created++;
}

console.log(`${created} effet(s) créé(s), ${updated} fiche(s) actualisée(s), ${preserved} fiche(s) déjà à jour.`);
