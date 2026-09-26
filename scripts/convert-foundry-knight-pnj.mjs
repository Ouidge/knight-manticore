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
if (!["pnj", "creature"].includes(actor.type)) throw new Error(`L’acteur « ${actor.name ?? "sans nom"} » n’est ni un PNJ ni une créature.`);
const isCreature = actor.type === "creature";

const vaultDirectory = path.resolve(vaultArgument?.slice("--vault=".length) || path.join(path.dirname(absoluteInput), "../.."));
const safeName = safeFilename(actor.name || "PNJ");
const outputPath = path.resolve(outputArgument?.slice("--output=".length) || path.join(vaultDirectory, "Acteurs", isCreature ? "Bestiaire" : "PNJ", `${safeName}.md`));
const portraitDirectory = path.join(vaultDirectory, "Assets", isCreature ? "bestiaire" : "pnj");
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const out = ["<!-- BEGIN FOUNDRY -->", "", "## Profil technique", "", "| Santé | Armure | Énergie | Champ de force | Défense | Réaction | Initiative |", "|---:|---:|---:|---:|---:|---:|---:|", `| ${statBase(system.sante)} | ${statBase(system.armure)} | ${statBase(system.energie)} | ${statBase(system.champDeForce)} | ${statBase(system.defense)} | ${statBase(system.reaction)} | ${system.initiative?.complet || `${number(system.initiative?.diceBase, number(system.initiative?.dice, 3))}D6`} |`];

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

function generatedPresentationBlock() {
  const description = String(system.description || "").trim() || "<p>—</p>";
  const tactic = String(system.tactique || "").trim() || "<p>—</p>";
  const lines = [
    "<!-- BEGIN PNJ PRESENTATION -->",
    "",
    '<div class="pnj-presentation-grid">',
    '<section class="pnj-presentation-card">',
    "<h2>Présentation</h2>",
    description,
    "</section>",
    '<aside class="pnj-tactique-card">',
    "<h2>Tactique</h2>",
    tactic,
    "</aside>",
    "</div>",
    "",
    "<!-- END PNJ PRESENTATION -->",
  ];
  return lines.join("\n");
}

function ensurePresentation(markdown, presentation) {
  let updated = markdown.replace(/\n?<!-- BEGIN PNJ PRESENTATION -->[\s\S]*?<!-- END PNJ PRESENTATION -->\n?/g, "\n");
  const dataviewEnd = "<!-- END PNJ DATAVIEW -->";
  if (updated.includes(dataviewEnd)) {
    updated = updated.replace(dataviewEnd, `${dataviewEnd}\n\n${presentation}`);
  } else {
    updated = `${updated.trimEnd()}\n\n${presentation}\n`;
  }
  return updated.replace(/\n{3,}/g, "\n\n");
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ""));
}

function appendStatblockTraits(lines, key, entries) {
  if (!entries.length) return;
  lines.push(`${key}:`);
  for (const entry of entries) {
    lines.push(`  - name: ${yamlString(entry.name)}`);
    lines.push(`    desc: ${yamlString(entry.desc || "—")}`);
  }
}

