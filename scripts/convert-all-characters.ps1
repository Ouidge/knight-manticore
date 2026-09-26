[CmdletBinding()]
param(
    [string]$VaultDirectory
)

$ErrorActionPreference = "Stop"

# Tous les chemins sont relatifs à l'emplacement de ce lanceur, pas au dossier
# depuis lequel PowerShell a été ouvert.
$ScriptDirectory = $PSScriptRoot
$ConverterPath = Join-Path $ScriptDirectory "convert-foundry-knight.mjs"
$StylePath = Join-Path $ScriptDirectory "../quartz/styles/fiche-personnage.scss"
$ProjectDirectory = [System.IO.Path]::GetFullPath(
    (Join-Path $ScriptDirectory "..")
)
if ([string]::IsNullOrWhiteSpace($VaultDirectory)) {
    $VaultDirectory = $ProjectDirectory
}
else {
    $VaultDirectory = [System.IO.Path]::GetFullPath($VaultDirectory)
}
$ObsidianSnippetsDirectory = Join-Path $VaultDirectory ".obsidian/snippets"
$ObsidianStylePath = Join-Path $ObsidianSnippetsDirectory "fiche-personnage-obsidian.css"
$CharactersDirectory = [System.IO.Path]::GetFullPath(
    (Join-Path $ScriptDirectory "../data/pj")
)
$OutputDirectory = Join-Path $VaultDirectory "__public/personnages/pj"
$MjOutputDirectory = Join-Path $VaultDirectory "Acteurs/PJ"
$EAcute = [char]0x00E9
$SummaryLabel = "R${EAcute}sum${EAcute} PJ"
$SummaryType = "r${EAcute}sum${EAcute}"
$SummaryOutputPath = Join-Path $MjOutputDirectory "_${SummaryLabel}.md"
$LegacySummaryOutputPath = Join-Path $MjOutputDirectory "${SummaryLabel}.md"
$SummaryFragmentsDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("knight-pj-summary-" + [guid]::NewGuid().ToString("N"))

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

if (-not (Test-Path -LiteralPath $StylePath -PathType Leaf)) {
    throw "Feuille de style introuvable : $StylePath"
}

if (-not (Test-Path -LiteralPath $CharactersDirectory -PathType Container)) {
    throw "Répertoire des exports Foundry introuvable : $CharactersDirectory"
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $MjOutputDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $SummaryFragmentsDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $ObsidianSnippetsDirectory -Force | Out-Null

# Produit automatiquement le snippet Obsidian depuis la feuille Quartz afin
# que les deux versions restent synchronisées.
$QuartzStyle = Get-Content -LiteralPath $StylePath -Raw -Encoding UTF8
$ObsidianStyle = $QuartzStyle.Replace(
    "article:has(.knight-sheet-marker)",
    ".markdown-preview-view.fiche-personnage .markdown-preview-sizer:has(.knight-sheet-marker)"
)
[System.IO.File]::WriteAllText(
    $ObsidianStylePath,
    $ObsidianStyle,
    [System.Text.UTF8Encoding]::new($false)
)
Write-Host "Snippet Obsidian mis à jour : $ObsidianStylePath"

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
        $MjOutputPath = Join-Path $MjOutputDirectory ("Fiche " + $OutputName)
        $SummaryFragmentPath = Join-Path $SummaryFragmentsDirectory $OutputName

        Write-Host "Conversion : $($JsonFile.Name) -> $OutputName"
        & node $ConverterPath $JsonFile.FullName $OutputPath "--mj-output=$MjOutputPath" "--summary-output=$SummaryFragmentPath"

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

if ($SuccessCount -gt 0) {
    $Summary = [System.Text.StringBuilder]::new()
    [void]$Summary.AppendLine("---")
    [void]$Summary.AppendLine("type: $SummaryType")
    [void]$Summary.AppendLine("subtype: pj")
    [void]$Summary.AppendLine("---")
    [void]$Summary.AppendLine("# $SummaryLabel")
    [void]$Summary.AppendLine()
    foreach ($Fragment in (Get-ChildItem -LiteralPath $SummaryFragmentsDirectory -File -Filter "*.md" | Sort-Object Name)) {
        [void]$Summary.AppendLine((Get-Content -LiteralPath $Fragment.FullName -Raw -Encoding UTF8).Trim())
        [void]$Summary.AppendLine()
    }
    [System.IO.File]::WriteAllText($SummaryOutputPath, $Summary.ToString(), [System.Text.UTF8Encoding]::new($false))
    if (Test-Path -LiteralPath $LegacySummaryOutputPath -PathType Leaf) {
        Remove-Item -LiteralPath $LegacySummaryOutputPath -Force
    }
    Write-Host "$SummaryLabel généré : $SummaryOutputPath"
}

if (Test-Path -LiteralPath $SummaryFragmentsDirectory) {
    Remove-Item -LiteralPath $SummaryFragmentsDirectory -Recurse -Force
}

Write-Host ""
Write-Host "Conversion terminée : $SuccessCount réussite(s), $FailureCount échec(s)."
Write-Host "Fiches créées dans : $OutputDirectory"
Write-Host "Fiches MJ créées dans : $MjOutputDirectory"

if ($FailureCount -gt 0) {
    exit 1
}
