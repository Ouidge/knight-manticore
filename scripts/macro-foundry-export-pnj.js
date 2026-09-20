// Macro « Script » pour Foundry VTT v14 — système Knight.
// Exporte en un seul fichier tous les PNJ présents dans le monde courant.

if (!game.user.isGM) {
  ui.notifications.error("Seul un MJ peut exporter tous les PNJ du monde.");
  return;
}

const actors = game.actors
  .filter((actor) => actor.type === "pnj")
  .map((actor) => actor.toObject());

if (!actors.length) {
  ui.notifications.warn("Aucun acteur de type « pnj » n’a été trouvé dans ce monde.");
  return;
}

const payload = {
  format: "knight-pnj-bundle",
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
  "knight-pnj-export.json",
);

ui.notifications.info(`${actors.length} PNJ exporté(s) dans knight-pnj-export.json.`);

