<#
.SYNOPSIS
    Abre o Reprise numa janela própria, com tudo em segundo plano. Fechar a janela encerra tudo.

.DESCRIPTION
    É o que o atalho do Desktop executa. Nenhuma janela de terminal aparece: o que aparece é um
    ícone na bandeja enquanto o Reprise está de pé, e a janela do próprio Reprise.

    Subida:
      1. carrega o `.env` para o ambiente (a API não lê o arquivo sozinha — ver JwtOptions);
      2. garante o Docker e o Postgres, esperando o healthcheck do compose;
      3. sobe API e web escondidos, cada um com a saída num log em %LOCALAPPDATA%\Reprise\logs;
      4. abre o Reprise numa janela do navegador e fica esperando por ela.

    Descida, quando a janela fecha (ou "Encerrar o Reprise" no ícone da bandeja): derruba API e
    web, para o Postgres e — só se foi este script que ligou o Docker Desktop — desliga o Docker.
    Se o Docker já estava ligado, ele fica: pode estar servindo outro projeto.

    Decisões que não são óbvias:

    * JANELA COM PERFIL PRÓPRIO. É o único jeito confiável de saber que "o site fechou". Uma aba no
      Chrome de sempre não tem processo próprio: o Chrome entrega o endereço à instância que já está
      aberta e devolve o controle na hora, sem nada para esperar. Com um diretório de perfil
      dedicado, a janela do Reprise é um navegador à parte, e fechá-la termina um processo que este
      script consegue observar. O custo é o login uma vez nessa janela, que não compartilha cookies
      nem localStorage com o Chrome de sempre.

    * VITE CHAMADO DIRETO, SEM PNPM. `pnpm dev` confere as dependências antes de rodar e, achando
      diferença, dispara um `install` — que num console de verdade PERGUNTA antes de mexer no
      node_modules. Na janela minimizada do launcher antigo ninguém via a pergunta: o install ficou
      uma hora parado esperando resposta e o Vite nunca subiu. Este script sobe servidores; não
      mexe em dependência. Se faltar pacote, o Vite falha, e o motivo aparece no log.

    * SEGUNDO PLANO DE VERDADE. O atalho chama `conhost.exe --headless`: com o Windows Terminal como
      terminal padrão (o caso deste Windows), `-WindowStyle Hidden` ainda abriria uma janela do
      Terminal. API e web sobem sem janela, com a saída redirecionada para arquivo — escondidos,
      mas nunca mudos.

    * PORTAS FIXAS. 5173 para o web e 5156 para a API, sem plano B (`strictPort` no Vite). Porta
      ocupada por processo deste projeto é reaproveitada; por processo alheio, vira erro com o nome
      de quem está ocupando.

    * SOCKETS DO DOCKER AFASTADOS ANTES DE LIGAR. Nesta máquina todo socket que o Docker Desktop
      cria fica inacessível ao sistema (erro 1920) — inclusive enquanto ele o usa. Na partida
      seguinte a um desligamento ele tenta apagar os da sessão anterior, não consegue, e o backend
      quebra numa caixa de erro: aconteceu em todas as partidas medidas depois de um
      desligamento. Mover a PASTA funciona onde apagar o arquivo não funciona, e o Docker recria a
      pasta vazia. Por isso, antes de ligar o Docker, o launcher move `Docker\run` e
      `docker-secrets-engine` para `*.antiga-*` — e tenta apagar as antigas a cada partida, o que
      o Windows só permite depois de reiniciar.

.EXAMPLE
    .\scripts\subir-reprise.ps1                  # o que o atalho faz
    .\scripts\subir-reprise.ps1 -SemNavegador    # sobe tudo e sai: sem janela e sem encerrar
    .\scripts\subir-reprise.ps1 -Parar           # derruba o que estiver de pé
#>
[CmdletBinding()]
param(
    # Sobe os serviços e sai, sem abrir janela e sem encerrar nada depois. Para desenvolvimento.
    [switch]$SemNavegador,

    # Derruba o que estiver de pé: janela, API, web e o container do Postgres.
    [switch]$Parar,

    # Com -Parar, desliga também o Docker Desktop. Sem isto o -Parar só para o container, porque
    # numa execução avulsa não há como saber se foi o Reprise quem ligou o Docker.
    [switch]$DesligarDocker,

    # Segundos de tolerância para o Docker e para cada serviço começar a atender.
    [int]$Timeout = 300
)

$ErrorActionPreference = 'Stop'

$raiz      = Split-Path -Parent $PSScriptRoot
$pastaApp  = Join-Path $env:LOCALAPPDATA 'Reprise'
$pastaLogs = Join-Path $pastaApp 'logs'
$perfil    = Join-Path $pastaApp 'navegador'
$arqIcone  = Join-Path $pastaApp 'reprise.ico'

