# Fair A/B: runs "before" and "after" alternately at the same fixed rate,
# and measures the servers' CPU cost per request.
# Usage:  .\loadtest\ab.ps1 -Rate 2000 -Rounds 2
param([int]$Rate = 2000, [int]$Rounds = 2)

$results = @()
for ($round = 1; $round -le $Rounds; $round++) {
  foreach ($ver in 'before', 'after') {
    Write-Host "`n===== round $round : $ver @ $Rate req/s =====" -ForegroundColor Cyan
    docker tag "ecom-server:$ver" ecom-server:latest
    docker compose up -d --no-build --force-recreate server | Out-Null
    Start-Sleep -Seconds 20
    docker compose exec redis redis-cli FLUSHALL | Out-Null

    # 5 CPU snapshots of the server containers, in the middle of the run
    $job = Start-Job {
      Start-Sleep -Seconds 20
      1..5 | ForEach-Object {
        docker stats --no-stream --format "{{.Name}} {{.CPUPerc}}" | Where-Object { $_ -match 'server' }
        Start-Sleep -Seconds 2
      }
    }

    $file = "ab-$ver-$round.json"
    & "$PSScriptRoot\run.ps1" throughput.js -K6Args @('-e', "RATE=$Rate", '-e', 'DURATION=1m', '--summary-export', "/scripts/results/$file") | Out-Null

    $cpuLines = Receive-Job $job -Wait -AutoRemoveJob
    $cpuSum = ($cpuLines | ForEach-Object { [double](($_ -split '\s+')[-1].TrimEnd('%')) } | Measure-Object -Sum).Sum
    $serverCpu = $cpuSum / 5                      # % of one core, all servers together, averaged

    $m = (Get-Content "$PSScriptRoot\results\$file" -Raw | ConvertFrom-Json).metrics
    $rps = $m.http_reqs.rate
    $results += [pscustomobject]@{
      Round              = $round
      Version            = $ver
      'Real/s'           = [math]::Round($rps)
      'p50 ms'           = [math]::Round($m.http_req_duration.med, 1)
      'p95 ms'           = [math]::Round($m.http_req_duration.'p(95)', 1)
      'Server CPU %'     = [math]::Round($serverCpu)
      'CPU ms / request' = [math]::Round(($serverCpu / 100) * 1000 / $rps, 3)
    }
    Start-Sleep -Seconds 15
  }
}

docker tag ecom-server:after ecom-server:latest   # leave the NEW version running
docker compose up -d --no-build --force-recreate server | Out-Null

$results | Format-Table -AutoSize
$results | Export-Csv "$PSScriptRoot\results\ab-$Rate.csv" -NoTypeInformation