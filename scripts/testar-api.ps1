<#
.SYNOPSIS
    Roda a suíte de testes da API dentro de um container Linux.

.DESCRIPTION
    Existe por causa do Smart App Control do Windows.

    Os testes de integração usam Testcontainers, que carrega `Docker.DotNet.Handler.Abstractions.dll`
    — uma DLL de terceiro sem assinatura digital. Com o Smart App Control ligado, o Windows recusa
    carregá-la no `testhost.exe` (evento 3077 do Code Integrity, erro 0x800711C7), e os 17 testes de
    integração falham antes de rodar uma linha. Os 76 testes puros passam normalmente, o que torna a
    falha fácil de confundir com um problema do projeto — ela não é.

    Desligar o Smart App Control resolveria, mas é irreversível: o Windows não permite religá-lo sem
    reinstalar o sistema. Rodar os testes em Linux custa menos e não abre mão de nada.

    O código é COPIADO para uma pasta temporária antes de montar no container. Montar a pasta do
    repositório direto faria o build do Linux escrever `bin/` e `obj/` por cima dos do Windows, e o
    próximo build na sua máquina viria quebrado.

.EXAMPLE
    .\scripts\testar-api.ps1
    .\scripts\testar-api.ps1 -Filtro "FullyQualifiedName~Integration"
#>
[CmdletBinding()]
param(
    # Repassado ao `dotnet test --filter`. Sem isto, roda a suíte inteira.
    [string]$Filtro,

    # Imagem do SDK. Precisa acompanhar o TargetFramework dos projetos.
    [string]$Sdk = 'mcr.microsoft.com/dotnet/sdk:10.0'
)

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot
$temp = Join-Path ([System.IO.Path]::GetTempPath()) "reprise-testes"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker não encontrado." }
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "O Docker não está rodando — abra o Docker Desktop." }

Write-Host "Copiando o código para $temp" -ForegroundColor Cyan
if (Test-Path -LiteralPath $temp) { Remove-Item -Recurse -Force $temp }

# robocopy usa códigos de saída como bitmask: 0..7 é sucesso, 8+ é erro de verdade.
robocopy $raiz $temp /E /XD node_modules bin obj .git .expo /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Falha ao copiar o código (robocopy $LASTEXITCODE)." }
$global:LASTEXITCODE = 0

$argumentos = @('test', 'apps/api/Reprise.slnx', '--nologo')
if ($Filtro) { $argumentos += @('--filter', $Filtro) }

Write-Host "Rodando os testes no container ($Sdk)" -ForegroundColor Cyan
docker run --rm `
    -v /var/run/docker.sock:/var/run/docker.sock `
    -v "${temp}:/src" `
    -v reprise-nuget:/root/.nuget/packages `
    --add-host=host.docker.internal:host-gateway `
    -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal `
    -w /src $Sdk dotnet @argumentos

$codigo = $LASTEXITCODE

<#
    Por que as duas variáveis acima.

    O Testcontainers sobe o Postgres como container IRMÃO (o socket do Docker é o do host, não um
    Docker dentro do Docker), então a porta é publicada no HOST — não no container de teste. Sem o
    `TESTCONTAINERS_HOST_OVERRIDE` ele tenta falar com `localhost`, que aqui dentro é ele mesmo, e a
    inicialização do resource reaper morre por timeout.

    O cache do NuGet fica num volume nomeado porque o container é descartável: sem ele, cada
    execução rebaixa os pacotes de novo e o que leva 8 segundos passa a levar dois minutos.
#>

Write-Host ''
if ($codigo -eq 0) { Write-Host 'Testes passaram.' -ForegroundColor Green }
else { Write-Host "Testes falharam (código $codigo)." -ForegroundColor Red }

exit $codigo
