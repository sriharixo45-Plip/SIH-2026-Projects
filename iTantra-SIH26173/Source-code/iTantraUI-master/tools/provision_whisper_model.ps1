param(
    [string]$Serial,
    [string]$ModelDirectory = (Join-Path $env:LOCALAPPDATA 'iTantra\models')
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $ModelDirectory | Out-Null

$models = @(
    @{ Name = 'ggml-tiny.en.bin'; Sha1 = 'c78c86eb1a8faa21b369bcd33207cc90d64ae9df'; Uri = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin?download=true' },
    @{ Name = 'ggml-tiny.bin'; Sha1 = 'bd577a113a864445d4c299885e0cb97d4ba92b5f'; Uri = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin?download=true' }
)

foreach ($model in $models) {
    $path = Join-Path $ModelDirectory $model.Name
    if (-not (Test-Path -LiteralPath $path) -or
        (Get-FileHash -LiteralPath $path -Algorithm SHA1).Hash.ToLowerInvariant() -ne $model.Sha1) {
        $partialPath = "$path.partial"
        curl.exe -L --fail --retry 3 --connect-timeout 20 --max-time 1800 -o $partialPath $model.Uri
        if ($LASTEXITCODE -ne 0) { throw "Download failed for $($model.Name) (curl exit $LASTEXITCODE)" }
        $actual = (Get-FileHash -LiteralPath $partialPath -Algorithm SHA1).Hash.ToLowerInvariant()
        if ($actual -ne $model.Sha1) {
            Remove-Item -LiteralPath $partialPath -Force
            throw "Checksum mismatch for $($model.Name): $actual"
        }
        Move-Item -LiteralPath $partialPath -Destination $path -Force
    }
    $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA1).Hash.ToLowerInvariant()
    if ($actual -ne $model.Sha1) { throw "Checksum mismatch for $($model.Name): $actual" }
}

$adb = Get-Command adb -ErrorAction Stop | Select-Object -ExpandProperty Source
$devices = @(& $adb devices | Select-String '\sdevice$')
if ([string]::IsNullOrWhiteSpace($Serial)) {
    if ($devices.Count -ne 1) { throw "Expected one online device; found $($devices.Count). Pass -Serial to select a device." }
    $Serial = ($devices[0].ToString() -split '\s+')[0]
}

$remoteModels = '/sdcard/Android/data/com.example.itantraui/files/models'
& $adb -s $Serial shell mkdir -p $remoteModels
if ($LASTEXITCODE -ne 0) { throw 'Could not create the app-specific model directory on the device.' }
foreach ($model in $models) {
    & $adb -s $Serial push (Join-Path $ModelDirectory $model.Name) "$remoteModels/$($model.Name)"
    if ($LASTEXITCODE -ne 0) { throw "Could not provision $($model.Name) to the device." }
    Write-Host "Provisioned verified $($model.Name) to ${Serial}:$remoteModels"
}