$PORTA_API   = 5156
$PORTA_WEB   = 5173
$URL_WEB     = "http://localhost:$PORTA_WEB/"

# =============================================================================================
# Registro. Tudo o que o launcher faz vai para um arquivo, porque ele roda sem janela: quando o
# Reprise não abrir, o log é a única testemunha.
# =============================================================================================
class Registro {
    static [string]$Arquivo

    static [void] Escrever([string]$mensagem) {
        $linha = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $mensagem
        if ([Registro]::Arquivo) {
            Add-Content -LiteralPath ([Registro]::Arquivo) -Value $linha -Encoding UTF8
        }
        Write-Host $linha
    }

    # Guarda UMA execução anterior. Quando o Reprise não abre, a pergunta é "o que aconteceu da
    # última vez" — e sem isto o log da tentativa que falhou seria apagado pela seguinte.
    static [void] Rotacionar([string]$arquivo) {
        if (-not (Test-Path -LiteralPath $arquivo)) { return }
        $anterior = [System.IO.Path]::ChangeExtension($arquivo, '.anterior.log')
        try { Move-Item -LiteralPath $arquivo -Destination $anterior -Force } catch { }
    }
}

# =============================================================================================
# Chamada a executável nativo.
#
# O Windows PowerShell 5.1 transforma cada linha de stderr de um executável nativo em ErrorRecord
# quando há redirecionamento — e com ErrorActionPreference = 'Stop' isso vira exceção mesmo com
# código de saída 0. O `docker compose up` escreve o progresso no stderr, então subir o banco com
# sucesso derrubava o script. Quem decide é o código de saída.
#
# Os argumentos vão num array explícito: por parâmetro "restante", o PowerShell tentava casar o
# `-d` de `up -d` com um parâmetro da função, descartava-o, e o compose subia anexado — travando.
# =============================================================================================
class Nativo {
    static [int] Rodar([string]$exe, [string[]]$argumentos) {
        $ErrorActionPreference = 'Continue'
        & $exe @argumentos 2>&1 | Out-Null
        return $global:LASTEXITCODE
    }

    static [string] Saida([string]$exe, [string[]]$argumentos) {
        $ErrorActionPreference = 'Continue'
        $texto = (& $exe @argumentos 2>$null) -join "`n"
        return ([string]$texto).Trim()
    }

    # Com prazo PRÓPRIO, e não o `--timeout` do comando. Medido nesta máquina: um
    # `docker desktop start --timeout 240` ficou mais de 7 minutos pendurado, sem gastar CPU.
    # Num launcher sem janela, uma chamada pendurada é pior que uma falha: ele segura a trava de
    # instância única, e todo clique seguinte no atalho só ouve "o Reprise está encerrando".
    # Devolve -1 quando o prazo estoura (e o processo é encerrado).
    static [int] RodarComPrazo([string]$exe, [string[]]$argumentos, [int]$segundos) {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $exe
        $psi.Arguments = $argumentos -join ' '
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $processo = [System.Diagnostics.Process]::Start($psi)
        if (-not $processo.WaitForExit($segundos * 1000)) {
            try { $processo.Kill() } catch { }
            return -1
        }
        return $processo.ExitCode
    }
}

