// Macro « Script » pour Foundry VTT v14 — système Knight.
// Exporte en un seul fichier tous les PNJ et créatures présents dans le monde courant.
// Ignore les acteurs classés dans un dossier dont le nom commence par « _ ».

if (!game.user.isGM) {
  ui.notifications.error("Seul un MJ peut exporter tous les PNJ du monde.");
  return;
}

function resolveFolder(folderReference) {
  if (!folderReference) return null;
  if (typeof folderReference === "string") return game.folders.get(folderReference) ?? null;
  return folderReference;
}

function actorFolder(actor) {
  return resolveFolder(actor.folder ?? actor._source?.folder);
}

function isInIgnoredFolder(actor) {
  let folder = actorFolder(actor);
  const visited = new Set();

  while (folder) {
    if (String(folder.name ?? "").startsWith("_")) return true;

    const parent = folder.folder ?? folder._source?.folder;
    if (parent && typeof parent === "object") {
      if (visited.has(parent.id)) break;
      visited.add(parent.id);
      folder = parent;
      continue;
    }

    const parentId = parent;
    if (!parentId || visited.has(parentId)) break;
    visited.add(parentId);
    folder = game.folders.get(parentId);
  }

  return false;
}

const worldActors = game.actors.filter((actor) => ["pnj", "creature"].includes(actor.type));
const ignoredActors = worldActors.filter(isInIgnoredFolder);
const actors = worldActors
  .filter((actor) => !isInIgnoredFolder(actor))
  .map((actor) => {
    const exportedActor = actor.toObject();
    const folder = actorFolder(actor);
    exportedActor._knightExport = {
      folderName: folder?.name ?? "",
    };
    return exportedActor;
  });

if (!actors.length) {
  const reason = ignoredActors.length
    ? `Tous les PNJ et créatures du monde (${ignoredActors.length}) sont rangés dans des dossiers ignorés.`
    : "Aucun acteur de type « pnj » ou « creature » n’a été trouvé dans ce monde.";
  ui.notifications.warn(reason);
  return;
}

const payload = {
  format: "knight-actor-bundle",
  version: 2,
  exportedAt: new Date().toISOString(),
  foundryVersion: game.version,
  systemId: game.system.id,
  systemVersion: game.system.version,
  worldId: game.world.id,
  actors,
};

foundry.utils.saveDataToFile(
  JSON.stringify(payload, null, 2),
  "application/json",
  "knight-acteurs-export.json",
);

const ignoredMessage = ignoredActors.length
  ? ` ${ignoredActors.length} PNJ ignoré(s), car classé(s) dans un dossier commençant par « _ ».`
  : "";
ui.notifications.info(`${actors.length} PNJ/créature(s) exporté(s) dans knight-acteurs-export.json.${ignoredMessage}`);
