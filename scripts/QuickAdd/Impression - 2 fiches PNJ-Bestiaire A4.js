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

  const selected = [];
  let remaining = [...candidates];
  const finishChoice = { finish: true };

  while (remaining.length) {
    const canFinish = selected.length >= 2;
    const choices = canFinish ? [finishChoice, ...remaining] : remaining;
    const labels = canFinish
      ? [`✓ Terminer la sélection (${selected.length} fiches)`, ...remaining.map(labelFor)]
      : remaining.map(labelFor);
    const choice = await quickAddApi.suggester(
      labels,
      choices,
      selected.length
        ? `Ajouter la fiche n°${selected.length + 1}, ou terminer`
        : "Première fiche à imprimer",
    );
    if (!choice) return;
    if (choice.finish) break;
    selected.push(choice);
    remaining = remaining.filter((entry) => entry.file.path !== choice.file.path);
  }

  if (selected.length < 2) return;

  const readStatblock = async (entry) => {
    const source = await app.vault.cachedRead(entry.file);
    const match = source.match(/```statblock\s*\r?\n([\s\S]*?)\r?\n```/i);
    if (!match) {
      throw new Error(`Aucun bloc statblock trouvé dans « ${entry.file.path} ».`);
    }
    return `\`\`\`statblock\n${match[1].trim()}\n\`\`\``;
  };

  let statblocks;
  try {
    statblocks = await Promise.all(selected.map(readStatblock));
  } catch (error) {
    await quickAddApi.infoDialog("Impression PNJ-Bestiaire", error.message);
    return;
  }

  const card = (statblock) => [
    "> [!knight-card]",
    ...statblock.split("\n").map((line) => `> ${line}`),
    "",
  ];

  const targetFolder = "_Print";
  const selectedNames = selected.map(nameFor);
  const compactNames = selectedNames.length <= 4
    ? selectedNames.join(" + ")
    : `${selectedNames.slice(0, 4).join(" + ")} + ${selectedNames.length - 4} autres`;
  const documentTitle = `Impression PNJ-Bestiaire - ${compactNames} - A4`;
  const targetPath = `${targetFolder}/${safeFilename(documentTitle)}.md`;
  const content = [
    "---",
    "type: impression",
    "subtype: multi-a5",
    `title: ${JSON.stringify(documentTitle)}`,
    "cssclasses:",
    "  - knight-print-multi-a5",
    "---",
    "",
    ...statblocks.flatMap(card),
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
    `${documentTitle}\n\n${selected.length} fiches sélectionnées. Imprimer en A4 portrait : les sauts de page seront calculés selon la hauteur réelle des fiches.`,
  );
};
