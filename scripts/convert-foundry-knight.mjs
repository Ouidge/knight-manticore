#!/usr/bin/env node

/**
 * Convertit un export JSON d'acteur du système Knight (Foundry VTT) en Markdown.
 *
 * Utilisation :
 *   node convert-foundry-knight.mjs export.json
 *   node convert-foundry-knight.mjs export.json fiche.md
 *
 * Sans second argument, le fichier est créé à côté du JSON.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const inputPath = process.argv[2];
if (!inputPath || ["-h", "--help"].includes(inputPath)) {
  console.log("Usage : node convert-foundry-knight.mjs <export.json> [fiche.md]");
  process.exit(inputPath ? 0 : 1);
}

const absoluteInput = path.resolve(inputPath);
const actor = JSON.parse(fs.readFileSync(absoluteInput, "utf8"));
const outputPath = path.resolve(
  process.argv[3] ?? path.join(path.dirname(absoluteInput), `${safeFilename(actor.name || "personnage")}.md`),
);

const DOMAIN_CHARACTERISTICS = {
  chair: ["deplacement", "force", "endurance"],
  bete: ["hargne", "combat", "instinct"],
  machine: ["tir", "savoir", "technique"],
  dame: ["aura", "parole", "sangFroid"],
  masque: ["discretion", "dexterite", "perception"],
};

const LABELS = {
  chair: "Chair",
  bete: "Bête",
  machine: "Machine",
  dame: "Dame",
  masque: "Masque",
  deplacement: "Déplacement",
  force: "Force",
  endurance: "Endurance",
  hargne: "Hargne",
  combat: "Combat",
  instinct: "Instinct",
  tir: "Tir",
  savoir: "Savoir",
  technique: "Technique",
  aura: "Aura",
  parole: "Parole",
  sangFroid: "Sang-froid",
  discretion: "Discrétion",
  dexterite: "Dextérité",
  perception: "Perception",
};

const system = actor.system ?? {};
const items = Array.isArray(actor.items) ? actor.items : [];
const xpHistory = Object.values(system.progression?.experience?.depense?.liste ?? {});

function safeFilename(value) {
  return String(value).replace(/[<>:"/\\|?*]/g, "-").trim() || "personnage";
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeCell(value) {
  return String(value ?? "—").replaceAll("|", "\\|").replace(/\s*\n\s*/g, " ");
}

