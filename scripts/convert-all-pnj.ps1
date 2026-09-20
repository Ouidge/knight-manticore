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

$PnjDataDirectory = Join-Path $ProjectDirectory "data/pnj"
$PnjNotesDirectory = Join-Path $VaultDirectory "Personnages/PNJ"
$PnjAssetsDirectory = Join-Path $VaultDirectory "Assets/pnj"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js est introuvable. Installez Node.js ou ajoutez la commande 'node' au PATH."
}
if (-not (Test-Path -LiteralPath $ConverterPath -PathType Leaf)) {
    throw "Convertisseur PNJ introuvable : $ConverterPath"
}

New-Item -ItemType Directory -Path $PnjDataDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $PnjNotesDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $PnjAssetsDirectory -Force | Out-Null

$JsonFiles = @(Get-ChildItem -LiteralPath $PnjDataDirectory -File -Filter "*.json" | Sort-Object Name)
if ($JsonFiles.Count -eq 0) {
    Write-Warning "Aucun export PNJ trouvé dans : $PnjDataDirectory"
    exit 0
}

$SuccessCount = 0
$FailureCount = 0

function Invoke-PnjConversion {
    param(
        [Parameter(Mandatory)][string]$JsonPath,
        [Parameter(Mandatory)][string]$DisplayName
    )

    try {
        Write-Host "Conversion PNJ : $DisplayName"
        & node $ConverterPath $JsonPath "--vault=$VaultDirectory"
        if ($LASTEXITCODE -ne 0) { throw "Le convertisseur Node.js a retourné le code $LASTEXITCODE." }
        $script:SuccessCount++
    }
    catch {
        $script:FailureCount++
        Write-Error "Échec pour '$DisplayName' : $($_.Exception.Message)" -ErrorAction Continue
    }
}

foreach ($JsonFile in $JsonFiles) {
    try {
        $JsonContent = Get-Content -LiteralPath $JsonFile.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        if ([string]$JsonContent.format -eq "knight-pnj-bundle" -and $null -ne $JsonContent.actors) {
            $Actors = @($JsonContent.actors)
            Write-Host "Lot Foundry détecté : $($Actors.Count) PNJ."
            foreach ($Actor in $Actors) {
                $TemporaryPath = [System.IO.Path]::GetTempFileName()
                try {
                    $ActorJson = $Actor | ConvertTo-Json -Depth 100
                    [System.IO.File]::WriteAllText($TemporaryPath, $ActorJson, [System.Text.UTF8Encoding]::new($false))
                    $ActorName = if ([string]::IsNullOrWhiteSpace([string]$Actor.name)) { "PNJ sans nom" } else { [string]$Actor.name }
                    Invoke-PnjConversion -JsonPath $TemporaryPath -DisplayName $ActorName
                }
                finally {
                    if (Test-Path -LiteralPath $TemporaryPath) {
                        Remove-Item -LiteralPath $TemporaryPath -Force
                    }
                }
            }
        }
        else {
            Invoke-PnjConversion -JsonPath $JsonFile.FullName -DisplayName $JsonFile.Name
        }
    }
    catch {
        $FailureCount++
        Write-Error "Lecture impossible pour '$($JsonFile.Name)' : $($_.Exception.Message)" -ErrorAction Continue
    }
}

Write-Host ""
Write-Host "Conversion PNJ terminée : $SuccessCount réussite(s), $FailureCount échec(s)."
Write-Host "Fiches : $PnjNotesDirectory"
Write-Host "Portraits : $PnjAssetsDirectory"
if ($FailureCount -gt 0) { exit 1 }
