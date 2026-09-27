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
    ├── Fantasy Statblocks/
    │   ├── templates/
    │   │   ├── Knight PNJ.json
    │   │   ├── Knight PNJ Combat.json
    │   │   ├── Knight Bestiaire.json
    │   │   ├── Knight Bestiaire Combat.json
    │   │   ├── Knight PJ.json
    │   │   └── Knight PJ Summary.json
    │   └── snippets/
    │       └── knight-statblocks.css
    ├── Macro Foundry/
    │   ├── macro-foundry-export-pnj.js
    │   └── macro-foundry-export-bestiaire.js
    ├── convert-foundry-knight.mjs
    ├── convert-foundry-knight-pnj.mjs
    ├── effect-normalization.mjs
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

Les scripts PNJ et Bestiaire génèrent désormais deux notes par acteur :

- la note narrative habituelle dans `Acteurs/PNJ/` ou `Acteurs/Bestiaire/` ;
- une fiche de combat autonome nommée `Fiche <Nom>.md` dans le sous-dossier
  `Fiches/` correspondant.

Les fiches de combat portent les métadonnées `type: fiche` et
`subtype: pnj` ou `subtype: creature`. Elles contiennent uniquement le
statblock afin de pouvoir être imprimées ou exportées en PDF sans le reste de
la note narrative.

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

Les notes narratives PNJ et Bestiaire ne contiennent plus de bloc Fantasy
Statblocks. Un lien vers leur fiche de combat autonome est ajouté directement
sous le titre principal. La présentation et la tactique restent dans le corps
de la note, dans une grille 60/40 qui
repasse automatiquement sur une seule colonne en affichage étroit. La fiche de
combat autonome située dans `Acteurs/PNJ/Fiches/` utilise le layout
`Knight PNJ Combat` et reprend les aspects, les aspects exceptionnels, les
valeurs de combat, les capacités, les modules et les armes. Lors d'une nouvelle
conversion, un ancien bloc délimité par `BEGIN/END PNJ STATBLOCK` est supprimé
des notes narratives sans toucher aux notes manuelles.

Dans les notes Bestiaire, le portrait de la créature est affiché sous le lien
vers la fiche de combat. La présentation et la tactique sont systématiquement
replacées avant le bloc technique Foundry (`Profil technique`, aspects, armes et
capacités), y compris lors de la mise à jour d'une note existante.

Les aspects exceptionnels sont intégrés directement dans la ligne des aspects.
Leur valeur est un wikilien vers un bloc de la note correspondante, par exemple
`[[Bête exceptionnelle#^majeur|6+]]`. Pour obtenir un aperçu compact au survol,
ajouter dans chacune des notes `Chair exceptionnelle`, `Bête exceptionnelle`,
`Machine exceptionnelle`, `Dame exceptionnelle` et `Masque exceptionnel` :

```markdown
**Bête majeure** — `= this.majeur` ^majeur

**Bête mineure** — `= this.mineur` ^mineur
```

Adapter seulement le libellé visible au nom de l’aspect. Les identifiants
`^majeur` et `^mineur` restent identiques dans les cinq notes.

Lors de la conversion, le script recherche ces cinq notes dans le coffre et lit
leurs métadonnées `majeur` et `mineur`. Pour chaque aspect exceptionnel possédé
par l’acteur, il recopie la description dans une section imprimable « Aspects
exceptionnels » placée immédiatement sous la ligne des aspects. Les valeurs
YAML simples, entre guillemets ou écrites sur plusieurs lignes avec `>` ou `|`
sont prises en charge.

Pour appliquer le rendu Knight, copier
`scripts/Fantasy Statblocks/snippets/knight-statblocks.css` dans le
dossier `.obsidian/snippets/` du coffre, puis l’activer dans **Paramètres →
Apparence → Extraits CSS**. Le style cible les six layouts Knight sans
modifier les autres statblocks du coffre.

Dans Obsidian Desktop, afficher la note en mode lecture puis lancer la commande
**Exporter au format PDF** pour imprimer son statblock. Le CSS Knight remplace
automatiquement le fond bleu nuit par un fond blanc, utilise du texte sombre et
des titres bleu marine avec un filet doré. La page est configurée en A4 paysage.
Les layouts compacts Knight PNJ Combat, Knight Bestiaire Combat et Knight PJ Summary sont
resserrés pour tenir sur une page dans les cas usuels. Il évite autant que
possible de couper une section au changement de page.

Les anciennes notes narratives conservent le statblock PNJ en trois colonnes.
Les fiches autonomes `Knight PNJ Combat` et `Knight Bestiaire Combat` suivent
un flux vertical : profil et
aspects, aspects exceptionnels, combat, armes, modules, puis une carte pleine
largeur pour chaque capacité. Sur un écran étroit, les grilles internes sont
automatiquement replacées sur une seule colonne.

Dans **Fantasy Statblocks → Manage layouts**, importer les six fichiers du
dossier `scripts/Fantasy Statblocks/templates/` :
`Knight PNJ.json`, `Knight PNJ Combat.json`, `Knight Bestiaire.json`,
`Knight Bestiaire Combat.json`, `Knight PJ.json` et `Knight PJ Summary.json`.
Une fiche de combat PNJ utilise `Knight PNJ Combat`, une fiche de combat du
bestiaire utilise `Knight Bestiaire Combat`; une fiche PJ privée utilise le layout complet `Knight PJ`;
la note agrégée `_Résumé PJ.md` utilise `Knight PJ Summary`.

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
layouts `Knight PJ` et `Knight PJ Summary`. Les deux layouts affichent les PG
et PX au format `restant/total`, ainsi que les PH au format `actuel/max`.

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
