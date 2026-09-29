[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$VaultDirectory
)

$ErrorActionPreference = "Stop"
$ScriptDirectory = $PSScriptRoot
$VaultDirectory = [System.IO.Path]::GetFullPath($VaultDirectory)

$SnippetSource = Join-Path $ScriptDirectory "Fantasy Statblocks/snippets/knight-statblocks.css"
$SnippetTargetDirectory = Join-Path $VaultDirectory ".obsidian/snippets"
$TemplateTargetDirectory = Join-Path $VaultDirectory "__plugins/templates"
$TemplaterTargetDirectory = Join-Path $TemplateTargetDirectory "Templater"
$QuickAddTargetDirectory = Join-Path $TemplateTargetDirectory "QuickAdd"
$QuickAddSourceDirectory = Join-Path $ScriptDirectory "QuickAdd"

if (-not (Test-Path -LiteralPath $SnippetSource -PathType Leaf)) {
    throw "Snippet Fantasy Statblocks introuvable : $SnippetSource"
}
if (-not (Test-Path -LiteralPath $QuickAddSourceDirectory -PathType Container)) {
    throw "Dossier QuickAdd introuvable : $QuickAddSourceDirectory"
}

New-Item -ItemType Directory -Path $SnippetTargetDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $TemplateTargetDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $TemplaterTargetDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $QuickAddTargetDirectory -Force | Out-Null

$SnippetTarget = Join-Path $SnippetTargetDirectory "knight-statblocks.css"
Copy-Item -LiteralPath $SnippetSource -Destination $SnippetTarget -Force
Write-Host "Snippet Obsidian synchronisé : $SnippetTarget"

foreach ($UserScript in (Get-ChildItem -LiteralPath $QuickAddSourceDirectory -File -Filter "*.js" | Sort-Object Name)) {
    $Target = Join-Path $QuickAddTargetDirectory $UserScript.Name
    Copy-Item -LiteralPath $UserScript.FullName -Destination $Target -Force
    Write-Host "Script QuickAdd synchronisé : $Target"
}

# Nettoyage ciblé des anciens noms placés à la racine. Aucun autre modèle du
# Vault n'est touché.
$LegacyAssets = @(
    "Planche impression A4 - 2 fiches.md",
    "Planche PJ A4 - 2 cartes recto verso.md",
    "quickadd-planche-pj-duplex.js"
)
foreach ($LegacyAsset in $LegacyAssets) {
    $LegacyPath = Join-Path $TemplateTargetDirectory $LegacyAsset
    if (Test-Path -LiteralPath $LegacyPath -PathType Leaf) {
        Remove-Item -LiteralPath $LegacyPath -Force
        Write-Host "Ancien modèle supprimé : $LegacyPath"
    }
}

$ObsoleteTemplaterPath = Join-Path $TemplaterTargetDirectory "Impression - 2 fiches PNJ-Bestiaire A4.md"
if (Test-Path -LiteralPath $ObsoleteTemplaterPath -PathType Leaf) {
    Remove-Item -LiteralPath $ObsoleteTemplaterPath -Force
    Write-Host "Ancien modèle Templater supprimé : $ObsoleteTemplaterPath"
}