function generatedStatblock() {
  const aspectKeys = ["chair", "bete", "machine", "dame", "masque"];
  const aspects = aspectKeys.map((key) => number(system.aspects?.[key]?.value, number(system.aspects?.[key]?.base)));
  const aeMineurs = aspectKeys.map((key) => number(system.aspects?.[key]?.ae?.mineur?.value));
  const aeMajeurs = aspectKeys.map((key) => number(system.aspects?.[key]?.ae?.majeur?.value));
  const capacities = items
    .filter((item) => item.type === "capacite")
    .map((item) => ({ name: item.name, desc: htmlToMarkdown(item.system?.description) }));
  const modules = items
    .filter((item) => item.type === "module")
    .map((item) => ({ name: item.name, desc: htmlToMarkdown(item.system?.description) }));
  const weapons = items.filter((item) => item.type === "arme").map((weapon) => {
    const effects = [...(weapon.system?.effets?.raw ?? []), ...(weapon.system?.effets?.custom ?? [])];
    const details = [
      `**Type :** ${weapon.system?.type || "—"}`,
      `**Portée :** ${weapon.system?.portee || "—"}`,
      `**Dégâts :** ${diceValue(weapon.system?.degats)}${weapon.system?.degats?.addchair ? " + Chair" : ""}`,
      `**Violence :** ${diceValue(weapon.system?.violence)}`,
      `**Effets :** ${effects.map(effectLink).join(", ") || "—"}`,
    ];
    const description = htmlToMarkdown(weapon.system?.description);
    if (description) details.push(description);
    return { name: weapon.name, desc: details.join("  \n") };
  });

  const lines = [
    "<!-- BEGIN PNJ STATBLOCK -->",
    "```statblock",
    `layout: ${isCreature ? "Knight Bestiaire" : "Knight PNJ"}`,
    `name: ${yamlString(actor.name || "PNJ")}`,
    `type: ${isCreature ? "Créature" : "PNJ"}`,
  ];
  const subtype = system.type || system.archetype || "";
  if (subtype) lines.push(`subtype: ${yamlString(subtype)}`);
  const weakPoint = htmlToMarkdown(system.pointsFaibles || system.pointfaible);
  if (weakPoint) lines.push(`pointfaible: ${yamlString(weakPoint)}`);
  lines.push(`aspects: [${aspects.join(", ")}]`);
  lines.push(`ae_mineurs: [${aeMineurs.join(", ")}]`);
  lines.push(`ae_majeurs: [${aeMajeurs.join(", ")}]`);
  lines.push(`defense: ${statBase(system.defense)}`);
  lines.push(`reaction: ${statBase(system.reaction)}`);
  lines.push(`initiative: ${yamlString(system.initiative?.complet || `${number(system.initiative?.diceBase, number(system.initiative?.dice, 3))}D6`)}`);
  lines.push(`ps: ${statBase(system.sante)}`);
  lines.push(`pa: ${statBase(system.armure)}`);
  lines.push(`pe: ${statBase(system.energie)}`);
  lines.push(`cdf: ${statBase(system.champDeForce)}`);
  const shield = statBase(system.bouclier);
  if (shield) lines.push(`bouclier: ${shield}`);
  if (system.cohesion != null) lines.push(`cohesion: ${number(system.cohesion?.value, number(system.cohesion?.base, number(system.cohesion)))}`);
  if (system.debordement != null) lines.push(`debordement: ${number(system.debordement?.value, number(system.debordement?.base, number(system.debordement)))}`);
  appendStatblockTraits(lines, "capacites", capacities);
  appendStatblockTraits(lines, "modules", modules);
  appendStatblockTraits(lines, "armes", weapons);
  lines.push("```", "<!-- END PNJ STATBLOCK -->");
  return lines.join("\n");
}

function ensureStatblock(markdown, statblock) {
  let updated = markdown.replace(/\n?<!-- BEGIN PNJ STATBLOCK -->[\s\S]*?<!-- END PNJ STATBLOCK -->\n?/g, "\n");
  const presentationEnd = "<!-- END PNJ PRESENTATION -->";
  const dataviewEnd = "<!-- END PNJ DATAVIEW -->";
  if (updated.includes(presentationEnd)) {
    updated = updated.replace(presentationEnd, `${presentationEnd}\n\n${statblock}`);
  } else if (updated.includes(dataviewEnd)) {
    updated = updated.replace(dataviewEnd, `${dataviewEnd}\n\n${statblock}`);
  } else {
    updated = `${updated.trimEnd()}\n\n${statblock}\n`;
  }
  return updated.replace(/\n{3,}/g, "\n\n");
}

function replaceOrAppendGeneratedBlock(existing, block) {
  const pattern = /<!-- BEGIN FOUNDRY -->[\s\S]*?<!-- END FOUNDRY -->/;
  return pattern.test(existing) ? existing.replace(pattern, block) : `${existing.trimEnd()}\n\n${block}\n`;
}

