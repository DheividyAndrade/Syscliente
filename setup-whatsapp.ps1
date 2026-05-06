# Setup Evolution API - WhatsApp Integration
# Run this script as Administrator

Write-Host @'
========================================
  Syscliente - Setup WhatsApp
========================================
'@ -ForegroundColor Cyan

# Check if Docker is installed
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Host "`n[!] Docker nao encontrado. Escolha uma opcao:" -ForegroundColor Yellow
    Write-Host "  1. Instalar Docker Desktop (recomendado para producao)"
    Write-Host "  2. Usar Evolution API via Node.js (modo dev, sem Docker)"
    $opcao = Read-Host "`nDigite 1 ou 2"

    if ($opcao -eq "1") {
        Write-Host "`nInstalando Docker Desktop via winget..." -ForegroundColor Green
        winget install Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
        Write-Host "`n[!] Sera necessario reiniciar o computador apos a instalacao." -ForegroundColor Yellow
        Write-Host "Depois de reiniciar e abrir o Docker Desktop, execute: docker-compose up -d" -ForegroundColor Green
        pause
        exit
    }
}

# Option 2 or if Docker already exists
if ($docker) {
    Write-Host "`n[✓] Docker encontrado. Iniciando Evolution API..." -ForegroundColor Green
    docker-compose up -d

    Write-Host "`n[✓] Evolution API iniciada!" -ForegroundColor Green
    Write-Host "    URL: http://localhost:8080"
    Write-Host "    API Key: sk-evo-d7f8a3b2c1e4f5a6b7c8d9e0f1a2b3c4"

    Write-Host "`nProximos passos:" -ForegroundColor Cyan
    Write-Host "  1. Acesse http://localhost:8080"
    Write-Host "  2. Va em 'Instances' > 'Add Instance'"
    Write-Host "  3. Nome: default"
    Write-Host "  4. Clique em 'QR Code' e escaneie com o WhatsApp"
    Write-Host "  5. Configure o webhook para: http://localhost:3001/api/webhook/whatsapp"
    Write-Host "     Headers: x-webhook-secret = whsec-syscliente-2024"
    Write-Host "  6. Eventos habilitados: MESSAGES_UPSERT"
} else {
    Write-Host "`n[!] Opcao 2 selecionada - usando Evolution API via Node.js" -ForegroundColor Yellow
    Write-Host "`nClonando Evolution API..." -ForegroundColor Green

    $evoDir = "$env:TEMP\evolution-api"
    if (Test-Path $evoDir) { Remove-Item -Recurse -Force $evoDir }
    git clone https://github.com/EvolutionAPI/evolution-api.git $evoDir
    Set-Location $evoDir
    npm install
    Copy-Item src\config\env.yml.example env.yml -Force

    Write-Host "`n[✓] Evolution API clonada. Para iniciar:" -ForegroundColor Green
    Write-Host "   cd $evoDir"
    Write-Host "   npm run start:dev"
    Write-Host "`n  A API estara disponivel em: http://localhost:8080"
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Syscliente Backend: http://localhost:3001"
Write-Host "  Syscliente Frontend: http://localhost:5173"
Write-Host "  Evolution API: http://localhost:8080"
Write-Host "========================================" -ForegroundColor Cyan
pause
