# Boot logic for Windows (G20). Called by scripts/up.mjs from the repo root, after it has
# created .env.
param([ValidateSet('up', 'rebuild', 'infra', 'down', 'reset')][string]$Mode = 'up')
$ErrorActionPreference = 'Stop'

$compose = @('compose', '--env-file', '.env', '-f', 'infra/docker-compose.yml')

switch ($Mode) {
  # up builds only missing images (fast restarts); rebuild picks up code changes.
  'up' { docker @compose up -d --wait }
  'rebuild' { docker @compose up -d --build --wait }
  'infra' {
    docker @compose up -d --wait postgres object-storage
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    docker @compose up object-storage-init
  }
  'down' { docker @compose down }
  'reset' { docker @compose down --volumes; if ($LASTEXITCODE -eq 0) { docker @compose up -d --build --wait } }
}
exit $LASTEXITCODE
