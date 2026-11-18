# Tempo autostart helper (Windows).
#   install : builds the web app, starts Tempo hidden now, and adds it to your Startup folder
#   remove  : removes it from Startup and stops the running agent
#   stop    : stops the running agent only
param([Parameter(Mandatory = $true)][ValidateSet("install", "remove", "stop")][string]$Action)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$startup = [Environment]::GetFolderPath("Startup")
$lnk = Join-Path $startup "Tempo.lnk"
$vbs = Join-Path $repo "scripts\start-hidden.vbs"

function Stop-Tempo {
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

    # A tiny VBScript runs node without a console window
    @"
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$repo"
sh.Run """$node"" apps\agent\src\main.ts", 0, False
"@ | Set-Content -Path $vbs -Encoding ASCII

    $shell = New-Object -ComObject WScript.Shell
    $s = $shell.CreateShortcut($lnk)
    $s.TargetPath = "$env:WINDIR\System32\wscript.exe"
    $s.Arguments = "`"$vbs`""
    $s.WorkingDirectory = $repo
    $s.Description = "Tempo - local screen-time tracker"
    $s.Save()

    Stop-Tempo
    Start-Process -FilePath "$env:WINDIR\System32\wscript.exe" -ArgumentList "`"$vbs`""
    Write-Host "Tempo will now start with Windows. It's running at http://127.0.0.1:4747"
  }
  "remove" {
    if (Test-Path $lnk) { Remove-Item $lnk; Write-Host "Removed Tempo from Startup." } else { Write-Host "Tempo wasn't in Startup." }
    if (Test-Path $vbs) { Remove-Item $vbs }
    Stop-Tempo
  }
  "stop" { Stop-Tempo }
}
