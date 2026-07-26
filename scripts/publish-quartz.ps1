# Configuration
$VaultPublic = "F:\Vaults\Knight\__public"
$QuartzRoot = "F:\JdR\Knight\knight-manticore"

$ContentDest = Join-Path $QuartzRoot "content"
$ImagesSource = Join-Path $VaultPublic "__images"
$StaticDest = Join-Path $QuartzRoot "static\__images"

Write-Host "Publication Quartz..." -ForegroundColor Cyan

# Nettoyage du contenu Quartz
if (Test-Path $ContentDest) {
    Remove-Item "$ContentDest\*" -Recurse -Force
} else {
    New-Item $ContentDest -ItemType Directory | Out-Null
}

# Copie des notes publiques
Copy-Item `
    -Path "$VaultPublic\*" `
    -Destination $ContentDest `
    -Recurse `
    -Force `
    -Exclude "__images"

# Gestion des images
if (Test-Path $ImagesSource) {
    if (Test-Path $StaticDest) {
        Remove-Item "$StaticDest\*" -Recurse -Force
    } else {
        New-Item $StaticDest -ItemType Directory | Out-Null
    }

    Copy-Item `
        -Path "$ImagesSource\*" `
        -Destination $StaticDest `
        -Recurse `
        -Force
}

Write-Host "Copie terminée." -ForegroundColor Green