function removeCampaignTag(markdown) {
  return markdown
    .replace(/^#campagne[ \t]*\r?\n(?:\r?\n)?/m, "")
    .replace(/\n{3,}/g, "\n\n");
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

function ensureFrontmatterField(markdown, key, yamlValue) {
  if (!markdown.startsWith("---\n")) return setFrontmatterField(markdown, key, yamlValue);
  const end = markdown.indexOf("\n---", 4);
  if (end < 0) return markdown;
  const frontmatter = markdown.slice(4, end);
  const expression = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:`, "m");
  return expression.test(frontmatter) ? markdown : setFrontmatterField(markdown, key, yamlValue);
}

function ensurePnjHeader(markdown, portraitFileName) {
  const summary = [
    "`= this.nom`, `= this.titre`",
    "`= this.faction` (`= this.lieu`)",
    "`= this.ref`",
  ].join("\n");
  const block = `<!-- BEGIN PNJ DATAVIEW -->
\`\`\`dataview
table without ID embed(link(meta(portrait).path, "150")) as Portrait, traits as Traits, motivations as Motivations
FROM -"__plugins/templates"
where file.path = this.file.path
\`\`\`
<!-- END PNJ DATAVIEW -->`;

  let updated = markdown
    .replace(/\n?<!-- BEGIN PNJ DATAVIEW -->[\s\S]*?<!-- END PNJ DATAVIEW -->\n?/g, "\n")
    .replace(/\n?\`\`\`dataview\r?\n\s*table without ID (?:portrait|embed\(link\(meta\(portrait\)\.path,\s*"150"\)\)) as Portrait,\s*traits as Traits,\s*motivations as Motivations\s*\r?\n\s*FROM -"__plugins\/templates"\s*\r?\n\s*where file\.(?:name|path) = this\.file\.(?:name|path)\s*\r?\n\`\`\`\n?/gi, "\n");

  const portraitPattern = new RegExp(
    `^!\\[\\[${escapeRegExp(portraitFileName)}\\|200\\]\\][ \\t]*\\r?\\n(?:\\r?\\n)?`,
    "m",
  );
  updated = updated.replace(portraitPattern, "");

  const oldSummaryPattern = /^`= this\.nom`, `= this\.titre`\r?\n`= this\.faction` \(`= this\.lieu`\)\r?\n(?:Réf\.\s*:\s*)?`= this\.ref`\r?\n*/m;
  updated = updated.replace(oldSummaryPattern, "");

  const titlePattern = /^#(?!#)\s+.*$/m;
  if (titlePattern.test(updated)) {
    updated = updated.replace(titlePattern, `# \`= this.file.name\`\n${summary}\n\n${block}`);
  } else {
    const frontmatterEnd = updated.startsWith("---\n") ? updated.indexOf("\n---", 4) : -1;
    if (frontmatterEnd >= 0) {
      const insertionPoint = frontmatterEnd + 4;
      updated = `${updated.slice(0, insertionPoint)}\n# \`= this.file.name\`\n${summary}\n\n${block}${updated.slice(insertionPoint)}`;
    } else {
      updated = `# \`= this.file.name\`\n${summary}\n\n${block}\n\n${updated}`;
    }
  }

  return updated
    .replace(/^(---\n[\s\S]*?\n---)\n+#[ \t]/, "$1\n# ")
    .replace(/(<!-- END PNJ DATAVIEW -->)\n(?!\n)/, "$1\n\n")
    .replace(/\n{3,}/g, "\n\n");
}

function ensureCreatureHeader(markdown) {
  const title = "# `= this.file.name`";
  if (/^#(?!#)\s+.*$/m.test(markdown)) return markdown.replace(/^#(?!#)\s+.*$/m, title);
  const frontmatterEnd = markdown.startsWith("---\n") ? markdown.indexOf("\n---", 4) : -1;
  if (frontmatterEnd >= 0) {
    const insertionPoint = frontmatterEnd + 4;
    return `${markdown.slice(0, insertionPoint)}\n${title}${markdown.slice(insertionPoint)}`.replace(/\n{3,}/g, "\n\n");
  }
  return `${title}\n\n${markdown}`;
}

function ensureCampaignNotes(markdown) {
  const notesPattern = /^> \[!note\][+-]?[ \t]+Notes de campagne[^\r\n]*(?:\r?\n>[^\r\n]*)*/mi;
  const existing = markdown.match(notesPattern)?.[0]?.trimEnd();
  const notes = existing || "> [!note] Notes de campagne\n> Cette zone reste entièrement manuelle.";
  let updated = markdown.replace(notesPattern, "").replace(/\n{3,}/g, "\n\n");
  const dataviewStart = "<!-- BEGIN PNJ DATAVIEW -->";
  if (updated.includes(dataviewStart)) {
    updated = updated.replace(dataviewStart, `${notes}\n\n${dataviewStart}`);
  } else {
    updated = `${updated.trimEnd()}\n\n${notes}\n`;
  }
  return updated.replace(/\n{3,}/g, "\n\n");
}

function newNote(portraitFileName) {
  if (isCreature) {
    return `---\ntype: fiche\nsubtype: creature\nnom: ${JSON.stringify(actor.name || "Créature")}\nportrait: ${JSON.stringify(`[[${portraitFileName}]]`)}\n---\n# \`= this.file.name\`\n`;
  }
  return `---\ntype: pnj\nsubtype: \nnom: \ntitre: \nfaction: "Knight"\nstatut: \nportrait: ${JSON.stringify(`[[${portraitFileName}]]`)}\nmusique: \nref: \ntraits: []\nmotivations: []\nlieu: \n---\n# \`= this.file.name\`\n\n> [!note] Notes de campagne\n> Cette zone reste entièrement manuelle.\n`;
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
markdown = removeCampaignTag(markdown);
markdown = setFrontmatterField(markdown, "portrait", JSON.stringify(`[[${portraitFileName}]]`));
if (isCreature) {
  markdown = setFrontmatterField(markdown, "type", "fiche");
  markdown = setFrontmatterField(markdown, "subtype", "creature");
  markdown = ensureFrontmatterField(markdown, "nom", JSON.stringify(actor.name || "Créature"));
  markdown = ensureCreatureHeader(markdown);
} else {
  markdown = setFrontmatterField(markdown, "type", "pnj");
  markdown = ensureFrontmatterField(markdown, "subtype", "");
  markdown = ensureFrontmatterField(markdown, "nom", "");
  markdown = ensureFrontmatterField(markdown, "titre", "");
  markdown = ensureFrontmatterField(markdown, "faction", JSON.stringify("Knight"));
  markdown = ensureFrontmatterField(markdown, "statut", "");
  markdown = ensureFrontmatterField(markdown, "musique", "");
  markdown = ensureFrontmatterField(markdown, "ref", "");
  markdown = ensureFrontmatterField(markdown, "traits", "[]");
  markdown = ensureFrontmatterField(markdown, "motivations", "[]");
  markdown = ensureFrontmatterField(markdown, "lieu", "");
  if (Object.hasOwn(actor._knightExport ?? {}, "folderName")) {
    markdown = setFrontmatterField(markdown, "faction", JSON.stringify(actor._knightExport.folderName ?? ""));
  }
  markdown = ensurePnjHeader(markdown, portraitFileName);
}
markdown = ensureCampaignNotes(markdown);
markdown = ensurePresentation(markdown, generatedPresentationBlock());
markdown = ensureStatblock(markdown, generatedStatblock());
markdown = replaceOrAppendGeneratedBlock(markdown, generatedBlock());
fs.writeFileSync(outputPath, `${markdown.trimEnd()}\n`, "utf8");
console.log(`Fiche ${isCreature ? "Bestiaire" : "PNJ"} mise à jour : ${outputPath}`);
if (!skipImage) console.log(`Portrait remplacé : ${path.join(portraitDirectory, portraitFileName)}`);
