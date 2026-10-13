<#
.SYNOPSIS
    Abre o Reprise numa janela própria, com tudo em segundo plano. Fechar a janela encerra tudo.

.DESCRIPTION
    É o que o atalho do Desktop executa. Nenhuma janela de terminal aparece: o que aparece é um
    ícone na bandeja enquanto o Reprise está de pé, e a janela do próprio Reprise.

    Subida:
      1. confere o `.env` (quem o lê é o compose; sem `Jwt__Secret` a API nem sobe);
      2. garante o Docker Desktop;
      3. sobe a pilha do `docker-compose.yml` — banco, migrações, API e web —, reconstruindo as
         imagens se o código mudou, com a saída em %LOCALAPPDATA%\Reprise\logs\compose.log;
      4. espera o `/api/health` responder pelo web e abre o Reprise numa janela do navegador.

    Descida, quando a janela fecha (ou "Encerrar o Reprise" no ícone da bandeja): para os
    containers e — só se foi este script que ligou o Docker Desktop — desliga o Docker. Se o
    Docker já estava ligado, ele fica: pode estar servindo outro projeto.

    Decisões que não são óbvias:

    * TUDO NO DOCKER, NADA COMPILADO NO WINDOWS. Com o Smart App Control ligado, o Windows recusa
      carregar DLL sem assinatura e sem reputação (erro 0x800711C7) — e toda DLL da API recém-
      compilada é assim. O launcher anterior subia a API com `dotnet run` e passou a morrer no
      primeiro build depois de uma mudança de código. Num container Linux a política não alcança,
      e de quebra o atalho deixa de depender do SDK do .NET e do Node.

    * `--build` A CADA ABERTURA. É o que faz um `git pull` valer no clique seguinte, sem ninguém
      lembrar de reconstruir nada. Com o cache do BuildKit e sem código novo, custa uns 5 s
      (medido); com código novo, refaz só as camadas afetadas. Os atestados de proveniência ficam
      desligados porque mudam o digest da imagem a cada build — e aí o compose recriaria os
      containers em toda abertura, mesmo sem nada novo (medido também).

    * JANELA COM PERFIL PRÓPRIO. É o único jeito confiável de saber que "o site fechou". Uma aba no
      Chrome de sempre não tem processo próprio: o Chrome entrega o endereço à instância que já está
      aberta e devolve o controle na hora, sem nada para esperar. Com um diretório de perfil
      dedicado, a janela do Reprise é um navegador à parte, e fechá-la termina um processo que este
      script consegue observar. O custo é o login uma vez nessa janela, que não compartilha cookies
      nem localStorage com o Chrome de sempre.

    * SEGUNDO PLANO DE VERDADE. O atalho chama `conhost.exe --headless`: com o Windows Terminal como
      terminal padrão (o caso deste Windows), `-WindowStyle Hidden` ainda abriria uma janela do
      Terminal. O compose roda sem janela, com a saída redirecionada para arquivo — escondido, mas
      nunca mudo.

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
    # Sobe os containers e sai, sem abrir janela e sem encerrar nada depois.
    [switch]$SemNavegador,

    # Derruba o que estiver de pé: a janela e os containers do Reprise.
    [switch]$Parar,

    # Com -Parar, desliga também o Docker Desktop. Sem isto o -Parar só para os containers, porque
    # numa execução avulsa não há como saber se foi o Reprise quem ligou o Docker.
    [switch]$DesligarDocker,

    # Segundos de tolerância para o Docker ligar e para a API começar a responder.
    [int]$Timeout = 300,

    # Segundos para o `docker compose up --build`. Sem cache nenhum, construir as três imagens
    # levou uns 4 minutos nesta máquina; com cache, segundos.
    [int]$TimeoutBuild = 1200
)

$ErrorActionPreference = 'Stop'
# A barra de progresso do Invoke-WebRequest no Windows PowerShell deixa cada sondagem lenta, e
# aqui não há ninguém para vê-la.
$ProgressPreference = 'SilentlyContinue'
# O docker escreve em UTF-8, mas sob o `conhost --headless` do atalho o console fica na página 850
# (medido): os acentos de um log da API chegavam trocados na caixa de erro.
try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch { }

