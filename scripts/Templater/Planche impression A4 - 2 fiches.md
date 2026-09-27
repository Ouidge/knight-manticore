<%*
const candidates = app.vault.getMarkdownFiles()
  .map((file) => ({
    file,
    frontmatter: app.metadataCache.getFileCache(file)?.frontmatter ?? {},
  }))
  .filter(({ frontmatter }) => {
    const type = String(frontmatter.type ?? "").toLowerCase();
    const subtype = String(frontmatter.subtype ?? "").toLowerCase();
    return type === "fiche" && ["pnj", "creature", "créature", "bande"].includes(subtype);
  })
  .sort((a, b) => a.file.basename.localeCompare(b.file.basename, "fr"));

if (candidates.length < 2) {
  new Notice("Il faut au moins deux fiches PNJ, créature ou bande dans le Vault.");
  return;
}

const labelFor = ({ file, frontmatter }) => {
  const subtype = String(frontmatter.subtype ?? "").toLowerCase();
  const category = subtype === "pnj" ? "PNJ" : subtype === "bande" ? "Bande" : "Créature";
  return `${category} — ${frontmatter.nom || file.basename.replace(/^Fiche\s+/i, "")}`;
};

const first = await tp.system.suggester(
  candidates.map(labelFor),
  candidates,
  false,
  "Première fiche (moitié supérieure)"
);
if (!first) return;

const remaining = candidates.filter((entry) => entry.file.path !== first.file.path);
const second = await tp.system.suggester(
  remaining.map(labelFor),
  remaining,
  false,
  "Deuxième fiche (moitié inférieure)"
);
if (!second) return;

const withoutExtension = (path) => path.replace(/\.md$/i, "");
const targetFolder = "_Print";
const targetPath = `${targetFolder}/Planche impression A4.md`;
const content = [
  "---",
  "type: impression",
  "subtype: double-a5",
  "cssclasses:",
  "  - knight-print-double-a5",
  "---",
  "",
  `![[${withoutExtension(first.file.path)}]]`,
  "",
  `![[${withoutExtension(second.file.path)}]]`,
  "",
].join("\n");

if (!app.vault.getAbstractFileByPath(targetFolder)) {
  await app.vault.createFolder(targetFolder);
}

let target = app.vault.getAbstractFileByPath(targetPath);
if (target) {
  await app.vault.modify(target, content);
} else {
  target = await app.vault.create(targetPath, content);
}

await app.workspace.getLeaf(false).openFile(target);
new Notice("Planche A4 prête : imprimer en A4 portrait.");
tR = "";
%>
