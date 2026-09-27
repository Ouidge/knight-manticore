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
      return type === "fiche" && subtype === "pj";
    })
    .sort((a, b) => a.file.basename.localeCompare(b.file.basename, "fr"));

  if (candidates.length < 2) {
    await quickAddApi.infoDialog(
      "Planche PJ",
      "Il faut au moins deux fiches PJ dans le Vault.",
    );
    return;
  }

  const labelFor = ({ file, frontmatter }) =>
    String(frontmatter.nom || frontmatter.pj || file.basename.replace(/^Fiche\s+/i, ""));

  const first = await quickAddApi.suggester(
    candidates.map(labelFor),
    candidates,
    "Premier PJ - carte supérieure",
  );
  if (!first) return;

  const remaining = candidates.filter((entry) => entry.file.path !== first.file.path);
  const second = await quickAddApi.suggester(
    remaining.map(labelFor),
    remaining,
    "Deuxième PJ - carte inférieure",
  );
  if (!second) return;

  const readStatblock = async (entry) => {
    const source = await app.vault.cachedRead(entry.file);
    const match = source.match(/```statblock\s*\r?\n([\s\S]*?)\r?\n```/i);
    if (!match) {
      throw new Error(`Aucun bloc statblock trouvé dans « ${entry.file.path} ».`);
    }
    return `\`\`\`statblock\n${match[1].trim()}\n\`\`\``;
  };

  let firstStatblock;
  let secondStatblock;
  try {
    [firstStatblock, secondStatblock] = await Promise.all([
      readStatblock(first),
      readStatblock(second),
    ]);
  } catch (error) {
    await quickAddApi.infoDialog("Planche PJ", error.message);
    return;
  }

  const card = (face, statblock) => {
    const layout = face === "front" ? "Knight PJ Recto" : "Knight PJ Verso";
    const faceStatblock = statblock.replace(/^layout:\s*.*$/mi, `layout: ${layout}`);
    return [
    `> [!pj-${face}]`,
    ...faceStatblock.split("\n").map((line) => `> ${line}`),
    "",
    ];
  };
  const targetFolder = "Personnages/PJ";
  const targetPath = `${targetFolder}/Planche PJ recto-verso A4.md`;
  const content = [
    "---",
    "type: impression",
    "subtype: pj-double-a5-duplex",
    "cssclasses:",
    "  - knight-print-pj-duplex-a5",
    "---",
    "",
    ...card("front", firstStatblock),
    ...card("front", secondStatblock),
    ...card("back", firstStatblock),
    ...card("back", secondStatblock),
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
    "Planche PJ prête",
    "Imprimer en A4 portrait, recto-verso avec retournement sur le bord long.",
  );
};
