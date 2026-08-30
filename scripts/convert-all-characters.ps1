[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Tous les chemins sont relatifs à l'emplacement de ce lanceur, pas au dossier
# depuis lequel PowerShell a été ouvert.
$ScriptDirectory = $PSScriptRoot
$ConverterPath = Join-Path $ScriptDirectory "convert-foundry-knight.mjs"
$CharactersDirectory = [System.IO.Path]::GetFullPath(
    (Join-Path $ScriptDirectory "../data/characters")
)
$OutputDirectory = [System.IO.Path]::GetFullPath(
    (Join-Path $ScriptDirectory "../fiches")
)

function ConvertTo-SafeFileName {
    param([Parameter(Mandatory)][string]$Name)

    $invalidCharacters = [System.IO.Path]::GetInvalidFileNameChars()
    $result = $Name
    foreach ($character in $invalidCharacters) {
        $result = $result.Replace([string]$character, "-")
    }

    $result = $result.Trim().TrimEnd(".")
    if ([string]::IsNullOrWhiteSpace($result)) {
        return "personnage"
    }

    return $result
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js est introuvable. Installez Node.js ou ajoutez la commande 'node' au PATH."
}

if (-not (Test-Path -LiteralPath $ConverterPath -PathType Leaf)) {
    throw "Convertisseur introuvable : $ConverterPath"
}

if (-not (Test-Path -LiteralPath $CharactersDirectory -PathType Container)) {
    throw "Répertoire des exports Foundry introuvable : $CharactersDirectory"
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

$JsonFiles = @(
    Get-ChildItem -LiteralPath $CharactersDirectory -File -Filter "*.json" |
        Sort-Object Name
)

if ($JsonFiles.Count -eq 0) {
    Write-Warning "Aucun fichier JSON trouvé dans : $CharactersDirectory"
    exit 0
}

$SuccessCount = 0
$FailureCount = 0
$UsedOutputNames = @{}

foreach ($JsonFile in $JsonFiles) {
    try {
        $Actor = Get-Content -LiteralPath $JsonFile.FullName -Raw -Encoding UTF8 |
            ConvertFrom-Json

        if ([string]::IsNullOrWhiteSpace([string]$Actor.name)) {
            throw "Le JSON ne contient pas de nom de personnage dans la propriété 'name'."
        }

        $SafeName = ConvertTo-SafeFileName -Name ([string]$Actor.name)
        $OutputName = "$SafeName.md"

        # Évite d'écraser silencieusement une fiche si deux acteurs portent le
        # même nom. Le second fichier devient par exemple « Forge-2.md ».
        if ($UsedOutputNames.ContainsKey($OutputName.ToLowerInvariant())) {
            $UsedOutputNames[$OutputName.ToLowerInvariant()]++
            $Suffix = $UsedOutputNames[$OutputName.ToLowerInvariant()]
            $OutputName = "$SafeName-$Suffix.md"
        }
        else {
            $UsedOutputNames[$OutputName.ToLowerInvariant()] = 1
        }

        $OutputPath = Join-Path $OutputDirectory $OutputName

        Write-Host "Conversion : $($JsonFile.Name) -> $OutputName"
        & node $ConverterPath $JsonFile.FullName $OutputPath

        if ($LASTEXITCODE -ne 0) {
            throw "Le convertisseur Node.js a retourné le code $LASTEXITCODE."
        }

        $SuccessCount++
    }
    catch {
        $FailureCount++
        Write-Error "Échec pour '$($JsonFile.Name)' : $($_.Exception.Message)" -ErrorAction Continue
    }
}

Write-Host ""
Write-Host "Conversion terminée : $SuccessCount réussite(s), $FailureCount échec(s)."
Write-Host "Fiches créées dans : $OutputDirectory"

if ($FailureCount -gt 0) {
    exit 1
}

