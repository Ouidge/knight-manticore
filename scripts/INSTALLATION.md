# Installation de la fiche Knight

## Arborescence conseillée

```text
projet/
├── .obsidian/
│   └── snippets/
│       └── fiche-personnage-obsidian.css
├── __public/
│   └── personnages/
│       └── pj/
├── data/
│   ├── pj/
│   └── pnj/
├── Assets/
│   └── pnj/
├── Personnages/
│   └── PNJ/
├── quartz/
│   └── styles/
│       └── fiche-personnage.scss
└── scripts/
    ├── convert-foundry-knight.mjs
    ├── convert-foundry-knight-pnj.mjs
    ├── effect-normalization.mjs
    ├── macro-foundry-export-pnj.js
    ├── export-foundry-effects.mjs
    ├── convert-all-characters.ps1
    ├── convert-all-pnj.ps1
    └── export-effects.ps1
```

## Conversion

Depuis PowerShell, dans le dossier `scripts` :

```powershell
.\convert-all-characters.ps1
```

Pour convertir les PNJ exportés dans `data/pnj/` :

```powershell
.\convert-all-pnj.ps1
```

### Export groupé depuis Foundry

1. Dans Foundry, créer une macro de type **Script** réservée au MJ.
2. Copier le contenu de `macro-foundry-export-pnj.js` dans cette macro.
3. Exécuter la macro : un unique fichier `knight-pnj-export.json` est téléchargé.
4. Placer ce fichier dans `data/pnj/`.
5. Lancer `.\convert-all-pnj.ps1`.

La macro exporte uniquement les acteurs de type `pnj` présents dans le monde
courant. Elle n’ouvre ni ne parcourt les compendiums.

Le convertisseur PNJ met à jour les notes de `Personnages/PNJ/` sans toucher au
contenu manuel situé hors du bloc `BEGIN/END FOUNDRY`. Il remplace à chaque
conversion les portraits correspondants dans `Assets/pnj/`.

Les clés techniques Foundry sont normalisées en français pour les exports PJ et
PNJ. Par exemple, `Degatscontinus 3` devient le lien Obsidian
`[[Dégâts continus|Dégâts continus 3]]`. La note locale reste
`Dégâts continus.md`, tandis que la référence Knightools utilise l’URL canonique
`https://beta.knightools.fr/fr/effect/degats-continus-x/`.

Le catalogue embarqué est synchronisé avec la liste publique KnightOOLS. Le script
ne crée aucune fiche pour un effet absent de ce catalogue. Une ancienne fiche
contenant uniquement le texte automatique « Description à compléter… » peut être
réparée à partir du catalogue ; toute fiche enrichie manuellement est préservée.

Le script PJ lit les exports placés dans `data/pj/` et génère directement les
fiches dans le coffre public :

```text
__public/personnages/pj/
```

et met également à jour :

```text
.obsidian/snippets/fiche-personnage-obsidian.css
```

Si le coffre Obsidian n’est pas le dossier parent de `scripts`, préciser son
chemin. Ce chemin détermine la destination des fiches publiques et celle du
snippet CSS :

```powershell
.\convert-all-characters.ps1 -VaultDirectory "C:\chemin\vers\mon-coffre"
```

Dans Obsidian, activer ensuite `fiche-personnage-obsidian` dans
**Paramètres → Apparence → Extraits CSS**. Cette activation n’est nécessaire
qu’une fois ; le contenu du snippet sera ensuite actualisé automatiquement.

En cas de blocage par la politique d’exécution Windows :

```powershell
powershell -ExecutionPolicy Bypass -File .\convert-all-characters.ps1
```

## Export séparé des effets

Les convertisseurs PJ et PNJ ne créent plus de notes d’effets. Le script suivant
analyse les JSON de `data/pj/` et `data/pnj/`, y compris l’export groupé des PNJ,
puis crée seulement les fiches manquantes :

```powershell
.\export-effects.ps1 -VaultDirectory "C:\chemin\vers\mon-coffre"
```

Pour les notes existantes, le script conserve le texte et les encadrés, retire
seulement l’ancien préfixe `> desc::` et ajoute un pied `ref::` s’il manque.
Les nouvelles fiches utilisent directement une description en paragraphe normal.
Les effets disposant d’une référence Knightools sont enregistrés dans
`__public/aides de jeu/effets/` avec un pied `ref::`. Les effets sans référence
publique connue sont conservés sans URL inventée dans
`__private/aides de jeu/effets/`.

## Installation du style dans Quartz

1. Copier `fiche-personnage.scss` dans `quartz/styles/`. Le script batch utilise
   précisément ce fichier pour générer également le snippet Obsidian.
2. Ajouter cette ligne **tout en haut** de `quartz/styles/custom.scss` :

```scss
@use "fiche-personnage";
```

3. Reconstruire Quartz :

```powershell
npx quartz build
```

## Impression

Depuis la fiche publiée dans Quartz, utiliser la fonction d’impression du
navigateur puis choisir **Enregistrer au format PDF**.

Réglages conseillés :

- papier A4 ;
- orientation portrait ;
- échelle 100 % ;
- en-têtes et pieds de page du navigateur désactivés ;
- arrière-plans graphiques activés si le navigateur le propose.

La feuille de style masque automatiquement le portrait et les descriptions
narratives. La pagination est laissée au navigateur afin d’utiliser au mieux
l’espace disponible.
