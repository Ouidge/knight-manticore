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
│   ├── pnj/
│   └── bestiaire/
├── Assets/
│   ├── pnj/
│   └── bestiaire/
├── Acteurs/
│   ├── PJ/
│   ├── PNJ/
│   └── Bestiaire/
├── quartz/
│   └── styles/
│       └── fiche-personnage.scss
└── scripts/
    ├── convert-foundry-knight.mjs
    ├── convert-foundry-knight-pnj.mjs
    ├── effect-normalization.mjs
    ├── macro-foundry-export-pnj.js
    ├── macro-foundry-export-bestiaire.js
    ├── export-foundry-effects.mjs
    ├── convert-all-characters.ps1
    ├── convert-all-pnj.ps1
    ├── convert-all-bestiaire.ps1
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

Pour importer uniquement le bestiaire, placer les exports JSON dans
`data/bestiaire/`, puis lancer :

```powershell
.\convert-all-bestiaire.ps1
```

Le script accepte un export individuel ou le lot produit par la macro Foundry.
Dans un lot mixte, seuls les acteurs de type `creature` sont importés.

Pour exporter uniquement le bestiaire depuis Foundry :

1. créer une macro de type **Script** réservée au MJ ;
2. y copier `macro-foundry-export-bestiaire.js` ;
3. exécuter la macro pour obtenir `knight-bestiaire-export.json` ;
4. placer ce fichier dans `data/bestiaire/` ;
5. lancer `.\convert-all-bestiaire.ps1`.

La macro n’exporte que les acteurs de type `creature`. Comme pour les PNJ, les
créatures placées dans un dossier dont le nom commence par `_`, ou dans l’un de
ses sous-dossiers, sont ignorées.

### Export groupé depuis Foundry

1. Dans Foundry, créer une macro de type **Script** réservée au MJ.
2. Copier le contenu de `macro-foundry-export-pnj.js` dans cette macro.
3. Exécuter la macro : un unique fichier `knight-acteurs-export.json` est téléchargé.
4. Placer ce fichier dans `data/pnj/`.
5. Lancer `.\convert-all-pnj.ps1`.

La macro exporte les acteurs de type `pnj` et `creature` présents dans le monde
courant. Elle n’ouvre ni ne parcourt les compendiums. Les acteurs rangés dans un
dossier dont le nom commence par `_`, ou dans l’un de ses sous-dossiers, sont
ignorés. Pour chaque PNJ exporté, le nom de son dossier direct dans Foundry est
écrit dans la métadonnée `faction` de sa fiche Obsidian. Un PNJ sans dossier
reçoit une valeur vide.

Le convertisseur met à jour les notes de `Acteurs/PNJ/` et
`Acteurs/Bestiaire/` sans toucher au
contenu manuel situé hors du bloc `BEGIN/END FOUNDRY`. Il remplace à chaque
conversion les portraits correspondants dans `Assets/pnj/`. Il n’ajoute pas le
tag `#campagne` et retire cette ligne des fiches créées par une ancienne version.
Juste après le frontmatter, il maintient le titre dynamique, un court résumé
(`nom`, `titre`, `faction`, `lieu` et `ref`), puis un bloc Dataview affichant le
portrait sur 150 pixels de large, les `traits` et les `motivations`. Les
métadonnées manquantes sont créées avec leur valeur par défaut, sans remplacer
le contenu déjà renseigné manuellement.

Le bloc manuel « Notes de campagne » est conservé juste sous ce résumé et avant
la Dataview. Le convertisseur peut le déplacer à cet emplacement, mais ne
remplace jamais son contenu.

Le convertisseur maintient également un bloc `statblock` utilisant le layout
`Knight PNJ` de Fantasy Statblocks. La présentation et la tactique restent dans
le corps de la note, juste avant ce statblock compact, dans une grille 60/40
qui repasse automatiquement sur une seule colonne en affichage étroit. Celui-ci reprend les
aspects et aspects exceptionnels, les valeurs de combat, les capacités, les
modules et les armes. Le portrait reste affiché dans la Dataview en tête de
fiche et n’est pas répété dans le statblock. Le layout ne contient plus de blocs
`description`, `image` ou `tactique`. Le statblock est délimité par
`BEGIN/END PNJ STATBLOCK` et peut donc être remplacé sans toucher aux notes
manuelles.

Pour appliquer le rendu Knight, copier `knight-statblocks.css` dans le
dossier `.obsidian/snippets/` du coffre, puis l’activer dans **Paramètres →
Apparence → Extraits CSS**. Le style cible les quatre layouts Knight sans
modifier les autres statblocks du coffre.

Dans **Fantasy Statblocks → Manage layouts**, importer les quatre fichiers
`Knight PNJ.json`, `Knight Bestiaire.json`, `Knight PJ.json` et
`Knight PJ Summary.json`. Une fiche du bestiaire utilise le layout compact
`Knight Bestiaire`; une fiche PJ privée utilise le layout complet `Knight PJ`;
la note agrégée `Résumé PJ.md` utilise `Knight PJ Summary`.

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
fiches publiques dans :

```text
__public/personnages/pj/
```

La même exécution génère les fiches MJ `Fiche <Nom>.md` et la synthèse
`_Résumé PJ.md` dans `Acteurs/PJ/`. Le préfixe `_` place la synthèse en tête du
dossier sans apparaître dans son titre. Les fiches MJ utilisent respectivement les
layouts `Knight PJ` et `Knight PJ Summary`.

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
@use "./fiche-personnage";
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