function htmlToMarkdown(html = "") {
  return String(html)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gis, "**$2**")
    .replace(/<(em|i)[^>]*>(.*?)<\/\1>/gis, "*$2*")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&rsquo;", "’")
    .replaceAll("&lsquo;", "‘")
    .replaceAll("&ldquo;", "“")
    .replaceAll("&rdquo;", "”")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&eacute;", "é")
    .replaceAll("&Eacute;", "É")
    .replaceAll("&agrave;", "à")
    .replaceAll("&Agrave;", "À")
    .replaceAll("&ecirc;", "ê")
    .replaceAll("&egrave;", "è")
    .replaceAll("&ccedil;", "ç")
    .replaceAll("&ocirc;", "ô")
    .replaceAll("&ucirc;", "û")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeKey(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function progressionBonus(key) {
  const wanted = normalizeKey(key);
  return xpHistory
    .filter((entry) => normalizeKey(entry?.nom) === wanted)
    .reduce((sum, entry) => sum + number(entry?.bonus), 0);
}

function domainValue(domain) {
  return number(system.aspects?.[domain]?.base) + progressionBonus(domain);
}

function characteristicValue(domain, characteristic) {
  const base = number(system.aspects?.[domain]?.caracteristiques?.[characteristic]?.base);
  return base + progressionBonus(characteristic);
}

function selectedModuleLevel(item) {
  const nameLevel = item.name?.match(/(?:niv(?:eau)?\.?\s*)(\d+)/i)?.[1];
  return Math.max(number(nameLevel), number(item.system?.niveau?.value));
}

function moduleOd(item, domain, characteristic) {
  const level = selectedModuleLevel(item);
  const details = item.system?.niveau?.details ?? {};
  const selected = details[`n${level}`] ?? details[`n${item.system?.niveau?.value}`];
  return number(selected?.overdrives?.aspects?.[domain]?.[characteristic]);
}

function overdriveValue(domain, characteristic) {
  const base = number(
    system.aspects?.[domain]?.caracteristiques?.[characteristic]?.overdrive?.base,
  );
  const moduleValues = items
    .filter((item) => item.type === "module")
    .map((item) => moduleOd(item, domain, characteristic));
  return Math.max(base, ...moduleValues);
}

function maxCharacteristic(domain, withOverdrive = false) {
  return Math.max(
    ...DOMAIN_CHARACTERISTICS[domain].map((characteristic) =>
      characteristicValue(domain, characteristic) +
      (withOverdrive ? overdriveValue(domain, characteristic) : 0),
    ),
  );
}

function traitModifier(type, path) {
  return items
    .filter((item) => item.type === type && item.system?.type === "standard")
    .reduce((sum, item) => {
      let value = item.system?.[type === "avantage" ? "bonus" : "malus"];
      for (const key of path) value = value?.[key];
      return sum + number(value);
    }, 0);
}

function actorModifier(stat) {
  const bonuses = Object.values(system[stat]?.bonus ?? {}).reduce(
    (sum, value) => sum + number(value),
    0,
  );
  const penalties = Object.values(system[stat]?.malus ?? {}).reduce(
    (sum, value) => sum + number(value),
    0,
  );
  return bonuses - penalties;
}

function weaponFlatModifier(statistic) {
  let total = 0;

  for (const item of items.filter((entry) => entry.type === "arme" && entry.system?.equipped)) {
    const data = item.system ?? {};
    let effects = [];

    if (data.type === "contact") {
      if (!data.options2mains?.has || data.options2mains?.actuel === "1main") {
        effects.push(...(data.effets?.raw ?? []), ...(data.effets?.custom ?? []));
      } else {
        effects.push(...(data.effets2mains?.raw ?? []), ...(data.effets2mains?.custom ?? []));
      }
      effects.push(
        ...(data.structurelles?.raw ?? []),
        ...(data.structurelles?.custom ?? []),
        ...(data.ornementales?.raw ?? []),
        ...(data.ornementales?.custom ?? []),
      );
    } else if (data.type === "distance") {
      effects.push(
        ...(data.effets?.raw ?? []),
        ...(data.effets?.custom ?? []),
        ...(data.distance?.raw ?? []),
        ...(data.distance?.custom ?? []),
      );
      if (data.optionsmunitions?.has) {
        const ammunition = data.optionsmunitions?.liste?.[data.optionsmunitions?.actuel] ?? {};
        effects.push(...(ammunition.raw ?? []), ...(ammunition.custom ?? []));
      }
    }

    for (const effect of effects) {
      if (typeof effect === "object" && effect?.other?.cdf && statistic === "cdf") {
        total += number(effect.other.cdf);
        continue;
      }
      const [key, rawValue] = String(effect).split(" ");
      const value = number(rawValue);
      if (statistic === "defense") {
        if (key === "defense") total += value;
        if (key === "boucliergrave") total += 1;
        if (key === "massive") total -= 1;
      }
      if (statistic === "reaction") {
        if (key === "reaction") total += value;
        if (key === "protectionarme") total += 2;
      }
      if (statistic === "cdf") {
        if (key === "cdf") total += value;
        if (key === "armuregravee") total += 2;
      }
    }
  }

  return total;
}

function styleModifiers(style = "standard") {
  const result = { defense: 0, reaction: 0 };
  if (style === "defensif") result.defense += 2;
  if (style === "acouvert") result.reaction += 2;
  if (["agressif", "puissant"].includes(style)) {
    result.defense -= 2;
    result.reaction -= 2;
  }
  return result;
}

function isFree(value) {
  return value === true || String(value).toLowerCase() === "true";
}

function experienceSpent() {
  return xpHistory.reduce((sum, entry) => sum + number(entry?.cout), 0);
}

function glorySpent() {
  let spent = 0;

  for (const item of items) {
    if (item.type === "armure") {
      const longbow = item.system?.evolutions?.special?.longbow ?? {};
      for (const evolution of Object.values(longbow)) {
        if (evolution?.applied && !isFree(evolution?.gratuit)) {
          spent += number(evolution?.value);
        }
      }
      continue;
    }

    if (["arme", "cyberware"].includes(item.type)) {
      if (!isFree(item.system?.gratuit)) spent += number(item.system?.prix);
      continue;
    }

    if (item.type !== "module" || item.system?.isLion) continue;

    const maximumLevel = number(item.system?.niveau?.value);
    for (let level = 1; level <= maximumLevel; level += 1) {
      const data = item.system?.niveau?.details?.[`n${level}`] ?? {};
      if (!data.ignore && !isFree(data.gratuit)) spent += number(data.prix);
    }
  }

  for (const entry of Object.values(system.progression?.gloire?.depense?.autre ?? {})) {
    if (!isFree(entry?.gratuit)) spent += number(entry?.cout);
  }

  return spent;
}

function formatDice(stat = {}) {
  const dice = number(stat.dice);
  const fixed = number(stat.fixe);
  if (!dice && !fixed) return "—";
  return `${dice ? `${dice}D6` : ""}${dice && fixed ? " + " : ""}${fixed || ""}`;
}

function weaponBaseName(name = "") {
  return name.replace(/\s+-\s+(contact|tir|missiles?|roquettes?)$/i, "").trim();
}

function slugify(value = "") {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function weaponMode(name = "") {
  return name.match(/\s+-\s+(.+)$/)?.[1] ?? "Attaque";
}

function weaponUrl(name) {
  return `https://knight-jdr-systeme.fr/fr/weapon/${slugify(weaponBaseName(name))}/`;
}

function armorUrl(name) {
  return `https://knight-jdr-systeme.fr/fr/armour/${slugify(name)}/`;
}

function rangeAbbreviation(range = "") {
  const normalized = normalizeKey(range);
  const abbreviations = {
    contact: "C",
    distancemelee: "DM",
    courte: "CT",
    moyenne: "M",
    longue: "L",
    lointaine: "LT",
  };
  return abbreviations[normalized] ?? String(range || "—").toUpperCase();
}

function checkBoxes(count) {
  return Array.from(
    { length: Math.max(0, Math.min(number(count), 20)) },
    () => '<i class="knight-check-box" aria-hidden="true"></i>',
  ).join("");
}

function moduleUrl(name) {
  return `https://knight-jdr-systeme.fr/fr/module/${slugify(moduleFamily(name))}/`;
}

function rangeHelpUrl(range) {
  return `https://ouidge.github.io/knight-manticore/%F0%9F%93%90-aides-de-jeu/port%C3%A9es/${range}`;
}

function grenadeModuleBonus(grenadeKey, statistic) {
  return items
    .filter((item) => item.type === "module")
    .reduce((sum, item) => {
      const data = selectedModuleData(item);
      if (!data.bonus?.has || !data.bonus?.grenades?.has) return sum;
      return sum + number(data.bonus.grenades?.liste?.[grenadeKey]?.[statistic]?.dice);
    }, 0);
}

function damageViolenceBonuses(effects = [], extra = {}) {
  const bonuses = [];

  for (const effect of effects) {
    if (typeof effect !== "string") continue;
    const normalized = normalizeKey(effect);
    const continuous = effect.match(/d[eé]g[aâ]ts\s*continus\s+(\d+)/i);

    if (normalized === "faucheusegravee") bonuses.push("D +1D6 (Faucheuse gravée)");
    if (normalized === "meurtrier") bonuses.push("D +2D6 (Meurtrier)");
    if (normalized === "destructeur") bonuses.push("D +2D6 (Destructeur)");
    if (normalized === "ultraviolence") {
      bonuses.push("V +2D6 (bande, Chair < 10)");
    }
    if (normalized === "fureur") bonuses.push("V +4D6 (bande, Chair > 10)");
    if (continuous) bonuses.push(`D continus ${continuous[1]}`);
  }

  const extraDamage = number(extra.damage);
  const extraViolence = number(extra.violence);
  if (extraDamage || extraViolence) {
    const values = [];
    if (extraDamage) values.push(`D +${extraDamage}D6`);
    if (extraViolence) values.push(`V +${extraViolence}D6`);
    bonuses.push(`${values.join(" / ")} (module Grenades intelligentes)`);
  }

  return [...new Set(bonuses)].join(" · ") || "—";
}

function arsenalSection(groups) {
  const grenades = system.combat?.grenades ?? {};
  if (!groups.size && number(grenades.quantity?.max) <= 0) return "";
  const lines = [
    '<h3 class="knight-equipment-title">Arsenal</h3>',
    '<table class="knight-arsenal-table"><thead><tr><th>Arme</th><th>Portée</th><th>Dégâts</th><th>Violence</th><th>Bonus D/V</th><th>Effets</th></tr></thead><tbody>',
  ];

  for (const [baseName, group] of groups) {
    const modes = group
      .map((weapon) => weaponMode(weapon.name))
      .filter((mode) => mode !== "Attaque");
    const modesLabel = modes.length > 1
      ? `<small class="knight-weapon-mode">${escapeHtml(modes.join(" / "))}</small>`
      : "";

    for (const [index, weapon] of group.entries()) {
      const effects = [
        ...(weapon.system?.effets?.raw ?? []),
        ...(weapon.system?.effets?.custom ?? []),
        ...(weapon.system?.distance?.raw ?? []),
        ...(weapon.system?.distance?.custom ?? []),
        ...(weapon.system?.structurelles?.raw ?? []),
        ...(weapon.system?.structurelles?.custom ?? []),
        ...(weapon.system?.ornementales?.raw ?? []),
        ...(weapon.system?.ornementales?.custom ?? []),
      ];
      const mode = weaponMode(weapon.name);
      const range = rangeAbbreviation(weapon.system?.portee);
      const rangeAndMode = mode === "Attaque" ? range : `${mode} · ${range}`;
      lines.push(
        `<tr>${index === 0 ? `<td rowspan="${group.length}"><a href="${weaponUrl(baseName)}">${escapeHtml(baseName)} ↗</a>${modesLabel}</td>` : ""}<td>${escapeHtml(rangeAndMode)}</td><td>${escapeHtml(formatDice(weapon.system?.degats))}</td><td>${escapeHtml(formatDice(weapon.system?.violence))}</td><td class="knight-dv-bonus">${escapeHtml(damageViolenceBonuses(effects))}</td><td>${escapeHtml(effects.join(", ") || "—")}</td></tr>`,
      );
    }
  }

  const grenadeLabels = {
    antiblindage: "Grenade antiblindage",
    explosive: "Grenade explosive",
    flashbang: "Grenade flashbang",
    iem: "Grenade IEM",
    shrapnel: "Grenade shrapnel",
  };
  if (number(grenades.quantity?.max) > 0) {
    for (const [index, [key, grenade]] of Object.entries(grenades.liste ?? {}).entries()) {
      const effects = [
        ...(grenade.effets?.raw ?? []),
        ...(grenade.effets?.custom ?? []),
      ];
      const moduleBonus = {
        damage: grenadeModuleBonus(key, "degats"),
        violence: grenadeModuleBonus(key, "violence"),
      };
      lines.push(
        `<tr class="knight-grenade-row${index === 0 ? " knight-first-grenade" : ""}"><td><a href="https://knight-jdr-systeme.fr/fr/weapon/grenade-intelligente/">${escapeHtml(grenade.custom ? grenade.label : grenadeLabels[key] ?? `Grenade ${key}`)} ↗</a></td><td>CT</td><td>${escapeHtml(formatDice(grenade.degats))}</td><td>${escapeHtml(formatDice(grenade.violence))}</td><td class="knight-dv-bonus">${escapeHtml(damageViolenceBonuses(effects, moduleBonus))}</td><td>${escapeHtml(effects.join(", ") || "—")}</td></tr>`,
      );
    }
  }

  lines.push("</tbody></table>");
  lines.push(
    `<p class="knight-range-legend"><strong>Portées :</strong> <a href="${rangeHelpUrl("contact")}"><strong>C — Contact</strong> : distance de mêlée</a> · <a href="${rangeHelpUrl("courte")}"><strong>CT — Courte</strong> : 2–15 m</a> · <a href="${rangeHelpUrl("moyenne")}"><strong>M — Moyenne</strong> : 15–50 m</a> · <a href="${rangeHelpUrl("longue")}"><strong>L — Longue</strong> : 50–300 m</a> · <a href="${rangeHelpUrl("lointaine")}"><strong>LT — Lointaine</strong> : plus de 300 m</a></p>`,
  );
  return lines.join("\n");
}

function meaningfulItem(item) {
  const description = htmlToMarkdown(item.system?.description);
  if (description) return true;
  if (item.type === "arme") {
    return Boolean(
      number(item.system?.degats?.dice) ||
        number(item.system?.degats?.fixe) ||
        number(item.system?.violence?.dice) ||
        number(item.system?.violence?.fixe),
    );
  }
  return !["Avantage", "Inconvénient", "Arme", "Capacité héroïque"].includes(item.name);
}

function mechanicalSummary(item) {
  const source = item.type === "avantage" ? item.system?.bonus : item.system?.malus;
  if (!source) return "";
  const effects = [];
  const sign = item.type === "avantage" ? "+" : "−";
  if (number(source.sante)) effects.push(`${sign}${number(source.sante)} PS`);
  if (number(source.espoir)) effects.push(`${sign}${number(source.espoir)} PEs`);
  if (number(source.initiative?.dice)) {
    effects.push(`${sign}${number(source.initiative.dice)}D6 en initiative`);
  }
  if (number(source.initiative?.fixe)) {
    effects.push(`${sign}${number(source.initiative.fixe)} en initiative`);
  }
  return effects.join(" ; ");
}

function traitSection(title, selectedItems) {
  if (!selectedItems.length) return "";
  const content = selectedItems
    .map((item) => {
      const description = htmlToMarkdown(item.system?.description);
      const effect = mechanicalSummary(item);
      return [
        '<section class="knight-trait">',
        `<h3>${escapeHtml(item.name)}</h3>`,
        `<div class="knight-trait-description">${markdownishHtml(description || effect || "—")}</div>`,
        "</section>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
  return `<section class="knight-traits"><h2>${escapeHtml(title)}</h2>\n${content}\n</section>`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function markdownishHtml(value = "") {
  return escapeHtml(value)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}

function moduleFamily(name = "") {
  return name
    .replace(/\s*-?\s*niv(?:eau)?\.?\s*\d+\s*$/i, "")
    .trim()
    .toLocaleLowerCase("fr");
}

function latestModules(moduleItems) {
  const selected = new Map();
  for (const item of moduleItems) {
    const key = moduleFamily(item.name);
    const previous = selected.get(key);
    if (!previous || selectedModuleLevel(item) > selectedModuleLevel(previous)) {
      selected.set(key, item);
    }
  }
  return [...selected.values()];
}

function selectedModuleData(item) {
  const level = selectedModuleLevel(item);
  const details = item.system?.niveau?.details ?? {};
  return details[`n${level}`] ?? details[`n${item.system?.niveau?.value}`] ?? {};
}

function isOverdriveModule(item) {
  const overdrives = selectedModuleData(item).overdrives;
  if (overdrives?.has) return true;
  return Object.values(overdrives?.aspects ?? {}).some((characteristics) =>
    Object.values(characteristics ?? {}).some((value) => number(value) > 0),
  );
}

function moduleMechanicalSummary(item) {
  const data = selectedModuleData(item);
  const details = [];

  if (data.permanent) details.push("Permanent");
  else {
    const energy = number(data.energie?.tour?.value);
    if (energy) details.push(`${energy} PE`);
    if (data.activation && data.activation !== "aucune") {
      details.push(`activation : ${LABELS[data.activation] ?? data.activation}`);
    }
    if (
      data.energie?.tour?.label &&
      !["Tour", "Aucune"].includes(data.energie.tour.label)
    ) {
      details.push(`durée : ${data.energie.tour.label}`);
    }
  }

  if (data.portee && data.portee !== "personnelle") details.push(`portée : ${data.portee}`);

  const bonuses = data.bonus ?? {};
  for (const [key, label] of [
    ["sante", "PS"],
    ["armure", "PA"],
    ["champDeForce", "CdF"],
    ["energie", "PE max"],
  ]) {
    if (bonuses[key]?.has && number(bonuses[key]?.value)) {
      details.push(`+${number(bonuses[key].value)} ${label}`);
    }
  }

  const overdrives = data.overdrives?.aspects ?? {};
  for (const [domain, characteristics] of Object.entries(DOMAIN_CHARACTERISTICS)) {
    for (const characteristic of characteristics) {
      const value = number(overdrives?.[domain]?.[characteristic]);
      if (value) details.push(`${LABELS[characteristic]} : OD ${value}`);
    }
  }

  if (data.bonus?.grenades?.has) {
    const grenadeBonuses = [];
    for (const [key, grenade] of Object.entries(data.bonus.grenades.liste ?? {})) {
      const damage = number(grenade.degats?.dice);
      const violence = number(grenade.violence?.dice);
      if (!damage && !violence) continue;
      const label = {
        antiblindage: "antiblindage",
        explosive: "explosive",
        shrapnel: "shrapnel",
      }[key] ?? key;
      grenadeBonuses.push(`${label} : +${damage}D6 dégâts, +${violence}D6 violence`);
    }
    if (grenadeBonuses.length) details.push(`Grenades ${grenadeBonuses.join(" ; ")}`);
  }

  const effects = [
    ...(data.arme?.effets?.raw ?? []),
    ...(data.arme?.effets?.custom ?? []),
    ...(data.effets?.raw ?? []),
    ...(data.effets?.custom ?? []),
  ];
  if (effects.length) {
    const formattedEffects = effects.map((effect) => {
      const [key, value] = String(effect).split(" ");
      if (key === "defense") return `Défense +${value}`;
      if (key === "reaction") return `Réaction +${value}`;
      if (key === "designation") return "Désignation";
      return effect;
    });
    details.push(`Effets : ${formattedEffects.join(", ")}`);
  }

  return details.join(" ; ") || "Voir la description du module";
}

const armor = items.find((item) => item.type === "armure");
const minorMotivations = items.filter((item) => item.type === "motivationMineure");
const personalAdvantages = items.filter(
  (item) => item.type === "avantage" && item.system?.type !== "ia" && meaningfulItem(item),
);
const personalDisadvantages = items.filter(
  (item) => item.type === "inconvenient" && item.system?.type !== "ia" && meaningfulItem(item),
);
const iaAdvantages = items.filter(
  (item) => item.type === "avantage" && item.system?.type === "ia" && meaningfulItem(item),
);
const iaDisadvantages = items.filter(
  (item) => item.type === "inconvenient" && item.system?.type === "ia" && meaningfulItem(item),
);
const injuries = items.filter((item) => item.type === "blessure" && meaningfulItem(item));
const weapons = items.filter((item) => item.type === "arme" && meaningfulItem(item));
const modules = latestModules(items.filter((item) => item.type === "module"));
const displayedModules = modules.filter((item) => !isOverdriveModule(item));

const weaponGroups = new Map();
for (const weapon of weapons) {
  const baseName = weaponBaseName(weapon.name);
  const group = weaponGroups.get(baseName) ?? [];
  group.push(weapon);
  weaponGroups.set(baseName, group);
}

const progression = system.progression ?? {};
const gloryTotal = number(progression.gloire?.total);
const experienceTotal = number(progression.experience?.total);
const gloryRemaining = gloryTotal - glorySpent();
const experienceRemaining = experienceTotal - experienceSpent();
const isKraken = Boolean(system.options?.kraken);
const armorWorn = system.wear === "armure" || system.wear === "ascension";
const combatStyle = styleModifiers(system.combat?.style);

const healthMaximum = Math.max(
  0,
  (isKraken ? 8 : 6) * maxCharacteristic("chair") +
    10 +
    actorModifier("sante") +
    traitModifier("avantage", ["sante"]) -
    traitModifier("inconvenient", ["sante"]),
);
const hopeMaximum = Math.max(
  0,
  50 +
    number(armorWorn ? armor?.system?.espoir?.value : 0) +
    actorModifier("espoir") +
    traitModifier("avantage", ["espoir"]) -
    traitModifier("inconvenient", ["espoir"]),
);

function defenseFor(withArmor) {
  return Math.max(
    0,
    maxCharacteristic("bete", withArmor) +
      (isKraken ? 1 : 0) +
      actorModifier("defense") +
      weaponFlatModifier("defense") +
      combatStyle.defense,
  );
}

function reactionFor(withArmor) {
  return Math.max(
    0,
    maxCharacteristic("machine", withArmor) +
      (isKraken ? 1 : 0) +
      actorModifier("reaction") +
      weaponFlatModifier("reaction") +
      combatStyle.reaction,
  );
}

const initiativeDice = Math.max(
  0,
  number(system.initiative?.diceBase, 3) +
    items
      .filter((item) => item.type === "avantage")
      .reduce((sum, item) => sum + number(item.system?.bonus?.initiative?.dice), 0) -
    items
      .filter((item) => item.type === "inconvenient")
      .reduce((sum, item) => sum + number(item.system?.malus?.initiative?.dice), 0),
);
function initiativeFixedFor(withArmor) {
  return Math.max(
    0,
    maxCharacteristic("masque", withArmor) +
      actorModifier("initiative") +
      traitModifier("avantage", ["initiative", "fixe"]) -
      traitModifier("inconvenient", ["initiative", "fixe"]),
  );
}

const armorInitiativeFixed = initiativeFixedFor(true);
const guardianInitiativeFixed = initiativeFixedFor(false);
const armorDefense = defenseFor(true);
const guardianDefense = defenseFor(false);
const armorReaction = reactionFor(true);
const guardianReaction = reactionFor(false);
const forceField = number(armorWorn ? armor?.system?.champDeForce?.base : system.equipements?.guardian?.champDeForce?.base) + weaponFlatModifier("cdf");

const out = [];
out.push("---");
out.push(`title: ${JSON.stringify(actor.name || "Personnage")}`);
out.push("type: pj");
out.push(`archetype: ${JSON.stringify(system.archetype ?? "")}`);
out.push(`blason: ${JSON.stringify(system.blason ?? "")}`);
out.push(`section: ${JSON.stringify(system.section ?? "")}`);
out.push(`metaarmure: ${JSON.stringify(armor?.name ?? system.metaarmure ?? "")}`);
out.push("cssclasses:");
out.push("  - fiche-personnage");
out.push("---\n");
out.push('<div class="knight-sheet-marker" aria-hidden="true"></div>\n');
out.push('<section class="knight-identity">');
out.push('<div class="knight-profile">');
out.push('<div class="knight-title-line">');
out.push(`<h1>${escapeHtml(actor.name || "Personnage")}</h1>`);
const blasonLink = system.blason ? `[[${String(system.blason).replace(/[\[\]]/g, "")}]]` : "—";
out.push(
  `<p class="knight-profile-lead"><strong>${escapeHtml(system.archetype || "Archétype inconnu")}</strong> · Section <strong>${escapeHtml(system.section || "—")}</strong> · Blason <strong>${blasonLink}</strong></p>`,
);
out.push("</div>");
out.push('<dl class="knight-profile-details">');
out.push(`<div><dt>Haut fait</dt><dd>${escapeHtml(system.hautFait || "—")}</dd></div>`);
const armorName = armor?.name || system.metaarmure || "";
out.push(
  `<div><dt>Méta-armure</dt><dd>${armorName ? `<a href="${armorUrl(armorName)}">${escapeHtml(armorName)} ↗</a>` : "—"}</dd></div>`,
);
out.push(
  `<div class="knight-major-motivation"><dt>Motivation majeure</dt><dd>${escapeHtml(htmlToMarkdown(system.motivations?.majeure) || "—")}</dd></div>`,
);
if (minorMotivations.length) {
  out.push('<div class="knight-minor-motivations"><dt>Motivations mineures</dt><dd><ul>');
  for (const motivation of minorMotivations) {
    out.push(`<li>${escapeHtml(htmlToMarkdown(motivation.system?.description) || "—")}</li>`);
  }
  out.push("</ul></dd></div>");
}
if (personalAdvantages.length) {
  out.push(`<div><dt>Avantages</dt><dd>${escapeHtml(personalAdvantages.map((item) => item.name).join(" • "))}</dd></div>`);
}
if (personalDisadvantages.length) {
  out.push(`<div><dt>Inconvénients</dt><dd>${escapeHtml(personalDisadvantages.map((item) => item.name).join(" • "))}</dd></div>`);
}
out.push("</dl>");
out.push("</div>");
out.push('<aside class="knight-profile-side">');
if (actor.img) {
  out.push(
    `<div class="knight-portrait"><img src="${escapeHtml(actor.img)}" alt="Portrait de ${escapeHtml(actor.name)}"></div>`,
  );
}
out.push('<div class="knight-progression" aria-label="Progression">');
out.push(`<span><strong>PG</strong> ${gloryRemaining} / ${gloryTotal}</span>`);
out.push(`<span><strong>PX</strong> ${experienceRemaining} / ${experienceTotal}</span>`);
out.push("</div>");
out.push("</aside>");
out.push("</section>");

out.push("\n");
out.push('<div class="knight-combat-grid">');
out.push('<div class="knight-stat-table">');
out.push('<div class="knight-stat-cells">');
out.push(`<div><span>PS</span><strong>${healthMaximum}</strong></div>`);
out.push(`<div><span>PEs</span><strong>${number(system.espoir?.value)} / ${hopeMaximum}</strong></div>`);
out.push(`<div><span>PH</span><strong>${number(system.heroisme?.value)} / ${number(system.heroisme?.max)}</strong></div>`);
out.push(`<div><span>PA</span><strong>${number(armor?.system?.armure?.base) || "—"}</strong></div>`);
out.push(`<div><span>PE</span><strong>${number(armor?.system?.energie?.base) || "—"}</strong></div>`);
out.push(`<div><span>CdF</span><strong>${forceField}</strong></div>`);
out.push("</div>");
out.push("</div>");
out.push('<div class="knight-stat-table">');
const armorInitiative = `${initiativeDice}D6${armorInitiativeFixed ? ` + ${armorInitiativeFixed}` : ""}`;
const guardianInitiative = `${initiativeDice}D6${guardianInitiativeFixed ? ` + ${guardianInitiativeFixed}` : ""}`;
out.push('<div class="knight-stat-cells knight-combat-cells">');
out.push(`<div><span>Défense <small>MA / G</small></span><strong>${armorDefense} / ${guardianDefense}</strong></div>`);
out.push(`<div><span>Réaction <small>MA / G</small></span><strong>${armorReaction} / ${guardianReaction}</strong></div>`);
out.push(`<div><span>Initiative</span><strong>${armorInitiative === guardianInitiative ? armorInitiative : `${armorInitiative} / ${guardianInitiative}`}</strong></div>`);
out.push("</div>");
out.push("</div>");
out.push("</div>");

out.push("\n## Aspects, caractéristiques et overdrives\n");
out.push('<div class="knight-domain-grid">');
for (const [domain, characteristics] of Object.entries(DOMAIN_CHARACTERISTICS)) {
  out.push('<section class="knight-domain">');
  out.push(`<h3>${escapeHtml(LABELS[domain])} — ${domainValue(domain)}</h3>`);
  out.push('<div class="knight-characteristics">');
  for (const characteristic of characteristics) {
    out.push(
      `<div class="knight-characteristic"><span>${escapeHtml(LABELS[characteristic])}</span><strong>${characteristicValue(domain, characteristic)}</strong><small>OD ${overdriveValue(domain, characteristic)}</small></div>`,
    );
  }
  out.push("</div></section>");
}
out.push("</div>");

const nods = system.combat?.nods ?? {};
const availableNods = [
  ["Soin", nods.soin],
  ["Armure", nods.armure],
  ["Énergie", nods.energie],
].filter(([, nod]) => number(nod?.max) > 0);
const grenadeMaximum = number(system.combat?.grenades?.quantity?.max);
if (availableNods.length || grenadeMaximum > 0) {
  out.push('<div class="knight-nods"><strong>NODs</strong>');
  for (const [label, nod] of availableNods) {
    out.push(`<span>${label} <b>${escapeHtml(nod.dices || "—")}</b><em class="knight-counter" aria-label="${number(nod.max)} utilisations">${checkBoxes(nod.max)}</em></span>`);
  }
  if (grenadeMaximum > 0) {
    out.push(`<span class="knight-grenade-counter">Grenades <em class="knight-counter" aria-label="${grenadeMaximum} grenades">${checkBoxes(grenadeMaximum)}</em></span>`);
  }
  out.push("</div>");
}

if (personalAdvantages.length) out.push(`\n${traitSection("Avantages", personalAdvantages)}`);
if (personalDisadvantages.length) out.push(`\n${traitSection("Inconvénients", personalDisadvantages)}`);

if (weaponGroups.size || grenadeMaximum > 0) out.push(`\n${arsenalSection(weaponGroups)}\n`);

out.push('\n<div class="knight-page-two" aria-hidden="true"></div>');
out.push(`\n## Méta-armure — ${armor?.name || system.metaarmure || "—"}\n`);
if (armor?.system?.description) {
  out.push(
    `<div class="screen-only">${markdownishHtml(htmlToMarkdown(armor.system.description).split("\n\n")[0])}</div>\n`,
  );
}

if (displayedModules.length) {
  out.push('<h3 class="knight-equipment-title">Modules</h3>\n');
  out.push("| Module | Niveau | Effets essentiels |");
  out.push("|---|:---:|---|");
  for (const module of displayedModules) {
    const level = selectedModuleLevel(module);
    const name = moduleFamily(module.name).replace(/^./u, (c) => c.toLocaleUpperCase("fr"));
    out.push(
      `| [${escapeCell(name)} ↗](${moduleUrl(module.name)}) | ${level || "—"} | ${escapeCell(moduleMechanicalSummary(module))} |`,
    );
  }
}

const ia = system.equipements?.ia ?? {};
if (ia.surnom || ia.code || ia.caractere || iaAdvantages.length || iaDisadvantages.length) {
  out.push(`\n### IA de la méta-armure — ${ia.surnom || "Sans surnom"}\n`);
  out.push(`**Nom de code :** ${ia.code || "—"}\n`);
  if (ia.caractere) {
    out.push(
      `<blockquote class="knight-ia-character">${markdownishHtml(htmlToMarkdown(ia.caractere))}</blockquote>\n`,
    );
  }
  if (iaAdvantages.length) out.push(`\n${traitSection("Avantages de l’IA", iaAdvantages)}`);
  if (iaDisadvantages.length) out.push(`\n${traitSection("Inconvénients de l’IA", iaDisadvantages)}`);
}

if (injuries.length) {
  out.push("\n## Blessures\n");
  for (const injury of injuries) {
    out.push(`### ${injury.name}\n\n${htmlToMarkdown(injury.system?.description) || "—"}\n`);
  }
}

out.push("\n---");
out.push(`*Fiche générée depuis un export Foundry VTT — système Knight ${actor._stats?.systemVersion ?? "version inconnue"}.*`);

fs.writeFileSync(outputPath, `${out.join("\n").replace(/\n{4,}/g, "\n\n\n")}\n`, "utf8");
console.log(`Fiche générée : ${outputPath}`);

// Permet aussi d'importer ce fichier depuis un autre script.
export { htmlToMarkdown, slugify, weaponBaseName, weaponUrl };