# =============================================================================================
# Processos e portas.
# =============================================================================================
class Processos {
    # "Deste projeto" é decidido pela linha de comando, e nada fora disto é tocado pela limpeza: a
    # 5173 pode estar com o Vite de OUTRO projeto, e matar isso seria um estrago que o launcher do
    # Reprise não tem direito de fazer.
    static [bool] DoReprise([object]$processo, [string]$raiz) {
        if (-not $processo) { return $false }
        $linha = [string]$processo.CommandLine
        if (-not $linha) { return $false }
        if ($linha.IndexOf($raiz, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { return $true }
        return $linha -match 'apps[\\/](api[\\/]Reprise\.Api|web|mobile)'
    }

    # Pela tabela de portas, e não por uma conexão de teste: o Vite escuta só em `::1`, e sondar
    # `127.0.0.1` dava o web como fora do ar com ele funcionando.
    static [int[]] DonosDaPorta([int]$porta) {
        return @(Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue |
            ForEach-Object { [int]$_.OwningProcess } | Select-Object -Unique)
    }

    static [bool] EmEscuta([int]$porta) {
        return @([Processos]::DonosDaPorta($porta)).Count -gt 0
    }

    static [object] Detalhe([int]$idDoProcesso) {
        return Get-CimInstance Win32_Process -Filter "ProcessId=$idDoProcesso" -ErrorAction SilentlyContinue
    }

    # A árvore inteira: `cmd` -> `dotnet run` -> `Reprise.Api.exe`. Matar só o topo deixaria o
    # servidor vivo segurando a porta.
    static [void] MatarArvore([int]$idDoProcesso) {
        $ErrorActionPreference = 'Continue'
        & taskkill.exe /T /F /PID $idDoProcesso 2>&1 | Out-Null
    }
}

# =============================================================================================
# Um servidor em segundo plano: sem janela, com a saída inteira num log.
# =============================================================================================
class ServicoOculto {
    [string]$Nome
    [int]$Porta
    [string]$Exe
    [string]$Argumentos
    [string]$Diretorio
    [string]$Log
    # Reconhece o processo deste serviço mesmo fora da porta — um Vite travado antes de escutar,
    # por exemplo, que seguraria o arquivo de log e impediria a subida seguinte.
    [string]$Assinatura
    [hashtable]$Ambiente = @{}
    [System.Diagnostics.Process]$Processo
    [bool]$Reaproveitado = $false

    ServicoOculto([string]$nome, [int]$porta, [string]$exe, [string]$argumentos,
                  [string]$diretorio, [string]$log, [string]$assinatura) {
        $this.Nome = $nome
        $this.Porta = $porta
        $this.Exe = $exe
        $this.Argumentos = $argumentos
        $this.Diretorio = $diretorio
        $this.Log = $log
        $this.Assinatura = $assinatura
    }

    [bool] NoAr() { return [Processos]::EmEscuta($this.Porta) }

    [void] LimparSobras([string]$raiz) {
        $eu = [System.Diagnostics.Process]::GetCurrentProcess().Id
        foreach ($p in @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)) {
            if ($p.ProcessId -eq $eu) { continue }
            $linha = [string]$p.CommandLine
            if ($linha -and $linha -match $this.Assinatura -and [Processos]::DoReprise($p, $raiz)) {
                [Registro]::Escrever("  $($this.Nome): encerrando processo remanescente (pid $($p.ProcessId))")
                [Processos]::MatarArvore([int]$p.ProcessId)
            }
        }
    }

    [void] Subir() {
        [Registro]::Rotacionar($this.Log)

        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $env:ComSpec
        # `cmd /s /c` tira as aspas externas e executa o resto literalmente. É o que dá o
        # redirecionamento para arquivo sem precisar de leitores assíncronos vivos neste script.
        $psi.Arguments = '/d /s /c ""{0}" {1} > "{2}" 2>&1"' -f $this.Exe, $this.Argumentos, $this.Log
        $psi.WorkingDirectory = $this.Diretorio
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        foreach ($chave in $this.Ambiente.Keys) {
            $psi.EnvironmentVariables[$chave] = [string]$this.Ambiente[$chave]
        }

        $this.Processo = [System.Diagnostics.Process]::Start($psi)
        [Registro]::Escrever("  $($this.Nome): subindo (pid $($this.Processo.Id)), log em $($this.Log)")
    }

    # Espera a porta atender, e volta cedo — com falso — se o processo MORRER antes. O launcher
    # antigo esperava cinco minutos por um serviço que tinha caído no primeiro segundo.
    [bool] Aguardar([int]$segundos, [scriptblock]$enquantoEspera) {
        $limite = (Get-Date).AddSeconds($segundos)
        while ((Get-Date) -lt $limite) {
            if ($this.NoAr()) { return $true }
            if ($this.Processo -and $this.Processo.HasExited) { return $false }
            if ($enquantoEspera) { & $enquantoEspera }
            Start-Sleep -Milliseconds 400
        }
        return $false
    }

    [string] FimDoLog([int]$linhas) {
        if (-not (Test-Path -LiteralPath $this.Log)) { return '(o log não chegou a ser criado)' }
        return ((Get-Content -LiteralPath $this.Log -Tail $linhas -ErrorAction SilentlyContinue) -join "`n")
    }

    [void] Derrubar([string]$raiz) {
        if ($this.Processo -and -not $this.Processo.HasExited) {
            [Processos]::MatarArvore($this.Processo.Id)
        }
        # Quem estiver na porta também sai: cobre o serviço reaproveitado de uma execução anterior,
        # que não tem Processo aqui, e qualquer neto que tenha sobrevivido à árvore.
        foreach ($dono in [Processos]::DonosDaPorta($this.Porta)) {
            if ([Processos]::DoReprise([Processos]::Detalhe($dono), $raiz)) {
                [Processos]::MatarArvore($dono)
            }
        }
    }
}

# =============================================================================================
# Docker: liga se precisar, e lembra se foi ele quem ligou — é isso que decide se desliga depois.
# =============================================================================================
class DockerLocal {
    [string]$Compose
    [bool]$LigadoPorNos = $false
    static [string]$Executavel = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'

