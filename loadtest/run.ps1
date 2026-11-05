# Runs a k6 script inside Docker's network, so it hits Nginx directly
# (no Windows→Docker hop, which we saw costs ~35% on Day 22).
# Usage:  .\loadtest\run.ps1 browse.js
#         .\loadtest\run.ps1 mixed.js -K6Args @('-e', 'PEAK=100')
param(
  [Parameter(Mandatory = $true)][string]$Script,
  [string[]]$K6Args = @()
)

$dir = $PSScriptRoot
docker run --rm -i `
  --network ecom-stack_default `
  -v "${dir}:/scripts" `
  -e BASE_URL=http://client `
  grafana/k6:1.0.0 run @K6Args "/scripts/$Script"