# Installation de la fiche Knight

## Arborescence conseillée

```text
projet/
├── data/
│   └── characters/
├── fiches/
└── scripts/
    ├── convert-foundry-knight.mjs
    └── convert-all-characters.ps1
```

## Conversion

Depuis PowerShell, dans le dossier `scripts` :

```powershell
.\convert-all-characters.ps1
```

En cas de blocage par la politique d’exécution Windows :

```powershell
powershell -ExecutionPolicy Bypass -File .\convert-all-characters.ps1
```

## Installation du style dans Quartz

1. Copier `fiche-personnage.scss` dans `quartz/styles/`.
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
narratives, puis force la partie consacrée à la méta-armure sur la deuxième
page.
