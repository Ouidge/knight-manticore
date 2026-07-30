# Configuration
$VaultPublic = "F:\Vaults\Knight\__public"
$QuartzRoot = "F:\JdR\Knight\knight-manticore"
$ContentDest = Join-Path $QuartzRoot "content"

Write-Host "Publication Quartz..." -ForegroundColor Cyan

# Vérification du dossier source
if (-not (Test-Path -LiteralPath $VaultPublic -PathType Container)) {
    Write-Error "Le dossier source est introuvable : $VaultPublic"
    exit 1
}

# Création du dossier de destination si nécessaire
if (-not (Test-Path -LiteralPath $ContentDest -PathType Container)) {
    New-Item -Path $ContentDest -ItemType Directory -Force | Out-Null
}

# Arguments Robocopy
$RobocopyArguments = @(
    $VaultPublic
    $ContentDest
    "/MIR"
    "/FFT"
    "/COPY:DAT"
    "/DCOPY:DAT"
    "/R:3"
    "/W:1"
    "/XJ"
    "/NP"
)

# Exécution
& robocopy.exe @RobocopyArguments

$RobocopyCode = $LASTEXITCODE

# Les codes 0 à 7 sont des résultats normaux pour Robocopy.
if ($RobocopyCode -ge 8) {
    Write-Error "La publication a échoué. Code Robocopy : $RobocopyCode"
    exit $RobocopyCode
}

if ($RobocopyCode -eq 0) {
    Write-Host "Aucune modification à publier." -ForegroundColor DarkGray
} else {
    Write-Host "Publication mise à jour. Code Robocopy : $RobocopyCode" -ForegroundColor Green
}

exit 0