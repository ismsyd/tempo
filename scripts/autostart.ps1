# Tempo autostart helper (Windows) — uses Task Scheduler.
#   install : builds the web app, registers a "Tempo" task that runs at logon, and starts it now
#   remove  : removes the task and stops the running agent
#   stop    : stops the running agent only
#   start   : starts the task now
#
# Why Task Scheduler (and not the Startup folder or a direct launch)?
# Programs launched from packaged apps (e.g. a terminal inside another app) can be sandboxed so that
# their AppData writes are redirected. A scheduled task always runs as a normal program, survives
# battery mode, and is restarted automatically if it ever crashes.
param([Parameter(Mandatory = $true)][ValidateSet("install", "remove", "stop", "start")][string]$Action)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$vbs = Join-Path $repo "scripts\start-hidden.vbs"
$taskName = "Tempo"
$oldLnk = Join-Path ([Environment]::GetFolderPath("Startup")) "Tempo.lnk"

function Stop-Tempo {
  # Stop the watcher first, otherwise it would immediately relaunch Tempo
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='wscript.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*start-hidden.vbs*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  $conns = Get-NetTCPConnection -LocalPort 4747 -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    if ($p -and $p.ProcessName -eq "node") {
      Stop-Process -Id $p.Id
      Write-Host "Stopped Tempo (process $($p.Id))."
    }
  }
}

switch ($Action) {
  "install" {
    $node = (Get-Command node -ErrorAction Stop).Source
    Push-Location $repo
    Write-Host "Building the web app..."
    npm run build | Out-Null
    Pop-Location

    # Runs node hidden and acts as a watcher: if Tempo ever stops unexpectedly, it's relaunched after 5 s
    @"
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$repo"
Do
  rc = sh.Run("""$node"" apps\agent\src\main.ts", 0, True)
  If rc = 0 Then Exit Do
  WScript.Sleep 5000
Loop
"@ | Set-Content -Path $vbs -Encoding ASCII

    $taskAction = New-ScheduledTaskAction -Execute "$env:WINDIR\System32\wscript.exe" -Argument "`"$vbs`"" -WorkingDirectory $repo
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
      -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $trigger -Settings $settings -Principal $principal `
      -Description "Tempo - local screen-time tracker" -Force | Out-Null

    if (Test-Path $oldLnk) { Remove-Item $oldLnk; Write-Host "Removed the old Startup-folder shortcut." }
    Stop-Tempo
    Start-Sleep -Milliseconds 500
    Start-ScheduledTask -TaskName $taskName
    Write-Host "Tempo will start every time you log in. It's running at http://127.0.0.1:4747"
  }
  "start" { Start-ScheduledTask -TaskName $taskName; Write-Host "Started." }
  "remove" {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
      Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
      Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
      Write-Host "Removed the Tempo task."
    } else { Write-Host "Tempo wasn't set to start automatically." }
    if (Test-Path $oldLnk) { Remove-Item $oldLnk }
    if (Test-Path $vbs) { Remove-Item $vbs }
    Stop-Tempo
  }
  "stop" { Stop-Tempo }
}
