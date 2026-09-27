[CmdletBinding()]
param(
    [string]$VaultDirectory
)

$ErrorActionPreference = "Stop"
$ScriptDirectory = $PSScriptRoot
$ConverterPath = Join-Path $ScriptDirectory "convert-foundry-knight-pnj.mjs"
$ProjectDirectory = [System.IO.Path]::GetFullPath((Join-Path $ScriptDirectory ".."))

if ([string]::IsNullOrWhiteSpace($VaultDirectory)) {
    $VaultDirectory = $ProjectDirectory
}
else {
    $VaultDirectory = [System.IO.Path]::GetFullPath($VaultDirectory)
}

$DataDirectory = Join-Path $ProjectDirectory "data/bestiaire-custom"
$NotesDirectory = Join-Path $VaultDirectory "Acteurs/Bestiaire (custom)"
$CombatSheetsDirectory = Join-Path $NotesDirectory "Fiches"
$AssetsDirectory = Join-Path $VaultDirectory "Assets/bestiaire"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js est introuvable. Installez Node.js ou ajoutez la commande 'node' au PATH."
}
if (-not (Test-Path -LiteralPath $ConverterPath -PathType Leaf)) {
    throw "Convertisseur d'acteurs introuvable : $ConverterPath"
}

New-Item -ItemType Directory -Path $DataDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $NotesDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $CombatSheetsDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $AssetsDirectory -Force | Out-Null

$JsonFiles = @(Get-ChildItem -LiteralPath $DataDirectory -File -Filter "*.json" | Sort-Object Name)
if ($JsonFiles.Count -eq 0) {
    Write-Warning "Aucun export du bestiaire custom trouvé dans : $DataDirectory"
    exit 0
}

$SuccessCount = 0
$SkippedCount = 0
$FailureCount = 0

function Invoke-CreatureConversion {
    param(
        [Parameter(Mandatory)]$Actor,
        [Parameter(Mandatory)][string]$DisplayName
    )

    if ([string]$Actor.type -notin @("creature", "bande")) {
        Write-Host "Ignoré (type '$($Actor.type)') : $DisplayName"
        $script:SkippedCount++
        return
    }

    $TemporaryPath = [System.IO.Path]::GetTempFileName()
    try {
        $ActorJson = $Actor | ConvertTo-Json -Depth 100
        [System.IO.File]::WriteAllText($TemporaryPath, $ActorJson, [System.Text.UTF8Encoding]::new($false))
        Write-Host "Conversion Bestiaire : $DisplayName"
        & node $ConverterPath $TemporaryPath "--vault=$VaultDirectory" "--bestiary-folder=Bestiaire (custom)"
        if ($LASTEXITCODE -ne 0) { throw "Le convertisseur Node.js a retourné le code $LASTEXITCODE." }
        & node $ConverterPath $TemporaryPath "--vault=$VaultDirectory" "--bestiary-folder=Bestiaire (custom)" "--combat-sheet" "--no-image"
        if ($LASTEXITCODE -ne 0) { throw "La génération de la fiche de combat a retourné le code $LASTEXITCODE." }
        $script:SuccessCount++
    }
    catch {
        $script:FailureCount++
        Write-Error "Échec pour '$DisplayName' : $($_.Exception.Message)" -ErrorAction Continue
    }
    finally {
        if (Test-Path -LiteralPath $TemporaryPath) {
            Remove-Item -LiteralPath $TemporaryPath -Force
        }
    }
}

foreach ($JsonFile in $JsonFiles) {
    try {
        $JsonContent = Get-Content -LiteralPath $JsonFile.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        if ([string]$JsonContent.format -in @("knight-pnj-bundle", "knight-actor-bundle", "knight-bestiaire-bundle") -and $null -ne $JsonContent.actors) {
            $Actors = @($JsonContent.actors)
            Write-Host "Lot Foundry détecté : $($Actors.Count) acteur(s)."
            foreach ($Actor in $Actors) {
                $ActorName = if ([string]::IsNullOrWhiteSpace([string]$Actor.name)) { "Entrée du bestiaire sans nom" } else { [string]$Actor.name }
                Invoke-CreatureConversion -Actor $Actor -DisplayName $ActorName
            }
        }
        else {
            Invoke-CreatureConversion -Actor $JsonContent -DisplayName $JsonFile.Name
        }
    }
    catch {
        $FailureCount++
        Write-Error "Lecture impossible pour '$($JsonFile.Name)' : $($_.Exception.Message)" -ErrorAction Continue
    }
}

Write-Host ""
Write-Host "Import Bestiaire custom terminé : $SuccessCount réussite(s), $SkippedCount ignoré(s), $FailureCount échec(s)."
Write-Host "Fiches : $NotesDirectory"
Write-Host "Fiches de combat : $CombatSheetsDirectory"
Write-Host "Portraits : $AssetsDirectory"
if ($FailureCount -gt 0) { exit 1 }
