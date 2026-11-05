# Usage:  .\loadtest\stress.ps1 -Label before -Rates 3000,4000,6000
param(
  [int[]]$Rates = @(1000, 2000, 3000, 4000, 6000),
  [string]$Label = 'run'
)

$results = @()
foreach ($rate in $Rates) {
  Write-Host "`n===== [$Label] $rate req/s for 1 minute =====" -ForegroundColor Cyan
  $job = Start-Job { Start-Sleep -Seconds 35; docker stats --no-stream --format "{{.Name}}`t{{.CPUPerc}}" }

  $file = "stress-$Label-$rate.json"
  & "$PSScriptRoot\run.ps1" throughput.js -K6Args @('-e', "RATE=$rate", '-e', 'DURATION=1m', '--summary-export', "/scripts/results/$file") | Out-Null
  Receive-Job $job -Wait -AutoRemoveJob | Sort-Object | ForEach-Object { "   $_" }

  $m = (Get-Content "$PSScriptRoot\results\$file" -Raw | ConvertFrom-Json).metrics
  $results += [pscustomobject]@{
    Label      = $Label
    Target     = $rate
    'Real/s'   = [math]::Round($m.http_reqs.rate)
    'p50 ms'   = [math]::Round($m.http_req_duration.med, 1)
    'p95 ms'   = [math]::Round($m.http_req_duration.'p(95)', 1)
    'max ms'   = [math]::Round($m.http_req_duration.max)
    Errors     = '{0:P2}' -f $m.http_req_failed.value
    Dropped    = [int]$m.dropped_iterations.count
    'Busy VUs' = $m.vus.max
  }
  Start-Sleep -Seconds 15
}

$results | Format-Table -AutoSize
$results | Export-Csv "$PSScriptRoot\results\stress-$Label.csv" -NoTypeInformation
