#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { effectWikiLink } from "./effect-normalization.mjs";

const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith("--"));
const vaultArgument = args.find((arg) => arg.startsWith("--vault="));
const outputArgument = args.find((arg) => arg.startsWith("--output="));
const skipImage = args.includes("--no-image");

if (!inputPath || args.includes("--help") || args.includes("-h")) {
  console.log("Usage : node convert-foundry-knight-pnj.mjs <export.json> --vault=<coffre> [--output=<fiche.md>] [--no-image]");
  process.exit(inputPath ? 0 : 1);
}

const absoluteInput = path.resolve(inputPath);
const actor = JSON.parse(fs.readFileSync(absoluteInput, "utf8"));
if (actor.type !== "pnj") throw new Error(`L’acteur « ${actor.name ?? "sans nom"} » n’est pas de type pnj.`);

const vaultDirectory = path.resolve(vaultArgument?.slice("--vault=".length) || path.join(path.dirname(absoluteInput), "../.."));
const safeName = safeFilename(actor.name || "PNJ");
const outputPath = path.resolve(outputArgument?.slice("--output=".length) || path.join(vaultDirectory, "Personnages", "PNJ", `${safeName}.md`));
const portraitDirectory = path.join(vaultDirectory, "Assets", "pnj");
const system = actor.system ?? {};
const items = Array.isArray(actor.items) ? actor.items : [];

function safeFilename(value) {
  return String(value).replace(/[<>:"/\\|?*]/g, "-").trim().replace(/[. ]+$/g, "") || "PNJ";
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function htmlToMarkdown(html = "") {
  return String(html)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gis, "**$2**")
    .replace(/<(em|i)[^>]*>(.*?)<\/\1>/gis, "*$2*")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&nbsp;", " ").replaceAll("&rsquo;", "’").replaceAll("&lsquo;", "‘")
    .replaceAll("&ldquo;", "“").replaceAll("&rdquo;", "”").replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"").replaceAll("&eacute;", "é").replaceAll("&Eacute;", "É")
    .replaceAll("&agrave;", "à").replaceAll("&Agrave;", "À").replaceAll("&acirc;", "â")
    .replaceAll("&ecirc;", "ê").replaceAll("&egrave;", "è").replaceAll("&euml;", "ë")
    .replaceAll("&icirc;", "î").replaceAll("&iuml;", "ï").replaceAll("&ccedil;", "ç")
    .replaceAll("&ocirc;", "ô").replaceAll("&ucirc;", "û").replaceAll("&ugrave;", "ù")
    .replaceAll("&oelig;", "œ").replaceAll("&ndash;", "–").replaceAll("&laquo;", "«").replaceAll("&raquo;", "»")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\n{3,}/g, "\n\n").trim();
}

function escapeCell(value) {
  return String(value ?? "—").replaceAll("|", "\\|").replace(/\s*\n\s*/g, " ");
}

function effectLink(rawEffect) {
  return effectWikiLink(rawEffect);
}

function statBase(stat) {
  return number(stat?.base, number(stat?.max, number(stat?.value)));
}

function diceValue(stat = {}) {
  const dice = number(stat.dice);
  const fixed = number(stat.fixe);
  return `${dice ? `${dice}D6` : "0"}${fixed ? ` ${fixed > 0 ? "+" : "−"} ${Math.abs(fixed)}` : ""}`;
}