$raiz      = Split-Path -Parent $PSScriptRoot
$pastaApp  = Join-Path $env:LOCALAPPDATA 'Reprise'
$pastaLogs = Join-Path $pastaApp 'logs'
$perfil    = Join-Path $pastaApp 'navegador'
$arqIcone  = Join-Path $pastaApp 'reprise.ico'

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

    static [string] FimDe([string]$arquivo, [int]$linhas) {
        if (-not (Test-Path -LiteralPath $arquivo)) { return '(o log não chegou a ser criado)' }
        return ((Get-Content -LiteralPath $arquivo -Tail $linhas -Encoding UTF8 -ErrorAction SilentlyContinue) -join "`n")
    }
}

# =============================================================================================
# Chamada a executável nativo.
#
# O Windows PowerShell 5.1 transforma cada linha de stderr de um executável nativo em ErrorRecord
# quando há redirecionamento — e com ErrorActionPreference = 'Stop' isso vira exceção mesmo com
# código de saída 0. O `docker compose` escreve o progresso no stderr, então um comando com
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
    # Pela tabela de portas, e não por uma conexão de teste: o que interessa no segundo clique é se
    # o web já está publicado, e não se a API já responde.
    static [int[]] DonosDaPorta([int]$porta) {
        return @(Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue |
            ForEach-Object { [int]$_.OwningProcess } | Select-Object -Unique)
    }

    static [bool] EmEscuta([int]$porta) {
        return @([Processos]::DonosDaPorta($porta)).Count -gt 0
    }

    # Quem publica porta de container nesta máquina (medido): o backend do Docker Desktop e, no
    # loopback IPv6, o wslrelay do WSL. Só serve para a mensagem: o wslrelay repassa porta de
    # qualquer distro, então o nome do dono não prova que a porta é do Reprise.
    static [string[]]$DoDocker = @('com.docker.backend', 'wslrelay', 'vpnkit', 'com.docker.proxy')

    # Porta ocupada por outro programa vira erro com o nome dele. O compose não recusa sozinho:
    # medido, com outro processo escutando a 8080 em IPv4, o Docker publicou a porta só em IPv6, a
    # subida deu "saudável" — e a janela podia cair no programa errado. A porta só é "nossa" quando
    # o próprio compose diz que é o web do Reprise que a publica.
    static [void] ExigirLivre([int]$porta, [bool]$doReprise) {
        if ($doReprise) { return }
        foreach ($dono in [Processos]::DonosDaPorta($porta)) {
            $nome = (Get-Process -Id $dono -ErrorAction SilentlyContinue).ProcessName
            if ($nome -and [Processos]::DoDocker -contains $nome) {
                throw "A porta $porta já está publicada por outro container ou distro do WSL ($nome). Pare-o, ou escolha outra porta em REPRISE_PORT no .env."
            }
            throw "A porta $porta está ocupada por outro programa: $nome (pid $dono). Feche-o, ou escolha outra porta em REPRISE_PORT no .env."
        }
    }

    # A árvore inteira: `cmd` -> `docker compose` -> o que ele tiver aberto. Matar só o topo
    # deixaria o resto rodando.
    static [void] MatarArvore([int]$idDoProcesso) {
        $ErrorActionPreference = 'Continue'
        & taskkill.exe /T /F /PID $idDoProcesso 2>&1 | Out-Null
    }
}

# =============================================================================================
# O `.env`. Quem o lê de verdade é o compose; aqui ele só é conferido — sem `Jwt__Secret`, as
# imagens seriam construídas e a pilha subiria só para a API cair na partida — e consultado para
# saber em que porta o web atende e qual token de acesso a sonda de saúde precisa mandar.
# =============================================================================================
class ConfiguracaoLocal {
    [string]$Arquivo
    [hashtable]$Valores = @{}
    [int]$Porta = 8080

    ConfiguracaoLocal([string]$arquivo) {
        $this.Arquivo = $arquivo
        if (Test-Path -LiteralPath $arquivo) {
            foreach ($linha in Get-Content -LiteralPath $arquivo -Encoding UTF8) {
                $t = $linha.Trim()
                if (-not $t -or $t.StartsWith('#')) { continue }
                if ($t.StartsWith('export ')) { $t = $t.Substring(7).TrimStart() }
                $i = $t.IndexOf('=')
                if ($i -lt 1) { continue }
                $this.Valores[$t.Substring(0, $i).Trim()] = [ConfiguracaoLocal]::Valor($t.Substring($i + 1).Trim())
            }
        }
        # `REPRISE_PORT` aceita `ip:porta` no compose ("127.0.0.1:9000"); a porta é o último trecho.
        $numero = 0
        $texto = ($this.Ler('REPRISE_PORT') -split ':')[-1]
        if ([int]::TryParse($texto, [ref]$numero) -and $numero -gt 0) { $this.Porta = $numero }
    }

