# Installation de la fiche Knight

## Arborescence conseillée

```text
projet/
├── .obsidian/
│   └── snippets/
│       └── fiche-personnage-obsidian.css
├── __public/
│   └── fiches/
├── data/
│   └── characters/
├── fiches/
├── quartz/
│   └── styles/
│       └── fiche-personnage.scss
└── scripts/
    ├── convert-foundry-knight.mjs
    └── convert-all-characters.ps1
```

## Conversion

Depuis PowerShell, dans le dossier `scripts` :

```powershell
.\convert-all-characters.ps1
```

Le script génère les fiches Markdown dans `fiches/`, copie automatiquement
chaque fiche dans le coffre public :

```text
__public/fiches/
```

et met également à jour :

```text
.obsidian/snippets/fiche-personnage-obsidian.css
```

Si le coffre Obsidian n’est pas le dossier parent de `scripts`, préciser son
chemin. Ce chemin détermine à la fois la destination des fiches publiques et
celle du snippet CSS :

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