    [string]$Cli

    DockerLocal([string]$compose) {
        $this.Compose = $compose
        # Caminho completo: com UseShellExecute desligado, o nome solto depende de como o Windows
        # resolve o PATH para aquele processo, e isto roda sem terminal para mostrar o erro.
        $this.Cli = (Get-Command docker -ErrorAction Stop).Source
    }

    # Com prazo: com o Docker Desktop preso no meio da partida, até o `docker info` pode esperar
    # indefinidamente pelo pipe do motor.
    [bool] Respondendo() { return [Nativo]::RodarComPrazo($this.Cli, @('info'), 20) -eq 0 }

    [void] Garantir([int]$segundos, [scriptblock]$enquantoEspera) {
        $partida = Get-Date
        if ($this.Respondendo()) {
            [Registro]::Escrever('Docker: já estava de pé — continua ligado quando o Reprise fechar.')
            return
        }

        # Docker Desktop aberto com o motor ainda subindo: não fomos nós que ligamos, então não
        # somos nós que desligamos.
        $jaAberto = @(Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue).Count -gt 0
        if (-not $jaAberto) {
            $this.AfastarSocketsVelhos()
            [Registro]::Escrever('Docker: ligando o Docker Desktop.')
            if ([Nativo]::RodarComPrazo($this.Cli, @('desktop', 'start', '--detach'), 60) -ne 0) {
                if (-not (Test-Path -LiteralPath ([DockerLocal]::Executavel))) {
                    throw 'O Docker não está rodando e o Docker Desktop não foi encontrado.'
                }
                Start-Process -FilePath ([DockerLocal]::Executavel) | Out-Null
            }
            $this.LigadoPorNos = $true
        }

        $limite = (Get-Date).AddSeconds($segundos)
        while (-not $this.Respondendo()) {
            # Quando quebra na partida, o backend do Docker não sai: fica numa caixa de erro
            # esperando clique. Sem olhar o log, este laço passaria o prazo inteiro vigiando um
            # Docker que morreu no primeiro segundo.
            $erro = $this.UltimoErroDoBackend($partida)
            if ($erro) { throw "O Docker Desktop quebrou ao ligar.`n`nO Docker registrou: $erro" }
            if ((Get-Date) -gt $limite) { throw "O Docker não respondeu em $segundos segundos." }
            if ($enquantoEspera) { & $enquantoEspera }
            Start-Sleep -Seconds 2
        }
        [Registro]::Escrever('Docker: de pé.')
    }

    static [string[]] PastasDeSocket() {
        return @(
            (Join-Path $env:LOCALAPPDATA 'Docker\run'),
            (Join-Path $env:LOCALAPPDATA 'docker-secrets-engine')
        )
    }

    # Ver "SOCKETS DO DOCKER" no cabeçalho. Só é chamado com o Docker Desktop parado.
    [void] AfastarSocketsVelhos() {
        $carimbo = Get-Date -Format 'yyyyMMdd-HHmmss'
        foreach ($pasta in [DockerLocal]::PastasDeSocket()) {
            if (-not (Test-Path -LiteralPath $pasta)) { continue }
            $sockets = @(Get-ChildItem -LiteralPath $pasta -Force -ErrorAction SilentlyContinue |
                Where-Object { $_.Attributes -band [System.IO.FileAttributes]::ReparsePoint })
            if ($sockets.Count -eq 0) { continue }
            try {
                Move-Item -LiteralPath $pasta -Destination "$pasta.antiga-$carimbo" -ErrorAction Stop
                [Registro]::Escrever("Docker: $($sockets.Count) socket(s) da sessão anterior afastado(s) de $(Split-Path $pasta -Leaf).")
            } catch {
                [Registro]::Escrever("Docker: não consegui afastar $(Split-Path $pasta -Leaf) — $($_.Exception.Message)")
            }
        }

        # As afastadas antes. Apagar o socket de dentro só funciona depois de reiniciar o Windows,
        # então tentar a cada partida faz a limpeza acontecer sozinha quando puder — e falhar aqui é
        # o caso normal, por isso em silêncio.
        foreach ($pasta in [DockerLocal]::PastasDeSocket()) {
            $nome = Split-Path $pasta -Leaf
            Get-ChildItem -LiteralPath (Split-Path $pasta -Parent) -Directory -Force -Filter "$nome.antiga-*" -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -notlike "*$carimbo" } |
                ForEach-Object { try { [System.IO.Directory]::Delete($_.FullName, $true) } catch { } }
        }
    }