    # As regras do compose para o lado direito do `=`, para os dois enxergarem o mesmo valor: entre
    # aspas (simples ou duplas) vale o que está dentro delas; sem aspas, ` #` começa um comentário.
    static [string] Valor([string]$bruto) {
        if ($bruto.Length -ge 2 -and ($bruto[0] -eq '"' -or $bruto[0] -eq "'")) {
            $fim = $bruto.IndexOf($bruto[0], 1)
            if ($fim -gt 0) { return $bruto.Substring(1, $fim - 1) }
        }
        $comentario = $bruto.IndexOf(' #')
        if ($comentario -ge 0) { return $bruto.Substring(0, $comentario).TrimEnd() }
        return $bruto
    }

    # A precedência do compose: variável de ambiente vence o `.env`.
    [string] Ler([string]$chave) {
        $doAmbiente = [Environment]::GetEnvironmentVariable($chave)
        if ($doAmbiente) { return $doAmbiente }
        return [string]$this.Valores[$chave]
    }

    [string] Url() { return "http://localhost:$($this.Porta)/" }

    [void] Validar() {
        if (-not (Test-Path -LiteralPath $this.Arquivo)) {
            throw "Não achei o .env em $($this.Arquivo). Copie o .env.example e preencha."
        }
        # O mesmo critério da API (AuthSetup.AddRepriseAuth), para não recusar o que ela aceita.
        $segredo = $this.Ler('Jwt__Secret')
        if ([string]::IsNullOrWhiteSpace($segredo) -or $segredo.Length -lt 32) {
            throw 'Jwt__Secret ausente ou curto no .env — a API se recusa a subir sem ele.'
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

    [string[]] ArgumentosCompose([string[]]$resto) {
        return @('compose', '-f', $this.Compose) + $resto
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

    # A porta em que o web do Reprise está publicado agora, ou 0 se ele não está de pé.
    [int] PortaDoWeb() {
        $saida = [Nativo]::Saida($this.Cli, $this.ArgumentosCompose(@('port', 'web', '8080')))
        $numero = 0
        if ($saida -and [int]::TryParse(($saida -split "`n")[0].Split(':')[-1], [ref]$numero)) { return $numero }
        return 0
    }

    # Sem prender o laço da bandeja: o `up --build` pode levar minutos, e nesse tempo o ícone tem
    # de continuar respondendo — é por ele que "Encerrar" interrompe uma subida.
    [void] SubirPilha([string]$log, [int]$segundos, [scriptblock]$enquantoEspera) {
        [Registro]::Rotacionar($log)

        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $env:ComSpec
        # `cmd /s /c` tira as aspas externas e executa o resto literalmente. É o que dá o
        # redirecionamento para arquivo sem precisar de leitores assíncronos vivos neste script.
        $psi.Arguments = '/d /s /c ""{0}" compose -f "{1}" up -d --build > "{2}" 2>&1"' -f $this.Cli, $this.Compose, $log
        $psi.WorkingDirectory = Split-Path -Parent $this.Compose
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        # Ver "--build A CADA ABERTURA" no cabeçalho.
        $psi.EnvironmentVariables['BUILDX_NO_DEFAULT_ATTESTATIONS'] = '1'

        $processo = [System.Diagnostics.Process]::Start($psi)
        [Registro]::Escrever("Containers: subindo (docker compose up --build, pid $($processo.Id)), log em $log")

        $limite = (Get-Date).AddSeconds($segundos)
        try {
            while (-not $processo.HasExited) {
                if ((Get-Date) -gt $limite) { throw "O docker compose não terminou em $segundos segundos." }
                if ($enquantoEspera) { & $enquantoEspera }
                Start-Sleep -Milliseconds 400
            }
        } catch {
            # Interrompido (prazo ou "Encerrar" na bandeja): o compose não pode seguir construindo
            # sozinho depois que o launcher desistiu.
            if (-not $processo.HasExited) { [Processos]::MatarArvore($processo.Id) }
            throw
        }

        if ($processo.ExitCode -ne 0) {
            throw "O docker compose falhou (código $($processo.ExitCode)).`n`nFinal do log ($log):`n$([Registro]::FimDe($log, 12))"
        }
        [Registro]::Escrever('Containers: de pé.')
    }

    # Pelo web, e não direto na API: `/api/health` passando pelo nginx prova a corrente inteira — o
    # web atendendo, o proxy chegando na API e a API falando com o banco. Container "Up" não prova
    # nada disso.
    #
    # Com `Api__AccessToken` no `.env`, a API recusa tudo sem o token — o /health inclusive — e a
    # sonda precisa mandá-lo, ou esperaria o prazo inteiro por um 401.
    [void] AguardarSaude([string]$url, [string]$token, [int]$segundos, [scriptblock]$enquantoEspera) {
        $sonda = $url.TrimEnd('/') + '/api/health'
        $cabecalhos = @{}
        if ($token) { $cabecalhos['X-Reprise-Token'] = $token }
        $limite = (Get-Date).AddSeconds($segundos)
        while ((Get-Date) -lt $limite) {
            try {
                $resposta = Invoke-WebRequest -Uri $sonda -Headers $cabecalhos -UseBasicParsing -TimeoutSec 3
                if ($resposta.StatusCode -eq 200) {
                    [Registro]::Escrever("API: saudável ($sonda).")
                    return
                }
            } catch { }

            # Uma API que cai na partida fica reiniciando pela política do compose. Sem olhar o
            # estado, este laço esperaria o prazo inteiro por ela.
            $estado = [Nativo]::Saida($this.Cli, $this.ArgumentosCompose(@('ps', '-a', '--format', '{{.State}}', 'api')))
            if ($estado -match 'restarting|exited|dead') {
                $log = [Nativo]::Saida($this.Cli, $this.ArgumentosCompose(@('logs', '--tail', '40', '--no-log-prefix', 'api')))
                throw "A API não ficou de pé (estado: $estado).`n`nFinal do log da API:`n$([DockerLocal]::SemRepeticao($log, 8))"
            }
            if ($enquantoEspera) { & $enquantoEspera }
            Start-Sleep -Seconds 1
        }
        throw "A API não respondeu em $segundos segundos ($sonda)."
    }

    # Cada reinício da API repete a mesma exceção no log: na caixa de erro, o que importa são as
    # linhas distintas, na ordem em que apareceram.
    static [string] SemRepeticao([string]$texto, [int]$maximo) {
        $vistas = New-Object 'System.Collections.Generic.HashSet[string]'
        $linhas = @($texto -split "`n" | Where-Object { $_.Trim() -and $vistas.Add($_.TrimEnd()) })
        return (($linhas | Select-Object -Last $maximo) -join "`n")
    }

    [void] PararPilha() {
        if (-not $this.Respondendo()) { return }
        [void][Nativo]::Rodar($this.Cli, $this.ArgumentosCompose(@('stop')))
        [Registro]::Escrever('Containers: parados.')
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
    # Exceção lançada dentro de método de classe chega embrulhada ("Exception calling 'SubirPilha'
    # with '3' argument(s)"). O que interessa mostrar é a mensagem de dentro.
    while ($erro.InnerException) { $erro = $erro.InnerException }
    return $erro
}

function Stop-Tudo {
    if ($bandeja) {
        $bandeja.Text = 'Reprise — encerrando…'
        [System.Windows.Forms.Application]::DoEvents()
    }
    if ($script:janela) { $script:janela.Fechar() }
    $docker.PararPilha()
    if ($docker.LigadoPorNos) { $docker.Desligar() }
    [Registro]::Escrever('Reprise encerrado.')
}

# =============================================================================================
# Execução.
# =============================================================================================
New-Item -ItemType Directory -Force -Path $pastaLogs | Out-Null
$config = [ConfiguracaoLocal]::new((Join-Path $raiz '.env'))
$URL_WEB = $config.Url()
$docker = [DockerLocal]::new((Join-Path $raiz 'docker-compose.yml'))

if ($Parar) {
    [Registro]::Arquivo = Join-Path $pastaLogs 'launcher.log'
    [Registro]::Escrever('Parando o Reprise (-Parar).')
    try { [JanelaDoApp]::new($perfil, $URL_WEB).Fechar() } catch { }
    $docker.PararPilha()
    if ($DesligarDocker) { $docker.Desligar() }
    [Registro]::Escrever('Reprise parado.')
    exit 0
}

# Um launcher por vez. Um segundo clique no atalho com o Reprise aberto só abre outra janela: sem
# esta trava, ele subiria uma segunda vez a mesma pilha.
$mutex = New-Object System.Threading.Mutex($false, 'Local\Reprise.Launcher')
$temOTurno = $false
try { $temOTurno = $mutex.WaitOne(0) }
catch [System.Threading.AbandonedMutexException] { $temOTurno = $true }   # launcher anterior morto

if (-not $temOTurno) {
    $mutex.Dispose()
    if ($SemNavegador) { Write-Host 'Outro launcher já está cuidando do Reprise.'; exit 0 }
    # Só com a janela do primeiro já aberta. Antes disso — a porta publicada não basta, o compose a
    # publica antes de a API responder —, a janela aberta aqui seria fechada logo em seguida pelo
    # primeiro launcher, que encerra janelas órfãs do perfil antes de abrir a dele.
    $janelaExistente = [JanelaDoApp]::new($perfil, $URL_WEB)
    if (@($janelaExistente.ProcessosDoPerfil()).Count -gt 0) {
        $janelaExistente.AbrirOutra()
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
$sucesso = $false

# Chamado a cada espera da subida. Mantém o ícone da bandeja respondendo — sem isto, o menu não
# abriria durante o minuto em que o Docker liga — e é por onde "Encerrar" interrompe uma subida.
$enquantoEspera = {
    [System.Windows.Forms.Application]::DoEvents()
    if ($script:pedidoDeEncerrar) { throw [System.OperationCanceledException]::new('Encerrado pela bandeja durante a subida.') }
}

try {
    $config.Validar()
    # Não impede de abrir, mas some calado: sem a chave, buscar série nova e completar o catálogo
    # falham lá dentro. E quem guardava a chave no user-secrets do `dotnet run` não a tem mais aqui.
    if (-not $config.Ler('Tmdb__ApiKey')) {
        [Registro]::Escrever('Aviso: Tmdb__ApiKey vazio no .env — buscar séries novas e completar o catálogo pelo TMDB não vão funcionar.')
    }

    if (-not $SemNavegador) {
        $bandeja = New-Object System.Windows.Forms.NotifyIcon
        $bandeja.Icon = if (Test-Path -LiteralPath $arqIcone) { New-Object System.Drawing.Icon($arqIcone) } else { [System.Drawing.SystemIcons]::Application }
        $bandeja.Text = 'Reprise — iniciando…'

        $menu = New-Object System.Windows.Forms.ContextMenuStrip
        [void]$menu.Items.Add('Abrir outra janela', $null, { if ($script:janela) { $script:janela.AbrirOutra() } })
        [void]$menu.Items.Add('Encerrar o Reprise', $null, { $script:pedidoDeEncerrar = $true })
        $bandeja.ContextMenuStrip = $menu
        $bandeja.Visible = $true
        $bandeja.ShowBalloonTip(5000, 'Reprise', 'Iniciando… Com o Docker desligado ou código novo para construir, leva um pouco mais.', [System.Windows.Forms.ToolTipIcon]::Info)
    }

    $docker.Garantir($Timeout, $enquantoEspera)
    [Processos]::ExigirLivre($config.Porta, $docker.PortaDoWeb() -eq $config.Porta)
    $docker.SubirPilha((Join-Path $pastaLogs 'compose.log'), $TimeoutBuild, $enquantoEspera)
    $docker.AguardarSaude($URL_WEB, $config.Ler('Api__AccessToken'), $Timeout, $enquantoEspera)

    if ($SemNavegador) {
        $sucesso = $true
        [Registro]::Escrever("Reprise de pé em $URL_WEB — encerre com -Parar.")
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
    # Com -SemNavegador e tudo de pé, os containers ficam — é o propósito do modo. Em qualquer
    # outro caso, inclusive falha no meio da subida, desce o que tiver subido.
    if (-not ($SemNavegador -and $sucesso)) { Stop-Tudo }

    if ($bandeja) { $bandeja.Visible = $false; $bandeja.Dispose() }
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
