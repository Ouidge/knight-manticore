/**
 * Knight — Générateur de créature élite
 * Foundry VTT 14 / système Knight 3.58+
 *
 * Utilisation : sélectionner exactement un token de type creature ou bande,
 * puis exécuter cette macro en tant que MJ.
 */

const EliteGenerator = (() => {
  const VERSION = 1;
  const FLAG_PATH = "flags.world.knightManticoreElite";
  const ASPECTS = ["chair", "bete", "machine", "dame", "masque"];
  const ASPECT_LABELS = {
    chair: "Chair",
    bete: "Bête",
    machine: "Machine",
    dame: "Dame",
    masque: "Masque",
  };

  const EXCEPTIONAL_ASPECT_DESCRIPTIONS = {
    chair: {
      mineur: "Le PNJ soustrait toujours son score de l’aspect exceptionnel Chair aux dégâts qu’il reçoit.",
      majeur: "Le PNJ ignore purement les effets barrage X, choc X et meurtrier des armes.",
    },
    bete: {
      mineur: "Le PNJ ajoute à ses dégâts au contact son score de l’aspect exceptionnel Bête.",
      majeur: "Le PNJ ajoute à ses dégâts au contact son score de l’aspect Bête, en plus du score de l’aspect exceptionnel.",
    },
    machine: {
      mineur: "Le PNJ ajoute son score de Machine exceptionnelle à son score de réaction.",
      majeur: "Le PNJ est insensible aux capacités d’armure qui jouent sur les sens telles que le mode Ghost ou le mode Changeling. L’invisibilité comme les illusions ou les leurres n’ont pas d’effet sur lui.",
    },
    dame: {
      mineur: "Le PNJ, s’il est accompagné d’autres PNJ de la même faction que lui, peut toujours décider de reporter les dégâts qu’il subit sur des alliés proches, à portée courte. Cela représente le fait que des PNJ alliés s’interposent pour sauvegarder sa vie.",
      majeur: "Un PJ qui souhaite attaquer ce PNJ doit réussir un test base Hargne dont la difficulté est égale au score de la Dame exceptionnelle du PNJ. S’il ne réussit pas ce test, il est subjugué par le PNJ et ne se résout pas à l’attaquer.",
    },
    masque: {
      mineur: "Le PNJ ajoute son score de Masque exceptionnel à son score de défense.",
      majeur: "Le PNJ agit toujours, peu importe son nombre d’actions, comme s’il avait un score d’initiative de 30. Le MJ ne lance pas les dés.",
    },
  };

  const LORD_BY_CREATURE = {
    bete: [
      "Le Prédateur couronné", "Louve", "Noctes", "Bestian", "Faune",
      "Behemoth", "Hybride",
    ],
    chair: [
      "La Prolifération", "La Perfection", "Infeste", "Flore de chair",
      "Embryon", "Enfant de la Chair", "Monstre de chair", "Abomination",
      "Aberration",
    ],
    machine: [
      "Le Corps", "Guenièvre & Longshot", "Machiniste", "Ville mouvante",
      "Mécaniste", "Construct", "Monstre-machine", "Ravageur",
    ],
    dame: [
      "La Matrice", "La Reine", "Reflet & yeux indiscrets",
      "Reflflet & yeux indiscrets", "Créature de glace", "Prodige", "Écho",
    ],
    masque: [
      "L’Ombre", "Le Mur", "Esclave du Masque", "Nuée du Masque",
      "Enfant du Masque", "Enfants du Masque", "Rejeton du Masque", "Masque vivant",
      "Favori du Masque",
    ],
  };

  const GENERAL_CAPACITIES = [
    "Anathème",
    "Domination",
    "Actions multiples (1)",
    "Peur (1)",
    "Charge brutale",
    "Indestructible",
    "Régénération",
    "Protéiforme (mineur)",
  ];

  const ELITE_CAPACITIES = [
    "Affidé du Seigneur",
    "Élu du Seigneur",
    "Protégé du Seigneur",
    "Serviteur du Seigneur",
    "Tueur du Seigneur",
    "Accablant",
    "Aura de souffrance",
    "Dévorant",
    "Hybridation",
    "Il est partout",
    "Insaisissable",
    "Intouchable",
    "Phase 2",
  ];

  const normalize = (value) => String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fr");

  const number = (value, fallback = 0) => {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  };

  const half = (value) => Math.floor(number(value) / 2);
  const increasedHalf = (value) => number(value) + half(value);
  const shuffle = (values) => {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index--) {
      const other = Math.floor(CONFIG.Dice.randomUniform() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  };

  const escapeHtml = (value) => foundry.utils.escapeHTML(String(value ?? ""));

  async function inputDialog({ title, content, ok = "Continuer", render = null, width = 560 }) {
    const formData = await foundry.applications.api.DialogV2.input({
      window: { title },
      position: { width },
      content: `<div class="standard-form">${content}</div>`,
      ok: { label: ok, icon: "fa-solid fa-check" },
      ...(render ? { render } : {}),
      rejectClose: false,
      modal: true,
    });
    if (!formData) return null;
    // Foundry V14 renvoie directement un objet dont les clés correspondent
    // aux attributs `name`. Garder les deux autres formes pour compatibilité.
    if (formData.object) return formData.object;
    if (typeof formData.entries === "function") return Object.fromEntries(formData.entries());
    return formData;
  }

  async function confirmDialog(title, content, yes = "Confirmer") {
    return foundry.applications.api.DialogV2.confirm({
      window: { title },
      content: `<div class="standard-form">${content}</div>`,
      yes: { label: yes, icon: "fa-solid fa-check" },
      no: { label: "Annuler", icon: "fa-solid fa-xmark" },
      defaultYes: false,
      rejectClose: false,
      modal: true,
    });
  }

  function selectField(name, label, entries, selected) {
    const options = entries.map(([value, text]) =>
      `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(text)}</option>`
    ).join("");
    return `<div class="form-group"><label>${escapeHtml(label)}</label><div class="form-fields"><select name="${escapeHtml(name)}">${options}</select></div></div>`;
  }

  function detectLord(actorName) {
    const normalizedName = normalize(actorName).replace(/\s*\(elite\)\s*$/i, "");
    const candidates = Object.entries(LORD_BY_CREATURE)
      .flatMap(([lord, names]) => names.map((name) => ({ lord, name: normalize(name) })))
      .sort((a, b) => b.name.length - a.name.length);
    return candidates.find(({ name }) => normalizedName === name || normalizedName.startsWith(`${name} `))?.lord ?? null;
  }

  function detectProfile(actor) {
    if (actor.type === "bande") return "bande";
    const type = normalize(actor.system?.type);
    if (type.includes("patron")) return "patron";
    if (type.includes("salopard") && (type.includes("colosse") || actor.system?.colosse)) return "salopard-colosse";
    if (type.includes("salopard")) return "salopard";
    if (type.includes("hostile")) return "hostile";
    return null;
  }

  const ELITE_CAPACITY_COUNTS = {
    bande: 1,
    hostile: 1,
    salopard: 2,
    "salopard-colosse": 3,
    patron: 4,
  };

  function capacityBaseName(name) {
    const normalized = normalize(name);
    if (/^actions multiples\s*\(/.test(normalized)) return "actions multiples";
    if (/^peur\s*\(/.test(normalized)) return "peur";
    if (/^proteiforme\s*\(/.test(normalized)) return "proteiforme";
    return normalized;
  }

  function hasCapacity(actor, name) {
    const expected = capacityBaseName(name);
    return actor.items.some((item) => item.type === "capacite" && capacityBaseName(item.name) === expected);
  }

  function getCapacity(actor, name) {
    const expected = capacityBaseName(name);
    return actor.items.find((item) => item.type === "capacite" && capacityBaseName(item.name) === expected);
  }

  function eligibleMinorAspects(actor) {
    return ASPECTS.filter((aspect) => {
      const data = actor.system?.aspects?.[aspect]?.ae;
      return number(data?.mineur?.value) > 0 && number(data?.majeur?.value) <= 0;
    });
  }

  function eligibleEliteCapacities(actor) {
    const existingIntouchable = hasCapacity(actor, "Intouchable");
    const existingInsaisissable = hasCapacity(actor, "Insaisissable");
    return ELITE_CAPACITIES.filter((name) => {
      if (hasCapacity(actor, name)) return false;
      if (name === "Intouchable" && existingInsaisissable) return false;
      if (name === "Insaisissable" && existingIntouchable) return false;
      return true;
    });
  }

  function chooseRandomEliteCapacities(actor, requestedCount) {
    const selected = [];
    for (const name of shuffle(eligibleEliteCapacities(actor))) {
      if (selected.length >= requestedCount) break;
      if (name === "Intouchable" && selected.includes("Insaisissable")) continue;
      if (name === "Insaisissable" && selected.includes("Intouchable")) continue;
      selected.push(name);
    }
    return selected;
  }

  async function chooseMode() {
    const result = await inputDialog({
      title: "Knight — Créer une créature élite",
      content: selectField("mode", "Mode de génération", [
        ["automatic", "Automatique — choix aléatoires compatibles"],
        ["interactive", "Interactif — choisir chaque option"],
      ], "interactive"),
    });
    return result?.mode ?? null;
  }

  async function chooseLord(actor) {
    const detected = detectLord(actor.name) ?? "bete";
    const result = await inputDialog({
      title: "Seigneur de la créature",
      content: `<p>Le Seigneur ne sera jamais choisi aléatoirement. Vérifie la proposition avant de continuer.</p>${selectField("lord", "Seigneur", ASPECTS.map((key) => [key, ASPECT_LABELS[key]]), detected)}`,
    });
    return result?.lord ?? null;
  }

  async function chooseProfile(actor) {
    const detected = detectProfile(actor);
    if (detected) return detected;
    const result = await inputDialog({
      title: "Profil de la créature",
      content: `<p>Le profil Foundry n’a pas été reconnu. Il détermine le nombre de capacités d’élite à ajouter.</p>${selectField("profile", "Profil", [
        ["bande", "Bande — 1 capacité"],
        ["hostile", "Hostile — 1 capacité"],
        ["salopard", "Salopard — 2 capacités"],
        ["salopard-colosse", "Salopard colosse — 3 capacités"],
        ["patron", "Patron — 4 capacités"],
      ], "hostile")}`,
    });
    return result?.profile ?? null;
  }

  async function chooseMinorAspects(actor, mode) {
    const eligible = eligibleMinorAspects(actor);
    if (!eligible.length) return [];
    if (mode === "automatic") return shuffle(eligible).slice(0, Math.min(2, eligible.length));

    while (true) {
      const checks = eligible.map((aspect, index) => {
        const value = number(actor.system.aspects[aspect].ae.mineur.value);
        const projected = Math.min(10, increasedHalf(value));
        return `<label class="checkbox"><input type="checkbox" name="ae_${aspect}" ${index < Math.min(2, eligible.length) ? "checked" : ""}> ${ASPECT_LABELS[aspect]} mineur ${value} → majeur ${projected}</label>`;
      }).join("");
      const result = await inputDialog({
        title: "Aspects exceptionnels",
        content: `<p>Choisis un ou deux aspects exceptionnels mineurs à promouvoir.</p>
          <div class="form-group stacked">${checks}</div>
          <fieldset><legend>Effets des aspects sélectionnés</legend>
            <div class="knight-ae-descriptions" style="max-height:46vh;overflow:auto;padding-right:0.5rem"></div>
          </fieldset>`,
        render: (_event, dialog) => {
          const output = dialog.element.querySelector(".knight-ae-descriptions");
          const checkboxes = [...dialog.element.querySelectorAll('input[name^="ae_"]')];
          const refresh = () => {
            const selected = eligible.filter((aspect) =>
              dialog.element.querySelector(`input[name="ae_${aspect}"]`)?.checked
            );
            output.innerHTML = selected.map((aspect) => {
              const description = EXCEPTIONAL_ASPECT_DESCRIPTIONS[aspect];
              return `<section>
                <h4>${ASPECT_LABELS[aspect]} exceptionnelle</h4>
                <p><strong>Mineure :</strong> ${escapeHtml(description.mineur)}</p>
                <p><strong>Majeure :</strong> ${escapeHtml(description.majeur)}</p>
              </section>`;
            }).join("<hr>") || "<p>Coche un aspect pour afficher ses effets.</p>";
          };
          for (const checkbox of checkboxes) checkbox.addEventListener("change", refresh);
          refresh();
        },
        width: 760,
      });
      if (!result) return null;
      const selected = eligible.filter((aspect) => Boolean(result[`ae_${aspect}`]));
      if (selected.length >= 1 && selected.length <= 2) return selected;
      ui.notifications.warn("Choisis un ou deux aspects exceptionnels.");
    }
  }

  async function chooseGeneralCapacity(actor, mode) {
    const available = GENERAL_CAPACITIES.filter((name) => !hasCapacity(actor, name));
    if (!available.length) return null;
    if (mode === "automatic") return shuffle(available)[0];
    const descriptions = Object.fromEntries(await Promise.all(available.map(async (name) => {
      const item = await findCapacityItem(name);
      return [name, item?.system?.description || "<p>Aucune description disponible.</p>"];
    })));
    const panels = available.map((name) =>
      `<div class="knight-capacity-description" data-capacity="${escapeHtml(name)}" style="display:none">${descriptions[name]}</div>`
    ).join("");
    const result = await inputDialog({
      title: "Capacité générale supplémentaire",
      content: `${selectField("capacity", "Capacité", available.map((name) => [name, name]), available[0])}
        <fieldset><legend>Description</legend><div class="knight-capacity-description-panel" style="max-height:46vh;overflow:auto;padding-right:0.5rem">${panels}</div></fieldset>`,
      render: (_event, dialog) => {
        const select = dialog.element.querySelector('select[name="capacity"]');
        const refresh = () => {
          for (const panel of dialog.element.querySelectorAll(".knight-capacity-description")) {
            panel.style.display = panel.dataset.capacity === select.value ? "block" : "none";
          }
        };
        select.addEventListener("change", refresh);
        refresh();
      },
      width: 700,
    });
    return result?.capacity ?? null;
  }

  async function chooseEliteCapacities(actor, count, mode) {
    const available = eligibleEliteCapacities(actor);
    const target = Math.min(count, available.length);
    if (mode === "automatic") return chooseRandomEliteCapacities(actor, target);

    const descriptions = await Promise.all(available.map(async (name) => {
      const item = await findCapacityItem(name);
      return item?.system?.description || "<p>Aucune description disponible.</p>";
    }));

    while (true) {
      const selectors = Array.from({ length: target }, (_, slot) =>
        selectField(
          `elite_${slot}`,
          `Capacité ${slot + 1}`,
          available.map((name) => [name, name]),
          available[slot % available.length],
        )
      ).join("");
      const result = await inputDialog({
        title: "Capacités réservées aux élites",
        content: `<p>Choisis exactement <strong>${target}</strong> capacité${target > 1 ? "s" : ""}.</p>
          <div class="knight-elite-selectors">${selectors}</div>
          <fieldset><legend>Descriptions des capacités sélectionnées</legend>
            <div class="knight-elite-descriptions" style="max-height:46vh;overflow:auto;padding-right:0.5rem"></div>
          </fieldset>`,
        render: (_event, dialog) => {
          const output = dialog.element.querySelector(".knight-elite-descriptions");
          const selectors = [...dialog.element.querySelectorAll('select[name^="elite_"]')];
          const refresh = () => {
            output.innerHTML = selectors.map((selector) => {
              const index = available.indexOf(selector.value);
              return `<section><h4>${escapeHtml(selector.value)}</h4>${descriptions[index] ?? "<p>Aucune description disponible.</p>"}</section>`;
            }).join("<hr>");
          };
          for (const selector of selectors) selector.addEventListener("change", refresh);
          refresh();
        },
        width: 760,
      });
      if (!result) return null;
      const selected = Array.from({ length: target }, (_, slot) => result[`elite_${slot}`]);
      const duplicated = new Set(selected).size !== selected.length;
      const incompatible = selected.includes("Intouchable") && selected.includes("Insaisissable");
      if (selected.length === target && !duplicated && !incompatible) return selected;
      ui.notifications.warn(duplicated
        ? "Chaque capacité d’élite doit être différente."
        : incompatible
        ? "Intouchable et Insaisissable sont incompatibles."
        : `Choisis exactement ${target} capacité${target > 1 ? "s" : ""}.`);
    }
  }

  function resourceBase(system, key) {
    const resource = system?.[key];
    return number(resource?.base, number(resource?.value));
  }

  async function chooseBarrier(actor, mode) {
    const shield = resourceBase(actor.system, "bouclier");
    const cdf = resourceBase(actor.system, "champDeForce");
    if (shield > 0 && cdf <= 0) return "bouclier";
    if (cdf > 0 && shield <= 0) return "champDeForce";
    if (mode === "automatic") {
      if (shield <= 0 && cdf <= 0) return "bouclier";
      return CONFIG.Dice.randomUniform() < 0.5 ? "bouclier" : "champDeForce";
    }
    const result = await inputDialog({
      title: "Bouclier ou champ de force",
      content: selectField("barrier", shield <= 0 && cdf <= 0 ? "Créer" : "Augmenter", [
        ["bouclier", `Bouclier (${shield || 0})`],
        ["champDeForce", `CdF (${cdf || 0})`],
      ], "bouclier"),
    });
    return result?.barrier ?? null;
  }

  async function chooseSecondLord(primaryLord, mode) {
    const available = ASPECTS.filter((aspect) => aspect !== primaryLord);
    if (mode === "automatic") return shuffle(available)[0];
    const result = await inputDialog({
      title: "Hybridation",
      content: selectField("secondLord", "Second Seigneur", available.map((key) => [key, ASPECT_LABELS[key]]), available[0]),
    });
    return result?.secondLord ?? null;
  }

  async function chooseAffideResource(actor, mode) {
    const ps = resourceBase(actor.system, "sante");
    const pa = resourceBase(actor.system, "armure");
    if (pa > 0 && ps <= 0) return "armure";
    if (ps > 0 && pa <= 0) return "sante";
    if (ps > 0 && pa > 0) {
      if (mode === "automatic") return CONFIG.Dice.randomUniform() < 0.5 ? "sante" : "armure";
      const result = await inputDialog({
        title: "Affidé du Seigneur",
        content: selectField("resource", "Ajouter le bonus à", [["sante", "PS"], ["armure", "PA"]], "sante"),
      });
      return result?.resource ?? null;
    }
    return "sante";
  }

  const capacityItemCache = new Map();

  async function findCapacityItem(name) {
    const expected = normalize(name);
    const expectedBase = capacityBaseName(name);
    if (capacityItemCache.has(expected)) return capacityItemCache.get(expected);

    // Les capacités peuvent avoir été importées dans le répertoire Objets du
    // monde sans être conservées dans un compendium. Leur donner la priorité.
    const worldExactMatch = game.items.find((entry) =>
      entry.type === "capacite" && normalize(entry.name) === expected
    );
    if (worldExactMatch) {
      capacityItemCache.set(expected, worldExactMatch);
      return worldExactMatch;
    }
    const worldFlexibleMatch = game.items.find((entry) =>
      entry.type === "capacite" && capacityBaseName(entry.name) === expectedBase
    );
    if (worldFlexibleMatch) {
      capacityItemCache.set(expected, worldFlexibleMatch);
      return worldFlexibleMatch;
    }

    for (const pack of game.packs.filter((entry) => entry.documentName === "Item")) {
      let index;
      try {
        index = await pack.getIndex({ fields: ["name", "type"] });
      } catch {
        continue;
      }
      const exactMatch = index.find((entry) => entry.type === "capacite" && normalize(entry.name) === expected);
      const flexibleMatch = index.find((entry) => entry.type === "capacite" && capacityBaseName(entry.name) === expectedBase);
      const match = exactMatch ?? flexibleMatch;
      if (match) {
        const document = await pack.getDocument(match._id);
        capacityItemCache.set(expected, document);
        return document;
      }
    }
    capacityItemCache.set(expected, null);
    return null;
  }

  async function resolveCapacityDocuments(names) {
    const resolved = [];
    const missing = [];
    for (const name of names) {
      const document = await findCapacityItem(name);
      if (document) resolved.push({ requestedName: name, document });
      else missing.push(name);
    }
    return { resolved, missing };
  }

  function planActorUpdates(actor, choices) {
    const updates = {};
    const changes = [];
    const lordAspects = choices.secondLord ? [choices.lord, choices.secondLord] : [choices.lord];
    const hasElu = choices.eliteCapacities.includes("Élu du Seigneur") || hasCapacity(actor, "Élu du Seigneur");

    const lordData = actor.system.aspects?.[choices.lord];
    const oldLordValue = number(lordData?.value);
    const lordCap = hasElu ? 40 : 20;
    const newLordValue = Math.min(lordCap, increasedHalf(oldLordValue));
    updates[`system.aspects.${choices.lord}.value`] = newLordValue;
    updates[`system.aspects.${choices.lord}.max`] = lordCap;
    changes.push(`${ASPECT_LABELS[choices.lord]} : ${oldLordValue} → ${newLordValue}`);

    if (hasElu) {
      for (const aspect of lordAspects) {
        updates[`system.aspects.${aspect}.max`] = 40;
        updates[`system.aspects.${aspect}.ae.mineur.max`] = 20;
        updates[`system.aspects.${aspect}.ae.majeur.max`] = 20;
      }
    }

    const aeGains = {};
    for (const aspect of choices.minorAspects) {
      const ae = actor.system.aspects[aspect].ae;
      const oldValue = number(ae.mineur.value);
      const cap = hasElu && lordAspects.includes(aspect) ? 20 : 10;
      const newValue = Math.min(cap, increasedHalf(oldValue));
      aeGains[aspect] = Math.max(0, newValue - oldValue);
      updates[`system.aspects.${aspect}.ae.mineur.value`] = 0;
      updates[`system.aspects.${aspect}.ae.majeur.value`] = newValue;
      updates[`system.aspects.${aspect}.ae.majeur.max`] = cap;
      changes.push(`${ASPECT_LABELS[aspect]} exceptionnel : mineur ${oldValue} → majeur ${newValue}`);
    }

    const defenseBase = resourceBase(actor.system, "defense");
    if (aeGains.masque) {
      updates["system.defense.base"] = defenseBase + aeGains.masque;
      changes.push(`Défense : ${defenseBase} → ${defenseBase + aeGains.masque}`);
    }
    const reactionBase = resourceBase(actor.system, "reaction");
    if (aeGains.machine) {
      updates["system.reaction.base"] = reactionBase + aeGains.machine;
      changes.push(`Réaction : ${reactionBase} → ${reactionBase + aeGains.machine}`);
    }

    for (const [key, label] of [["sante", "PS"], ["armure", "PA"], ["energie", "PE"]]) {
      const oldValue = resourceBase(actor.system, key);
      if (key !== "sante" && oldValue <= 0) continue;
      let newValue = increasedHalf(oldValue);
      if (choices.affideResource === key && choices.eliteCapacities.includes("Affidé du Seigneur")) {
        const finalAspectValues = lordAspects.map((aspect) =>
          aspect === choices.lord ? newLordValue : number(actor.system.aspects?.[aspect]?.value)
        );
        newValue += finalAspectValues.reduce((sum, value) => sum + value, 0) * 5;
      }
      updates[`system.${key}.base`] = newValue;
      updates[`system.${key}.value`] = newValue;
      changes.push(`${label} : ${oldValue} → ${newValue}`);
    }

    const barrierOld = resourceBase(actor.system, choices.barrier);
    const barrierNew = barrierOld > 0 ? increasedHalf(barrierOld) : 10;
    updates[`system.${choices.barrier}.base`] = barrierNew;
    updates[`system.${choices.barrier}.value`] = barrierNew;
    changes.push(`${choices.barrier === "bouclier" ? "Bouclier" : "CdF"} : ${barrierOld} → ${barrierNew}`);

    return { updates, changes, lordAspects };
  }

  function planItemUpdates(actor) {
    const updates = [];
    const changes = [];
    for (const item of actor.items) {
      const paths = [];
      if (item.type === "arme") paths.push("system.degats");
      if (item.type === "capacite" && item.system?.degats?.has) paths.push("system.degats.system");
      if (item.type === "capacite" && item.system?.attaque?.has) paths.push("system.attaque.degats");
      const update = { _id: item.id };
      const itemChanges = [];
      for (const path of paths) {
        const data = foundry.utils.getProperty(item, path);
        if (!data) continue;
        const dice = number(data.dice);
        const fixed = number(data.fixe);
        if (fixed > 0) {
          const value = increasedHalf(fixed);
          update[`${path}.fixe`] = value;
          itemChanges.push(`${fixed} fixes → ${value}`);
        } else if (dice > 0) {
          const value = increasedHalf(dice);
          update[`${path}.dice`] = value;
          itemChanges.push(`${dice}D6 → ${value}D6`);
        }
      }
      if (itemChanges.length) {
        updates.push(update);
        changes.push(`${item.name} : ${itemChanges.join(", ")}`);
      }
    }
    return { updates, changes };
  }

  function actionsMultiplesUpdate(actor) {
    const item = actor.items.find((entry) => entry.type === "capacite" && /^actions multiples\s*\(/i.test(normalize(entry.name)));
    if (!item) return null;
    const current = Number(item.name.match(/\((\d+)\)/)?.[1] ?? 1);
    return { _id: item.id, name: item.name.replace(/\(\d+\)/, `(${current + 1})`), before: item.name };
  }

  async function createEliteActor(sourceActor, sourceToken, choices, capacityDocuments) {
    const eliteName = `${sourceActor.name.replace(/\s*\(élite\)\s*$/iu, "")} (élite)`;
    const marker = {
      isElite: true,
      version: VERSION,
      sourceActorId: sourceActor.id,
      sourceActorUuid: sourceActor.uuid,
      seigneur: choices.lord,
      secondSeigneur: choices.secondLord ?? null,
      mode: choices.mode,
      generatedAt: new Date().toISOString(),
    };
    const elite = await sourceActor.clone({
      name: eliteName,
      folder: sourceActor.folder?.id ?? null,
      flags: {
        world: {
          knightManticoreElite: marker,
        },
      },
    }, { save: true });

    try {
      const actorPlan = planActorUpdates(sourceActor, choices);
      await elite.update(actorPlan.updates);

      const damagePlan = planItemUpdates(elite);
      if (damagePlan.updates.length) await elite.updateEmbeddedDocuments("Item", damagePlan.updates);

      const multiple = actionsMultiplesUpdate(elite);
      if (multiple) await elite.updateEmbeddedDocuments("Item", [{ _id: multiple._id, name: multiple.name }]);

      const itemData = capacityDocuments.map(({ document }) => {
        const data = document.toObject();
        delete data._id;
        return data;
      });
      if (itemData.length) await elite.createEmbeddedDocuments("Item", itemData);

      const gridSize = canvas.grid?.size || 100;
      const tokenDocument = await elite.getTokenDocument({
        x: sourceToken.document.x + gridSize,
        y: sourceToken.document.y,
        actorLink: true,
      });
      const tokenData = tokenDocument.toObject();
      // En V14, toObject() peut inclure l'ActorDelta singleton préparé par le
      // TokenDocument. Le serveur en construit déjà un lors de la création :
      // le transmettre une seconde fois provoque une erreur de singleton.
      delete tokenData._id;
      delete tokenData.delta;
      delete tokenData.actorData;
      tokenData.actorId = elite.id;
      tokenData.actorLink = true;
      await canvas.scene.createEmbeddedDocuments("Token", [tokenData]);

      return {
        elite,
        changes: [
          ...actorPlan.changes,
          ...damagePlan.changes,
          ...(multiple ? [`${multiple.before} → ${multiple.name}`] : []),
        ],
      };
    } catch (error) {
      await elite.delete();
      throw error;
    }
  }

  function previewHtml(actor, choices, actorPlan, damagePlan, missing) {
    const list = [
      ...actorPlan.changes,
      ...damagePlan.changes,
      ...(choices.generalCapacity ? [`Capacité générale : ${choices.generalCapacity}`] : []),
      ...choices.eliteCapacities.map((name) => `Capacité d’élite : ${name}`),
      ...(missing.length ? [`Introuvables dans les compendiums : ${missing.join(", ")}`] : []),
    ];
    return `<p>Créer <strong>${escapeHtml(actor.name)} (élite)</strong> dans le même dossier et placer son token à côté de l’original ?</p>
      <p><strong>Seigneur :</strong> ${ASPECT_LABELS[choices.lord]}${choices.secondLord ? ` + ${ASPECT_LABELS[choices.secondLord]}` : ""}</p>
      <p><strong>Mode :</strong> ${choices.mode === "automatic" ? "automatique" : "interactif"}</p>
      <div style="max-height:420px;overflow:auto"><ul>${list.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul></div>`;
  }

  async function run() {
    if (!game.user.isGM) return ui.notifications.error("Cette macro est réservée au MJ.");
    if (!canvas?.scene) return ui.notifications.error("Ouvre une scène avant d’exécuter la macro.");
    const controlled = canvas.tokens.controlled;
    if (controlled.length !== 1) return ui.notifications.warn("Sélectionne exactement un token de créature ou de bande.");

    const sourceToken = controlled[0];
    // Un token non lié expose un acteur synthétique dont le parent est un
    // ActorDelta. Ce document ne peut pas être cloné comme acteur du monde.
    // Retrouver l'acteur réel référencé par le token avant toute duplication.
    const actor = game.actors.get(sourceToken.document.actorId) ?? sourceToken.actor;
    if (!actor || !["creature", "bande"].includes(actor.type)) {
      return ui.notifications.error("Le token sélectionné n’est ni une créature ni une bande.");
    }
    if (foundry.utils.getProperty(actor, FLAG_PATH)?.isElite) {
      return ui.notifications.warn(`${actor.name} est déjà marqué comme créature élite.`);
    }

    const mode = await chooseMode();
    if (!mode) return;
    const lord = await chooseLord(actor);
    if (!lord) return;
    const profile = await chooseProfile(actor);
    if (!profile) return;
    const minorAspects = await chooseMinorAspects(actor, mode);
    if (minorAspects === null) return;
    const generalCapacity = await chooseGeneralCapacity(actor, mode);
    const eliteCapacities = await chooseEliteCapacities(actor, ELITE_CAPACITY_COUNTS[profile], mode);
    if (eliteCapacities === null) return;
    const barrier = await chooseBarrier(actor, mode);
    if (!barrier) return;
    const hybridationPresent = eliteCapacities.includes("Hybridation") || hasCapacity(actor, "Hybridation");
    const secondLord = hybridationPresent ? await chooseSecondLord(lord, mode) : null;
    if (hybridationPresent && !secondLord) return;
    const affideAdded = eliteCapacities.includes("Affidé du Seigneur");
    const affideResource = affideAdded ? await chooseAffideResource(actor, mode) : null;
    if (affideAdded && !affideResource) return;

    const requestedCapacities = [generalCapacity, ...eliteCapacities].filter(Boolean);
    const { resolved, missing } = await resolveCapacityDocuments(requestedCapacities);
    if (missing.length) {
      ui.notifications.error(`Capacités introuvables dans les compendiums : ${missing.join(", ")}`);
      return;
    }

    const choices = {
      mode, lord, profile, minorAspects, generalCapacity, eliteCapacities,
      barrier, secondLord, affideResource,
    };
    const actorPlan = planActorUpdates(actor, choices);
    const damagePlan = planItemUpdates(actor);
    const confirmed = await confirmDialog(
      "Confirmer la création de l’élite",
      previewHtml(actor, choices, actorPlan, damagePlan, missing),
      "Créer l’élite",
    );
    if (!confirmed) return;

    try {
      ui.notifications.info(`Création de ${actor.name} (élite)…`);
      const result = await createEliteActor(actor, sourceToken, choices, resolved);
      ui.notifications.info(`${result.elite.name} a été créé avec son token.`);
      console.group(`Knight — ${result.elite.name}`);
      console.log("Choix", choices);
      console.table(result.changes.map((change) => ({ modification: change })));
      console.groupEnd();
      result.elite.sheet.render(true);
    } catch (error) {
      console.error("Knight — échec de création de l’élite", error);
      ui.notifications.error(`Création impossible : ${error.message}`);
    }
  }

  return { run };
})();

await EliteGenerator.run();
