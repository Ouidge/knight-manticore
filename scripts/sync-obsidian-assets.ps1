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
$TemplaterSourceDirectory = Join-Path $ScriptDirectory "Templater"
$QuickAddSourceDirectory = Join-Path $ScriptDirectory "QuickAdd"

if (-not (Test-Path -LiteralPath $SnippetSource -PathType Leaf)) {
    throw "Snippet Fantasy Statblocks introuvable : $SnippetSource"
}
if (-not (Test-Path -LiteralPath $TemplaterSourceDirectory -PathType Container)) {
    throw "Dossier Templater introuvable : $TemplaterSourceDirectory"
}
if (-not (Test-Path -LiteralPath $QuickAddSourceDirectory -PathType Container)) {
    throw "Dossier QuickAdd introuvable : $QuickAddSourceDirectory"
}

New-Item -ItemType Directory -Path $SnippetTargetDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $TemplateTargetDirectory -Force | Out-Null

$SnippetTarget = Join-Path $SnippetTargetDirectory "knight-statblocks.css"
Copy-Item -LiteralPath $SnippetSource -Destination $SnippetTarget -Force
Write-Host "Snippet Obsidian synchronisé : $SnippetTarget"

foreach ($Template in (Get-ChildItem -LiteralPath $TemplaterSourceDirectory -File -Filter "*.md" | Sort-Object Name)) {
    $Target = Join-Path $TemplateTargetDirectory $Template.Name
    Copy-Item -LiteralPath $Template.FullName -Destination $Target -Force
    Write-Host "Modèle Templater synchronisé : $Target"
}

foreach ($UserScript in (Get-ChildItem -LiteralPath $QuickAddSourceDirectory -File -Filter "*.js" | Sort-Object Name)) {
    $Target = Join-Path $TemplateTargetDirectory $UserScript.Name
    Copy-Item -LiteralPath $UserScript.FullName -Destination $Target -Force
    Write-Host "Script QuickAdd synchronisé : $Target"
}
