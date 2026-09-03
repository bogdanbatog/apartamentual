# =============================================================================
# Face PDF-ul prezentarii din index.html
# =============================================================================
# Rulare, din folderul asta:
#     powershell -ExecutionPolicy Bypass -File fa-pdf.ps1
#
# Iese `webinar-septembrie-2026.pdf`, 25 de pagini, format 297x167 mm (16:9).
#
# DE CE UN SCRIPT SI NU CTRL+P
# Ctrl+P merge, dar are o capcana: Chrome NU tipareste fundalurile decat daca
# bifezi „Grafice de fundal" din „Mai multe setari". Fara bifa aia, pleaca
# fundalul crem si bulinele colorate, adica exact tot sistemul de culori pe
# capitole, iar PDF-ul iese text negru pe alb. Scriptul nu poate uita bifa.
# Trebuie si „Margini: fara", altfel Chrome mai adauga o rama.
#
# ⚠️ Chrome are nevoie de `--user-data-dir` propriu. Fara el, daca ai Chrome
#    deschis, instanta headless incearca sa se lege de profilul tau, se incurca
#    in autentificare si NU scrie niciun fisier, iesind totusi cu cod 0.
#
# ⚠️ Se tipareste de pe un server local, nu din `file://`. La `file://`, Chrome
#    trateaza fiecare imagine ca alta origine si unele nu se incarca.
# =============================================================================

$ErrorActionPreference = 'Stop'
$dir    = $PSScriptRoot
$out    = Join-Path $dir 'webinar-septembrie-2026.pdf'
$port   = 8791
# ⚠️ Profil NOU la fiecare rulare, nu unul refolosit. Cu profil refolosit, doua
# lucruri merg prost si niciunul nu da eroare: Chrome poate servi din cache un
# `index.html` vechi, iar daca rularea dinainte a lasat profilul blocat, Chrome
# iese cu 0 FARA sa scrie PDF-ul.
$profil = Join-Path $env:TEMP ('chrome-prez-' + [guid]::NewGuid().ToString('N').Substring(0,8))

$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) { Write-Host "Nu gasesc chrome.exe."; exit 1 }

Write-Host "Pornesc serverul local pe portul $port..."
Start-Process -FilePath 'python' -ArgumentList '-m','http.server',$port,'--bind','127.0.0.1' `
              -WorkingDirectory $dir -WindowStyle Hidden
Start-Sleep -Seconds 2

# Stergem PDF-ul vechi INAINTE. Altfel, daca Chrome nu scrie nimic, verificarea
# de la final gaseste fisierul de data trecuta si raporteaza succes pe un PDF
# vechi. Exact asa a plecat o versiune neactualizata pe 3 septembrie 2026.
if (Test-Path $out) {
  try { Remove-Item $out -Force }
  catch {
    # Cel mai des: PDF-ul e deschis intr-un vizualizator, care tine fisierul blocat.
    Write-Host ""
    Write-Host "ESUAT: nu pot sterge PDF-ul vechi, e tinut deschis de alt program."
    Write-Host "Inchide $([System.IO.Path]::GetFileName($out)) (Acrobat, Edge, previzualizarea din Explorer) si ruleaza din nou."
    Get-CimInstance Win32_Process -Filter "Name like 'python%'" |
      Where-Object { $_.CommandLine -like "*http.server*$port*" } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    exit 1
  }
}
$reperTimp = Get-Date

Write-Host "Tiparesc..."
$argumente = @(
  '--headless=new'
  '--disable-gpu'
  '--no-first-run'
  '--no-default-browser-check'
  "--user-data-dir=$profil"
  '--no-pdf-header-footer'
  # Asteapta ca tot ce se compune sa fie gata inainte de a desena. Fara el,
  # pozele mari pot lipsi din PDF, fara nicio eroare.
  '--run-all-compositor-stages-before-draw'
  '--virtual-time-budget=90000'
  "--print-to-pdf=$out"
  "http://127.0.0.1:$port/index.html"
)
$p = Start-Process -FilePath $chrome -ArgumentList $argumente -Wait -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2

Get-CimInstance Win32_Process -Filter "Name like 'python%'" |
  Where-Object { $_.CommandLine -like "*http.server*$port*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Remove-Item $profil -Recurse -Force -ErrorAction SilentlyContinue

if (-not (Test-Path $out)) {
  Write-Host "ESUAT: nu s-a scris niciun PDF. Chrome a iesit cu codul $($p.ExitCode)."
  exit 1
}

$fis = Get-Item $out
$mb  = $fis.Length / 1MB

# Trei verificari, fiindca „fisierul exista" nu inseamna „fisierul e de acum".
if ($fis.LastWriteTime -lt $reperTimp) {
  Write-Host "ESUAT: PDF-ul e mai vechi decat rularea asta. Nu s-a rescris nimic."
  exit 1
}
$sursaHtml = (Get-Item (Join-Path $dir 'index.html')).LastWriteTime
if ($fis.LastWriteTime -lt $sursaHtml) {
  Write-Host "ESUAT: PDF-ul e mai vechi decat index.html."
  exit 1
}
if ($mb -lt 5) {
  Write-Host ("ESUAT: doar {0:N1} MB. Sub 5 MB inseamna ca pozele n-au intrat." -f $mb)
  exit 1
}

Write-Host ("Gata: {0}" -f $out)
Write-Host ("  {0:N1} MB, scris la {1:HH:mm:ss}" -f $mb, $fis.LastWriteTime)