    # A última falha fatal do backend desde a partida, ou vazio. O log do Docker é em UTC, e a
    # comparação por texto funciona porque o carimbo é ISO — foi o fuso que escondeu este erro na
    # primeira vez que ele foi procurado.
    #
    # `cancelling with error: <nil>` NÃO é falha: é a linha que o backend escreve num desligamento
    # normal (medido). Casá-la faria o launcher abortar uma subida saudável sempre que o Docker
    # estivesse desligando enquanto ele espera — por isso o `(?!<nil>)`.
    [string] UltimoErroDoBackend([datetime]$desde) {
        $log = Join-Path $env:LOCALAPPDATA 'Docker\log\host\com.docker.backend.exe.log'
        if (-not (Test-Path -LiteralPath $log)) { return '' }
        $marco = $desde.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss')
        $linha = Get-Content -LiteralPath $log -Tail 600 -ErrorAction SilentlyContinue |
            Where-Object { $_ -match 'cancelling with error: (?!<nil>)' -and ($_ -replace '^\[([^\]]+)\].*', '$1') -ge $marco } |
            Select-Object -Last 1
        if (-not $linha) { return '' }
        return ($linha -replace '^\[[^\]]+\]\[[^\]]+\]\s*', '')
    }

    [void] SubirBanco([int]$segundos, [scriptblock]$enquantoEspera) {
        if ([Nativo]::Rodar('docker', @('compose', '-f', $this.Compose, 'up', '-d', 'db')) -ne 0) {
            throw 'O docker compose não conseguiu subir o Postgres.'
        }

        # O healthcheck é a fonte da verdade: container "Up" não é Postgres aceitando conexão, e a
        # API morre se tentar conectar antes disso.
        $saude = ''
        $limite = (Get-Date).AddSeconds($segundos)
        while ((Get-Date) -lt $limite) {
            $saude = [Nativo]::Saida('docker', @('inspect', '--format', '{{.State.Health.Status}}', 'reprise-db'))
            if ($saude -eq 'healthy') {
                [Registro]::Escrever('Postgres: saudável.')
                return
            }
            if ($enquantoEspera) { & $enquantoEspera }
            Start-Sleep -Milliseconds 800
        }
        throw "O Postgres não ficou saudável (estado: $saude)."
    }

    [void] PararBanco() {
        if (-not $this.Respondendo()) { return }
        [void][Nativo]::Rodar('docker', @('compose', '-f', $this.Compose, 'stop', 'db'))
        [Registro]::Escrever('Postgres: parado.')
    }

    [void] Desligar() {
        [Registro]::Escrever('Docker: desligando o Docker Desktop.')
        $codigo = [Nativo]::RodarComPrazo($this.Cli, @('desktop', 'stop'), 150)
        if ($codigo -eq -1) {
            # Com o backend quebrado, `docker desktop stop` é o primeiro a pendurar — e aí não
            # sobra nada que valha preservar num desligamento gracioso.
            Get-Process 'Docker Desktop', 'com.docker.backend' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
            [Registro]::Escrever('Docker: o desligamento passou de 150 s; processos do Docker encerrados à força.')
        } else {
            [Registro]::Escrever("Docker: desligado (código $codigo).")
        }
    }
}

# =============================================================================================
# A janela do Reprise: um navegador com perfil próprio, cujo fim este script consegue observar.
# =============================================================================================
class JanelaDoApp {
    [string]$Navegador
    [string]$Perfil
    [string]$Url
    [System.Diagnostics.Process]$Processo
    [datetime]$UltimaConferencia = [datetime]::MinValue
    [bool]$UltimoResultado = $true

    JanelaDoApp([string]$perfil, [string]$url) {
        $this.Perfil = $perfil
        $this.Url = $url
        $this.Navegador = [JanelaDoApp]::AcharNavegador()
    }

