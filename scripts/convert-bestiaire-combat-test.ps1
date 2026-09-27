[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$JsonPath,
    [string]$VaultDirectory
)

$ErrorActionPreference = "Stop"
$ScriptDirectory = $PSScriptRoot
$ConverterPath = Join-Path $ScriptDirectory "convert-foundry-knight-pnj.mjs"
$ProjectDirectory = [System.IO.Path]::GetFullPath((Join-Path $ScriptDirectory ".."))
$JsonPath = [System.IO.Path]::GetFullPath($JsonPath)

if ([string]::IsNullOrWhiteSpace($VaultDirectory)) {
    $VaultDirectory = $ProjectDirectory
}
else {
    $VaultDirectory = [System.IO.Path]::GetFullPath($VaultDirectory)
}

if (-not (Test-Path -LiteralPath $JsonPath -PathType Leaf)) {
    throw "Export Foundry introuvable : $JsonPath"
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js est introuvable. Installez Node.js ou ajoutez la commande 'node' au PATH."
}

& node $ConverterPath $JsonPath "--vault=$VaultDirectory" "--combat-sheet"
if ($LASTEXITCODE -ne 0) {
    throw "Le convertisseur Node.js a retourné le code $LASTEXITCODE."
}

Write-Host ""
Write-Host "Prototype de fiche de combat généré pour un seul acteur."
Write-Host "La fiche se trouve dans Acteurs/Bestiaire/Fiches et commence par 'Fiche '."
Write-Host "Les autres fiches du Bestiaire n'ont pas été modifiées."
