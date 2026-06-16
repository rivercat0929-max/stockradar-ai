$ErrorActionPreference = "Stop"

function Text([int[]]$Codes) {
  return -join ($Codes | ForEach-Object { [char]$_ })
}

function Say([int[]]$Codes) {
  Write-Host (Text $Codes)
}

Write-Host ""
Write-Host "========================================"
Write-Host " StockRadar AI One-Click Deploy"
Write-Host "========================================"
Write-Host ""

if (-not (Test-Path -LiteralPath "package.json")) {
  Say @(35831,22312,32,115,116,111,99,107,114,97,100,97,114,45,97,105,32,39033,30446,26681,30446,24405,36816,34892,26412,24037,20855,12290)
  exit 1
}

if (-not (Test-Path -LiteralPath ".env")) {
  Say @(26410,25214,21040,32,46,101,110,118,46,108,111,99,97,108,12290)
  Say @(35831,20808,22312,39033,30446,26681,30446,24405,21019,24314,32,46,101,110,118,46,108,111,99,97,108,65292,24182,20889,20837,65306)
  Write-Host ""
  Write-Host "FMP_API_KEY=your_key_here"
  Write-Host ""
  exit 1
}

Say @(27491,22312,23433,35013,20381,36182,46,46,46)
npm.cmd install
if ($LASTEXITCODE -ne 0) {
  Say @(20381,36182,23433,35013,22833,36133,65292,35831,26816,26597,32,110,112,109,32,38169,35823,20449,24687,12290)
  exit $LASTEXITCODE
}

Write-Host ""
Say @(27491,22312,26500,24314,39033,30446,46,46,46)
npm.cmd run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "Build failed. Please fix errors before deploying."
  exit $LASTEXITCODE
}

Write-Host ""
Say @(26500,24314,25104,21151,65292,27491,22312,26597,30475,32,71,105,116,32,29366,24577,46,46,46)
git status

Write-Host ""
Say @(27491,22312,26242,23384,21464,26356,46,46,46)
git add .
if ($LASTEXITCODE -ne 0) {
  Say @(103,105,116,32,97,100,100,32,22833,36133,65292,35831,26816,26597,32,71,105,116,32,29366,24577,12290)
  exit $LASTEXITCODE
}

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Say @(27809,26377,21487,25552,20132,20869,23481,65292,36339,36807,32,99,111,109,109,105,116,12290)
} else {
  Say @(27491,22312,21019,24314,25552,20132,46,46,46)
  git commit -m "Deploy latest StockRadar AI update"
  if ($LASTEXITCODE -ne 0) {
    Say @(25552,20132,22833,36133,65292,35831,26816,26597,32,71,105,116,32,36755,20986,12290)
    exit $LASTEXITCODE
  }
}

Write-Host ""
Say @(27491,22312,25512,36865,21040,32,111,114,105,103,105,110,32,109,97,105,110,46,46,46)
git push origin main
if ($LASTEXITCODE -ne 0) {
  Say @(25512,36865,22833,36133,65292,35831,26816,26597,32593,32476,12289,26435,38480,25110,36828,31471,20998,25903,29366,24577,12290)
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Deploy command completed."
Write-Host "Please check Vercel dashboard for deployment status."
