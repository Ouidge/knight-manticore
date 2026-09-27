// Macro « Script » pour Foundry VTT v14 — système Knight.
// Exporte en un seul fichier toutes les créatures et bandes du monde courant.
// Ignore les acteurs classés dans un dossier dont le nom commence par « _ ».

if (!game.user.isGM) {
  ui.notifications.error("Seul un MJ peut exporter le bestiaire du monde.");
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

const BESTIARY_ACTOR_TYPES = new Set(["creature", "bande"]);
const worldCreatures = game.actors.filter((actor) => BESTIARY_ACTOR_TYPES.has(String(actor.type).toLowerCase()));
const ignoredCreatures = worldCreatures.filter(isInIgnoredFolder);
const actors = worldCreatures
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
  const reason = ignoredCreatures.length
    ? `Toutes les créatures du monde (${ignoredCreatures.length}) sont rangées dans des dossiers ignorés.`
    : "Aucun acteur de type « creature » ou « bande » n’a été trouvé dans ce monde.";
  ui.notifications.warn(reason);
  return;
}

const payload = {
  format: "knight-bestiaire-bundle",
  version: 1,
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
  "knight-bestiaire-export.json",
);

const ignoredMessage = ignoredCreatures.length
  ? ` ${ignoredCreatures.length} créature(s) ignorée(s), car classée(s) dans un dossier commençant par « _ ».`
  : "";
ui.notifications.info(`${actors.length} entrée(s) du bestiaire exportée(s) dans knight-bestiaire-export.json.${ignoredMessage}`);
