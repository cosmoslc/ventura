# Ventura: Cloudflare Tunnel'ni Windows xizmati qilib o'rnatish (uydagi server, ADR 0049).
#
# Administrator PowerShell'da, bir marta:
#   powershell -ExecutionPolicy Bypass -File tooling\tunnel\install-windows.ps1 -TunnelId <uuid>
#
# Oldindan (oddiy foydalanuvchi nomidan) bajarilgan bo'lishi kerak:
#   cloudflared tunnel login                     -> %USERPROFILE%\.cloudflared\cert.pem
#   cloudflared tunnel create ventura-tunnel     -> %USERPROFILE%\.cloudflared\<uuid>.json
#   cloudflared tunnel route dns ventura-tunnel admin.<domen>
#   cloudflared tunnel route dns ventura-tunnel "*.<domen>"
#
# Nima qiladi:
#   1. Xizmat profiliga (LocalSystem) sozlama va tunnel kalitini yozadi; kalit faqat SYSTEM va Administratorlarga ochiq
#   2. Yo'naltirish: admin.<domen> -> panel (127.0.0.1:<PanelPort>), *.<domen> -> WSL nginx (127.0.0.1:80)
#   3. Sozlamani tekshiradi, xizmatni o'rnatadi (yoki yangilaydi) va ishga tushiradi
# Qayta ishga tushirish xavfsiz. Kalit mazmuni ekranga chiqarilmaydi.

param(
  [Parameter(Mandatory = $true)][string]$TunnelId,
  [string]$Domain = "ventura.uz",
  [int]$PanelPort = 3000,
  [string]$Cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
)
$ErrorActionPreference = "Stop"

if ($TunnelId -notmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') { throw "TunnelId noto'g'ri (uuid)" }
if ($Domain -notmatch '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$') { throw "Domen noto'g'ri" }
if ($PanelPort -lt 1 -or $PanelPort -gt 65535) { throw "Port noto'g'ri" }
if (-not (Test-Path $Cloudflared)) { throw "cloudflared topilmadi: $Cloudflared" }
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw "Administrator PowerShell'da ishga tushiring" }

$userDir = Join-Path $env:USERPROFILE ".cloudflared"
$creds = Join-Path $userDir "$TunnelId.json"
if (-not (Test-Path $creds)) { throw "Tunnel kaliti yo'q: $creds (avval: cloudflared tunnel create)" }

# LocalSystem xizmati sozlamani shu papkadan o'qiydi
$svcDir = Join-Path $env:WINDIR "System32\config\systemprofile\.cloudflared"
New-Item -ItemType Directory -Force -Path $svcDir | Out-Null
$svcCreds = Join-Path $svcDir "$TunnelId.json"
Copy-Item -Force $creds $svcCreds
# Kalit faqat SYSTEM va Administratorlarga
icacls $svcCreds /inheritance:r /grant:r "SYSTEM:(R)" "Administrators:(F)" | Out-Null

$config = Join-Path $svcDir "config.yml"
@"
# Ventura boshqaradi (tooling/tunnel/install-windows.ps1) - qo'lda o'zgartirmang
tunnel: $TunnelId
credentials-file: $svcCreds
ingress:
  # Panel
  - hostname: admin.$Domain
    service: http://127.0.0.1:$PanelPort
  # Mijoz tizimlari: <slug>.$Domain -> WSL nginx (sayt Host bo'yicha tanlanadi)
  - hostname: "*.$Domain"
    service: http://127.0.0.1:80
  - service: http_status:404
"@ | Set-Content -Encoding ascii -Path $config

& $Cloudflared tunnel --config $config ingress validate
if ($LASTEXITCODE -ne 0) { throw "Sozlama tekshiruvdan o'tmadi" }

$svc = Get-Service -Name cloudflared -ErrorAction SilentlyContinue
if ($svc) {
  Restart-Service cloudflared
} else {
  & $Cloudflared service install
  if ($LASTEXITCODE -ne 0) { throw "Xizmatni o'rnatib bo'lmadi" }
}
Set-Service -Name cloudflared -StartupType Automatic
Start-Sleep -Seconds 5
Get-Service cloudflared | Format-List Name, Status, StartType
Write-Host "Tayyor. Tekshirish: cloudflared tunnel info $TunnelId"
