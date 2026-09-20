[CmdletBinding()]
param(
    [string]$VaultDirectory
)

$ErrorActionPreference = "Stop"
$ScriptDirectory = $PSScriptRoot
$ProjectDirectory = [System.IO.Path]::GetFullPath((Join-Path $ScriptDirectory ".."))
$ExporterPath = Join-Path $ScriptDirectory "export-foundry-effects.mjs"

if ([string]::IsNullOrWhiteSpace($VaultDirectory)) {
    $VaultDirectory = $ProjectDirectory
}
else {
    $VaultDirectory = [System.IO.Path]::GetFullPath($VaultDirectory)
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js est introuvable. Installez Node.js ou ajoutez la commande 'node' au PATH."
}

$JsonFiles = @(
    foreach ($Directory in @((Join-Path $ProjectDirectory "data/pj"), (Join-Path $ProjectDirectory "data/pnj"))) {
        if (Test-Path -LiteralPath $Directory -PathType Container) {
            Get-ChildItem -LiteralPath $Directory -File -Filter "*.json"
        }
    }
) | Sort-Object FullName

if ($JsonFiles.Count -eq 0) {
    Write-Warning "Aucun export JSON trouvé dans data/pj ou data/pnj."
    exit 0
}

$FailureCount = 0
foreach ($JsonFile in $JsonFiles) {
    try {
        Write-Host "Analyse des effets : $($JsonFile.Name)"
        & node $ExporterPath $JsonFile.FullName "--vault=$VaultDirectory"
        if ($LASTEXITCODE -ne 0) { throw "L’exporteur Node.js a retourné le code $LASTEXITCODE." }
    }
    catch {
        $FailureCount++
        Write-Error "Échec pour '$($JsonFile.Name)' : $($_.Exception.Message)" -ErrorAction Continue
    }
}

if ($FailureCount -gt 0) { exit 1 }
Write-Host "Export des effets terminé. Les fiches existantes ont été préservées."
