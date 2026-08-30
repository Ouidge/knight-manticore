import fs from "fs";
import path from "path";

// Répertoire des fichiers JSON
const jsonDir = "./data/characters";
// Répertoire de sortie pour les fichiers Markdown
const outputDir = "./content/characters";

// Fonction pour extraire les caractéristiques par domaines
function extractCharacteristics(system: any): string {
    const domains = ["chair", "bete", "machine", "dame", "masque"];
    let result = "## Caractéristiques par domaines\n";

    domains.forEach((domain) => {
        if (system.aspects[domain]) {
            result += `### ${domain.charAt(0).toUpperCase() + domain.slice(1)}\n`;
            const characteristics = system.aspects[domain].caracteristiques;
            for (const [key, value] of Object.entries(characteristics)) {
                result += `- **${key.charAt(0).toUpperCase() + key.slice(1)}**: ${value.base} (OD: ${value.overdrive.base})\n`;
            }
        }
    });

    return result;
}

// Fonction pour regrouper les items par type
function groupItems(items: any[]): string {
    const grouped: Record<string, any[]> = {
        armes: [],
        modules: [],
        avantages: [],
        inconvenients: [],
        blessures: [],
    };

    items.forEach((item) => {
        switch (item.type) {
            case "arme":
                grouped.armes.push(item);
                break;
            case "module":
                grouped.modules.push(item);
                break;
            case "avantage":
                grouped.avantages.push(item);
                break;
            case "inconvenient":
                grouped.inconvenients.push(item);
                break;
            case "blessure":
                grouped.blessures.push(item);
                break;
        }
    });

    let result = "## Équipement et Traits\n";

    for (const [key, value] of Object.entries(grouped)) {
        if (value.length > 0) {
            result += `### ${key.charAt(0).toUpperCase() + key.slice(1)}\n`;
            value.forEach((item) => {
                result += `- **${item.name}** (${item.type})\n`;
            });
        }
    }

    return result;
}

// Fonction pour convertir un objet JSON en Markdown
function jsonToMarkdown(character: any): string {
    const characteristics = extractCharacteristics(character.system);
    const groupedItems = groupItems(character.items);

    return `---
title: ${character.name}
tags: ${character.type || ""}
---

# ${character.name}

**Type**: ${character.type || "Non spécifié"}
**Surnom**: ${character.system?.surnom || "Non spécifié"}
**Âge**: ${character.system?.age || "Non spécifié"}
**Archetype**: ${character.system?.archetype || "Non spécifié"}

## Description
${character.system?.description || "Aucune description disponible"}

${characteristics}

${groupedItems}
`;
}

// Fonction principale
function convertJsonToMarkdown() {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const files = fs.readdirSync(jsonDir);
    files.forEach((file) => {
        if (path.extname(file) === ".json") {
            const filePath = path.join(jsonDir, file);
            const jsonData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            const markdown = jsonToMarkdown(jsonData);
            const outputFilePath = path.join(outputDir, `${path.basename(file, ".json")}.md`);
            fs.writeFileSync(outputFilePath, markdown, "utf-8");
            console.log(`Fichier généré: ${outputFilePath}`);
        }
    });
}

convertJsonToMarkdown();