    # Chrome primeiro, por ser o navegador de uso; Edge porque todo Windows 11 tem.
    static [string] AcharNavegador() {
        $candidatos = @(
            (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
            (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
            (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'),
            (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
            (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
        )
        foreach ($c in $candidatos) {
            if (Test-Path -LiteralPath $c) { return $c }
        }
        throw 'Nenhum navegador compatível (Chrome ou Edge) foi encontrado.'
    }

    [object[]] ProcessosDoPerfil() {
        $marca = $this.Perfil
        return @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($marca, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 })
    }

    # Janela de uma execução que caiu sem encerrar. Viva, ela receberia o endereço no lugar da
    # janela nova, o processo lançado aqui terminaria na hora — e este script entenderia que a
    # janela fechou antes mesmo de abrir.
    [void] EncerrarOrfas() {
        foreach ($p in $this.ProcessosDoPerfil()) { [Processos]::MatarArvore([int]$p.ProcessId) }
    }

    [string[]] Argumentos() {
        return @(
            "--user-data-dir=`"$($this.Perfil)`"",
            "--app=$($this.Url)",
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-background-mode',
            '--hide-crash-restore-bubble',
            '--window-size=1280,860'
        )
    }

    [void] Abrir() {
        $this.Processo = Start-Process -FilePath $this.Navegador -ArgumentList $this.Argumentos() -PassThru
        [Registro]::Escrever("Janela: aberta no $([System.IO.Path]::GetFileNameWithoutExtension($this.Navegador)) (pid $($this.Processo.Id)).")
    }

    # Outra janela no mesmo perfil. O navegador entrega ao processo que já está aberto — e é por
    # isso que o processo acompanhado continua sendo o primeiro.
    [void] AbrirOutra() {
        Start-Process -FilePath $this.Navegador -ArgumentList $this.Argumentos() | Out-Null
    }

    [bool] Aberta() {
        if ($this.Processo -and -not $this.Processo.HasExited) { return $true }

        # O processo lançado terminou. Pode ter sido fechamento de verdade, ou o navegador se
        # reiniciando para uma atualização — então confere pelo perfil. No máximo a cada 2 s,
        # porque consultar o WMI a cada volta do laço custaria à toa.
        if (((Get-Date) - $this.UltimaConferencia).TotalSeconds -ge 2) {
            $this.UltimoResultado = @($this.ProcessosDoPerfil()).Count -gt 0
            $this.UltimaConferencia = Get-Date
        }
        return $this.UltimoResultado
    }

    [void] Fechar() {
        $processos = $this.ProcessosDoPerfil()
        if ($processos.Count -eq 0) { return }

        # Pedindo para fechar, e não matando: fechado à força, o navegador abre a próxima vez
        # oferecendo "restaurar páginas".
        foreach ($p in $processos) {
            $proc = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue
            if ($proc -and $proc.MainWindowHandle -ne 0) { [void]$proc.CloseMainWindow() }
        }
        $limite = (Get-Date).AddSeconds(6)
        while (@($this.ProcessosDoPerfil()).Count -gt 0 -and (Get-Date) -lt $limite) {
            Start-Sleep -Milliseconds 300
        }
        $this.EncerrarOrfas()
    }
}

# =============================================================================================
# Funções do fluxo principal.
# =============================================================================================
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

function Show-Aviso([string]$texto, [string]$tipo = 'Error') {
    # Dono invisível e sempre no topo: sem ele, a caixa de um processo sem janela abre ATRÁS das
    # outras, e o erro existe sem que ninguém o veja.
    $dono = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false }
    try { [void][System.Windows.Forms.MessageBox]::Show($dono, $texto, 'Reprise', 'OK', $tipo) }
    finally { $dono.Dispose() }
}

function Get-CausaRaiz([System.Exception]$erro) {
    # Exceção lançada dentro de método de classe chega embrulhada ("Exception calling 'Aguardar'
    # with '2' argument(s)"). O que interessa mostrar é a mensagem de dentro.
    while ($erro.InnerException) { $erro = $erro.InnerException }
    return $erro
}

function Import-DotEnv([string]$caminho) {
    if (-not (Test-Path -LiteralPath $caminho)) {
        throw "Não achei o .env em $caminho. Copie o .env.example e preencha."
    }
    foreach ($linha in Get-Content -LiteralPath $caminho -Encoding UTF8) {
        $t = $linha.Trim()
        if (-not $t -or $t.StartsWith('#')) { continue }
        $i = $t.IndexOf('=')
        if ($i -lt 1) { continue }
        [Environment]::SetEnvironmentVariable($t.Substring(0, $i).Trim(), $t.Substring($i + 1).Trim().Trim('"'), 'Process')
    }
    if (-not $env:Jwt__Secret -or $env:Jwt__Secret.Length -lt 32) {
        throw 'Jwt__Secret ausente ou curto no .env — a API se recusa a subir sem ele.'
    }
}

function New-Servicos {
    $node   = (Get-Command node -ErrorAction Stop).Source
    $dotnet = (Get-Command dotnet -ErrorAction Stop).Source

    $api = [ServicoOculto]::new('API', $PORTA_API, $dotnet,
        "run --project `"apps\api\Reprise.Api`" --urls http://0.0.0.0:$PORTA_API",
        $raiz, (Join-Path $pastaLogs 'api.log'),
        'run\s+--project\s+"?apps[\\/]api[\\/]Reprise\.Api|Reprise\.Api\.exe')
    # A API escuta em 0.0.0.0 porque o celular precisa alcançá-la pela rede. E sem servidores de
    # build que sobrevivem ao `dotnet run`: eram ~250 MB que ficavam na memória depois de fechar o
    # Reprise, medidos. Variável de ambiente vira propriedade do MSBuild — daí o UseSharedCompilation.
    $api.Ambiente['MSBUILDDISABLENODEREUSE'] = '1'
    $api.Ambiente['DOTNET_CLI_USE_MSBUILD_SERVER'] = '0'
    $api.Ambiente['UseSharedCompilation'] = 'false'

    # O web fica em localhost: é aberto nesta máquina, e o Vite em 0.0.0.0 publicaria o servidor
    # de desenvolvimento para a rede inteira sem necessidade.
    $web = [ServicoOculto]::new('web', $PORTA_WEB, $node,
        "`"$(Join-Path $raiz 'apps\web\node_modules\vite\bin\vite.js')`"",
        (Join-Path $raiz 'apps\web'), (Join-Path $pastaLogs 'web.log'),
        'vite[\\/]bin[\\/]vite\.js')

    return @($api, $web)
}

function Remove-JanelasLegadas {
    # As janelas minimizadas do launcher antigo (`-NoExit`, com pnpm ou dotnet run dentro). O
    # launcher novo não as cria, mas uma que tenha sobrado seguraria porta e log.
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object {
        $_.ProcessId -ne $PID -and $_.CommandLine -match '-NoExit' -and
        $_.CommandLine -match '-Command\s+(pnpm -C apps|dotnet run --project apps)'
    } | ForEach-Object {
        [Registro]::Escrever("Encerrando janela do launcher antigo (pid $($_.ProcessId)).")
        [Processos]::MatarArvore([int]$_.ProcessId)
    }
}

function Start-OuReaproveitar([ServicoOculto]$servico) {
    if ($servico.NoAr()) {
        foreach ($dono in [Processos]::DonosDaPorta($servico.Porta)) {
            $p = [Processos]::Detalhe($dono)
            if (-not [Processos]::DoReprise($p, $raiz)) {
                $nome = if ($p) { $p.Name } else { 'desconhecido' }
                throw "A porta $($servico.Porta) ($($servico.Nome)) está ocupada por outro programa: $nome (pid $dono). Feche-o e abra o Reprise de novo."
            }
        }
        # Deste projeto e atendendo: sobra de uma execução que não encerrou. Reaproveitar é mais
        # rápido que reiniciar, e o encerramento derruba pela porta do mesmo jeito.
        $servico.Reaproveitado = $true
        [Registro]::Escrever("  $($servico.Nome): já estava de pé na porta $($servico.Porta) — reaproveitando.")
        return
    }
    $servico.LimparSobras($raiz)
    $servico.Subir()
}

function Stop-Tudo {
    if ($bandeja) {
        $bandeja.Text = 'Reprise — encerrando…'
        [System.Windows.Forms.Application]::DoEvents()
    }
    if ($script:janela) { $script:janela.Fechar() }
    foreach ($s in $servicos) { $s.Derrubar($raiz) }
    $docker.PararBanco()
    if ($docker.LigadoPorNos) { $docker.Desligar() }
    [Registro]::Escrever('Reprise encerrado.')
}

# =============================================================================================
# Execução.
# =============================================================================================
New-Item -ItemType Directory -Force -Path $pastaLogs | Out-Null
$docker = [DockerLocal]::new((Join-Path $raiz 'docker-compose.yml'))

if ($Parar) {
    [Registro]::Arquivo = Join-Path $pastaLogs 'launcher.log'
    [Registro]::Escrever('Parando o Reprise (-Parar).')
    try { [JanelaDoApp]::new($perfil, $URL_WEB).Fechar() } catch { }
    Remove-JanelasLegadas
    foreach ($s in @(New-Servicos)) { $s.Derrubar($raiz); $s.LimparSobras($raiz) }
    $docker.PararBanco()
    if ($DesligarDocker) { $docker.Desligar() }
    [Registro]::Escrever('Reprise parado.')
    exit 0
}

# Um launcher por vez. Um segundo clique no atalho com o Reprise aberto só abre outra janela: sem
# esta trava, ele subiria uma segunda pilha disputando as mesmas portas.
$mutex = New-Object System.Threading.Mutex($false, 'Local\Reprise.Launcher')
$temOTurno = $false
try { $temOTurno = $mutex.WaitOne(0) }
catch [System.Threading.AbandonedMutexException] { $temOTurno = $true }   # launcher anterior morto

if (-not $temOTurno) {
    $mutex.Dispose()
    if ($SemNavegador) { Write-Host 'Outro launcher já está cuidando do Reprise.'; exit 0 }
    if ([Processos]::EmEscuta($PORTA_WEB)) {
        [JanelaDoApp]::new($perfil, $URL_WEB).AbrirOutra()
    } else {
        Show-Aviso 'O Reprise está iniciando ou encerrando. Tente de novo em alguns segundos.' 'Information'
    }
    exit 0
}

[Registro]::Rotacionar((Join-Path $pastaLogs 'launcher.log'))
[Registro]::Arquivo = Join-Path $pastaLogs 'launcher.log'
[Registro]::Escrever("Launcher iniciado (pid $PID$(if ($SemNavegador) { ', sem navegador' })).")

$script:pedidoDeEncerrar = $false
$script:janela = $null
$bandeja = $null
$servicos = @()
$sucesso = $false

# Chamado a cada espera da subida. Mantém o ícone da bandeja respondendo — sem isto, o menu não
# abriria durante o minuto em que o Docker liga — e é por onde "Encerrar" interrompe uma subida.
$enquantoEspera = {
    [System.Windows.Forms.Application]::DoEvents()
    if ($script:pedidoDeEncerrar) { throw [System.OperationCanceledException]::new('Encerrado pela bandeja durante a subida.') }
}

try {
    Import-DotEnv (Join-Path $raiz '.env')

    if (-not $SemNavegador) {
        $bandeja = New-Object System.Windows.Forms.NotifyIcon
        $bandeja.Icon = if (Test-Path -LiteralPath $arqIcone) { New-Object System.Drawing.Icon($arqIcone) } else { [System.Drawing.SystemIcons]::Application }
        $bandeja.Text = 'Reprise — iniciando…'

        $menu = New-Object System.Windows.Forms.ContextMenuStrip
        [void]$menu.Items.Add('Abrir outra janela', $null, { if ($script:janela) { $script:janela.AbrirOutra() } })
        [void]$menu.Items.Add('Encerrar o Reprise', $null, { $script:pedidoDeEncerrar = $true })
        $bandeja.ContextMenuStrip = $menu
        $bandeja.Visible = $true
        $bandeja.ShowBalloonTip(5000, 'Reprise', 'Iniciando… Com o Docker desligado, a primeira subida leva um pouco mais.', [System.Windows.Forms.ToolTipIcon]::Info)
    }

    $docker.Garantir($Timeout, $enquantoEspera)
    $docker.SubirBanco(90, $enquantoEspera)

    Remove-JanelasLegadas
    $servicos = @(New-Servicos)
    foreach ($s in $servicos) { Start-OuReaproveitar $s }

    foreach ($s in $servicos) {
        if ($s.Reaproveitado) { continue }
        if (-not $s.Aguardar($Timeout, $enquantoEspera)) {
            $motivo = if ($s.Processo.HasExited) { 'parou logo depois de subir' } else { "não atendeu em $Timeout segundos" }
            throw "$($s.Nome) $motivo.`n`nFinal do log ($($s.Log)):`n$($s.FimDoLog(12))"
        }
        [Registro]::Escrever("  $($s.Nome): atendendo na porta $($s.Porta).")
    }

    if ($SemNavegador) {
        $sucesso = $true
        [Registro]::Escrever("Serviços de pé: web $URL_WEB · API http://localhost:$PORTA_API — encerre com -Parar.")
        return
    }

    $script:janela = [JanelaDoApp]::new($perfil, $URL_WEB)
    $script:janela.EncerrarOrfas()
    $script:janela.Abrir()
    $sucesso = $true
    $bandeja.Text = 'Reprise — feche a janela para encerrar'

    while (-not $script:pedidoDeEncerrar -and $script:janela.Aberta()) {
        [System.Windows.Forms.Application]::DoEvents()
        Start-Sleep -Milliseconds 300
    }
    [Registro]::Escrever($(if ($script:pedidoDeEncerrar) { 'Encerrar pedido pela bandeja.' } else { 'Janela fechada.' }))
}
catch {
    $causa = Get-CausaRaiz $_.Exception
    if ($causa -is [System.OperationCanceledException]) {
        [Registro]::Escrever($causa.Message)
    } else {
        [Registro]::Escrever("ERRO: $($causa.Message)")
        if ($SemNavegador) {
            Write-Host "ERRO: $($causa.Message)" -ForegroundColor Red
        } else {
            Show-Aviso "O Reprise não conseguiu abrir.`n`n$($causa.Message)`n`nLogs em: $pastaLogs"
        }
    }
}
finally {
    # Com -SemNavegador e tudo de pé, os serviços ficam — é o propósito do modo. Em qualquer
    # outro caso, inclusive falha no meio da subida, desce o que tiver subido.
    if (-not ($SemNavegador -and $sucesso)) { Stop-Tudo }

    if ($bandeja) { $bandeja.Visible = $false; $bandeja.Dispose() }
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
