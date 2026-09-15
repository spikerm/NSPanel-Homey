$ErrorActionPreference = "Stop"

$Url = "https://raw.githubusercontent.com/Blackymas/NSPanel_HA_Blueprint/v2026041/hmi/nspanel_eu.HMI"
$Out = Join-Path $PSScriptRoot "nspanel_homey_portal.HMI"

Write-Host "Downloading Blackymas v2026041 EU HMI base..."
Invoke-WebRequest -Uri $Url -OutFile $Out

Write-Host ""
Write-Host "Ready:"
Write-Host "  $Out"
Write-Host ""
Write-Host "Open this file in Nextion Editor."
Write-Host "Then add the pages/components from HOMEY_PORTAL_COMPONENTS.csv"
Write-Host "and paste the event code from the events folder."
