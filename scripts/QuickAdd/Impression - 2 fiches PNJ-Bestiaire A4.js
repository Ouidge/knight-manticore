module.exports = async ({ app, quickAddApi }) => {
  const candidates = app.vault
    .getMarkdownFiles()
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
    await quickAddApi.infoDialog(
      "Impression PNJ-Bestiaire",
      "Il faut au moins deux fiches PNJ, créature ou bande dans le Vault.",
    );
    return;
  }

  const nameFor = ({ file, frontmatter }) =>
    String(frontmatter.nom || file.basename.replace(/^Fiche\s+/i, ""));

  const labelFor = ({ file, frontmatter }) => {
    const subtype = String(frontmatter.subtype ?? "").toLowerCase();
    const category = subtype === "pnj" ? "PNJ" : subtype === "bande" ? "Bande" : "Créature";
    return `${category} — ${nameFor({ file, frontmatter })}`;
  };

  const safeFilename = (value) =>
    String(value).replace(/[<>:"/\\|?*]/g, "-").trim().replace(/[. ]+$/g, "");

  const first = await quickAddApi.suggester(
    candidates.map(labelFor),
    candidates,
    "Première fiche - carte supérieure",
  );
  if (!first) return;

  const remaining = candidates.filter((entry) => entry.file.path !== first.file.path);
  const second = await quickAddApi.suggester(
    remaining.map(labelFor),
    remaining,
    "Deuxième fiche - carte inférieure",
  );
  if (!second) return;

  const withoutExtension = (path) => path.replace(/\.md$/i, "");
  const targetFolder = "_Print";
  const documentTitle = `Impression PNJ-Bestiaire - ${nameFor(first)} + ${nameFor(second)} - A4`;
  const targetPath = `${targetFolder}/${safeFilename(documentTitle)}.md`;
  const content = [
    "---",
    "type: impression",
    "subtype: double-a5",
    `title: ${JSON.stringify(documentTitle)}`,
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
  await quickAddApi.infoDialog(
    "Planche PNJ-Bestiaire prête",
    `${documentTitle}\n\nImprimer en A4 portrait.`,
  );
};
