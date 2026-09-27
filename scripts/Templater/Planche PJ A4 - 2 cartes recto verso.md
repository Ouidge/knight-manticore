<%*
const candidates = app.vault.getMarkdownFiles()
  .map((file) => ({
    file,
    frontmatter: app.metadataCache.getFileCache(file)?.frontmatter ?? {},
  }))
  .filter(({ frontmatter }) => {
    const type = String(frontmatter.type ?? "").toLowerCase();
    const subtype = String(frontmatter.subtype ?? "").toLowerCase();
    return type === "fiche" && subtype === "pj";
  })
  .sort((a, b) => a.file.basename.localeCompare(b.file.basename, "fr"));

if (candidates.length < 2) {
  new Notice("Il faut au moins deux fiches PJ dans le Vault.");
  return;
}

const labelFor = ({ file, frontmatter }) =>
  frontmatter.nom || frontmatter.pj || file.basename.replace(/^Fiche\s+/i, "");

const first = await tp.system.suggester(
  candidates.map(labelFor),
  candidates,
  false,
  "Premier PJ (carte supérieure)"
);
if (!first) return;

const remaining = candidates.filter((entry) => entry.file.path !== first.file.path);
const second = await tp.system.suggester(
  remaining.map(labelFor),
  remaining,
  false,
  "Deuxième PJ (carte inférieure)"
);
if (!second) return;

const withoutExtension = (path) => path.replace(/\.md$/i, "");
const targetPath = "Personnages/PJ/Planche PJ recto-verso A4.md";
const firstLink = `![[${withoutExtension(first.file.path)}]]`;
const secondLink = `![[${withoutExtension(second.file.path)}]]`;
const card = (face, link) => [`> [!pj-${face}]-`, `> ${link}`, ""];
const content = [
  "---",
  "type: impression",
  "subtype: pj-double-a5-duplex",
  "cssclasses:",
  "  - knight-print-pj-duplex-a5",
  "---",
  "",
  ...card("front", firstLink),
  ...card("front", secondLink),
  ...card("back", firstLink),
  ...card("back", secondLink),
].join("\n");

let target = app.vault.getAbstractFileByPath(targetPath);
if (target) {
  await app.vault.modify(target, content);
} else {
  target = await app.vault.create(targetPath, content);
}

await app.workspace.getLeaf(false).openFile(target);
new Notice("Planche PJ prête : A4 portrait, recto-verso sur le bord long.");
tR = "";
%>
