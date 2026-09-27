# Essai de fiche de combat Bestiaire

Ce prototype ne modifie pas le layout `Knight Bestiaire` existant.

1. Importer `Knight Bestiaire Combat.json` dans Fantasy Statblocks.
2. Remplacer le snippet `knight-statblocks.css`, puis le désactiver et le
   réactiver dans Obsidian.
3. Générer uniquement la fiche à tester :

```powershell
.\convert-bestiaire-combat-test.ps1 `
  -JsonPath ".\data\bestiaire\fvtt-Actor-le-predateur-couronne-d7u8cHzwYlYUr2Zk.json" `
  -VaultDirectory "CHEMIN_DU_VAULT"
```

Le script crée une fiche séparée, sans recopier le corps narratif de la note :

```text
Acteurs/Bestiaire/Fiches/Fiche <Nom de la créature>.md
```

Cette fiche utilise le layout `Knight Bestiaire Combat` et contient uniquement
les métadonnées `type: fiche`, `subtype: creature` et le statblock. La note
Bestiaire d'origine et les autres notes ne sont pas modifiées.

Il suffit donc d'ouvrir cette fiche séparée pour l'imprimer ou l'exporter en PDF
au format A4 paysage.