function generatedBlock() {
  const out = ["<!-- BEGIN FOUNDRY -->", "", "## Présentation", "", htmlToMarkdown(system.description) || "—"];
  const tactic = htmlToMarkdown(system.tactique);
  if (tactic) out.push("", "### Tactique", "", tactic);

  out.push("", "## Profil technique", "", "| Santé | Armure | Énergie | Champ de force | Défense | Réaction | Initiative |", "|---:|---:|---:|---:|---:|---:|---:|", `| ${statBase(system.sante)} | ${statBase(system.armure)} | ${statBase(system.energie)} | ${statBase(system.champDeForce)} | ${statBase(system.defense)} | ${statBase(system.reaction)} | ${system.initiative?.complet || `${number(system.initiative?.diceBase, number(system.initiative?.dice, 3))}D6`} |`);

  out.push("", "## Aspects", "", "| Aspect | Valeur | AE mineur | AE majeur |", "|---|---:|---:|---:|");
  for (const [key, label] of [["chair", "Chair"], ["bete", "Bête"], ["machine", "Machine"], ["dame", "Dame"], ["masque", "Masque"]]) {
    const aspect = system.aspects?.[key] ?? {};
    out.push(`| ${label} | ${number(aspect.value, number(aspect.base))} | ${number(aspect.ae?.mineur?.value)} | ${number(aspect.ae?.majeur?.value)} |`);
  }

  const weapons = items.filter((item) => item.type === "arme");
  if (weapons.length) {
    out.push("", "## Armes", "", "| Arme | Type | Portée | Dégâts | Violence | Effets |", "|---|---|---|---:|---:|---|");
    for (const weapon of weapons) {
      const effects = [...(weapon.system?.effets?.raw ?? []), ...(weapon.system?.effets?.custom ?? [])];
      const damage = `${diceValue(weapon.system?.degats)}${weapon.system?.degats?.addchair ? " + Chair" : ""}`;
      out.push(`| ${escapeCell(weapon.name)} | ${escapeCell(weapon.system?.type || "—")} | ${escapeCell(weapon.system?.portee || "—")} | ${escapeCell(damage)} | ${escapeCell(diceValue(weapon.system?.violence))} | ${escapeCell(effects.map(effectLink).join(", ") || "—")} |`);
      const description = htmlToMarkdown(weapon.system?.description);
      if (description) out.push("", `*${description}*`);
    }
  }

  const capabilities = items.filter((item) => item.type === "capacite");
  if (capabilities.length) {
    out.push("", "## Capacités", "", "| Capacité | Description |", "|---|---|");
    for (const capability of capabilities) out.push(`| **${escapeCell(capability.name)}** | ${escapeCell(htmlToMarkdown(capability.system?.description) || "—")} |`);
  }
  out.push("", "<!-- END FOUNDRY -->");
  return out.join("\n");
}

function replaceOrAppendGeneratedBlock(existing, block) {
  const pattern = /<!-- BEGIN FOUNDRY -->[\s\S]*?<!-- END FOUNDRY -->/;
  return pattern.test(existing) ? existing.replace(pattern, block) : `${existing.trimEnd()}\n\n${block}\n`;
}

function setFrontmatterField(markdown, key, yamlValue) {
  if (!markdown.startsWith("---\n")) return `---\n${key}: ${yamlValue}\n---\n\n${markdown}`;
  const end = markdown.indexOf("\n---", 4);
  if (end < 0) return markdown;
  const frontmatter = markdown.slice(4, end);
  const expression = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:.*$`, "m");
  const updated = expression.test(frontmatter) ? frontmatter.replace(expression, `${key}: ${yamlValue}`) : `${frontmatter.trimEnd()}\n${key}: ${yamlValue}`;
  return `---\n${updated}\n---${markdown.slice(end + 4)}`;
}

function newNote(portraitFileName) {
  return `---\ntype: pnj\nfaction: ""\nstatut: ""\nportrait: ${JSON.stringify(`[[${portraitFileName}]]`)}\n---\n\n#campagne\n\n# ${actor.name || "PNJ"}\n\n![[${portraitFileName}|200]]\n\n> [!note] Notes de campagne\n> Cette zone reste entièrement manuelle.\n`;
}

function imageExtension(url) {
  try {
    const extension = path.extname(new URL(url).pathname).toLowerCase();
    return /^[.](png|jpe?g|webp|gif|avif)$/.test(extension) ? extension : ".webp";
  } catch {
    return ".webp";
  }
}

async function downloadPortrait() {
  if (!actor.img || skipImage) return `${safeName}${imageExtension(actor.img || "")}`;
  const extension = imageExtension(actor.img);
  const fileName = `${safeName}${extension}`;
  fs.mkdirSync(portraitDirectory, { recursive: true });
  const response = await fetch(actor.img);
  if (!response.ok) throw new Error(`Téléchargement du portrait impossible (${response.status}) : ${actor.img}`);
  fs.writeFileSync(path.join(portraitDirectory, fileName), Buffer.from(await response.arrayBuffer()));
  return fileName;
}

const portraitFileName = await downloadPortrait();
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
let markdown = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : newNote(portraitFileName);
markdown = setFrontmatterField(markdown, "type", "pnj");
markdown = setFrontmatterField(markdown, "portrait", JSON.stringify(`[[${portraitFileName}]]`));
markdown = replaceOrAppendGeneratedBlock(markdown, generatedBlock());
fs.writeFileSync(outputPath, `${markdown.trimEnd()}\n`, "utf8");
console.log(`Fiche PNJ mise à jour : ${outputPath}`);
if (!skipImage) console.log(`Portrait remplacé : ${path.join(portraitDirectory, portraitFileName)}`);
