# Windows

Dois scripts em `scripts/` resolvem particularidades do Windows: um sobe o Reprise com um clique,
o outro roda os testes da API quando o Smart App Control impede o `dotnet test`.

Na primeira vez, o PowerShell pode recusar scripts (a política padrão é `Restricted`). Rode-os com
`powershell -ExecutionPolicy Bypass -File <script>`, que vale só para aquela execução e não muda
nada na máquina; se preferir liberar de vez, `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
resolve — mas é uma decisão de segurança, e por isso não vai feita por padrão.

## Abrindo com um clique

`scripts/subir-reprise.ps1` sobe banco, API e web **em segundo plano** e abre o Reprise numa
**janela própria** do navegador. Fechar essa janela encerra tudo: API, web, o container do
Postgres e — se foi o launcher que ligou — o Docker Desktop.

```powershell
.\scripts\subir-reprise.ps1                  # o que o atalho faz
.\scripts\subir-reprise.ps1 -SemNavegador    # sobe tudo e sai, sem janela e sem encerrar
.\scripts\subir-reprise.ps1 -Parar           # derruba o que estiver de pé
```

Para o clique único, crie um atalho (botão direito na área de trabalho → Novo → Atalho) com este
destino, trocando o caminho pelo da sua cópia do repositório:

```text
C:\Windows\System32\conhost.exe --headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\caminho\do\reprise\scripts\subir-reprise.ps1"
```

O launcher carrega o `.env` para o ambiente antes de subir a API — ao contrário do `dotnet run`
direto, aqui o `.env` vale.

- **Nenhum terminal aparece.** O atalho chama `conhost.exe --headless`; API e web sobem sem
  janela. Enquanto o Reprise está aberto há um ícone na bandeja, com "Abrir outra janela" e
  "Encerrar o Reprise". A saída de cada serviço vai para `%LOCALAPPDATA%\Reprise\logs`, e a
  execução anterior fica guardada como `*.anterior.log`.
- **A janela tem perfil próprio** (`%LOCALAPPDATA%\Reprise\navegador`). É o que permite saber que
  ela fechou — uma aba no navegador de sempre não tem processo próprio para observar. Por isso o
  login é feito uma vez nessa janela, que não compartilha sessão com o navegador de uso.
- **O Docker só é desligado se o launcher o ligou.** Se ele já estava de pé por causa de outro
  projeto, só o container do Reprise para.
- **Os sockets do Docker são afastados antes de ligá-lo.** Em algumas máquinas o Docker Desktop
  deixa para trás sockets que o Windows não deixa apagar (erro 1920), e toda partida depois de um
  desligamento quebra tentando removê-los. O launcher move `Docker\run` e `docker-secrets-engine`
  para `*.antiga-*` antes de ligar o Docker; essas pastas só podem ser apagadas depois de
  reiniciar o Windows, e o launcher tenta a cada partida. Se o Docker quebrar mesmo assim, a
  mensagem de erro traz o que ele registrou.
- **Portas fixas:** web na 5173 e API na 5156, sem plano B. Porta ocupada por outro programa
  vira erro com o nome dele, em vez de o Vite subir calado em outra porta.
- **O Vite é chamado direto, sem `pnpm dev`.** O `pnpm` confere as dependências antes de rodar e
  pode disparar um `install` que *pergunta* antes de mexer no `node_modules` — sem terminal
  visível, ninguém responde e o web nunca sobe. Depois de mudar dependências, rode `pnpm install`.

## Testes da API com Smart App Control

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\testar-api.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\testar-api.ps1 -Filtro "FullyQualifiedName~Integration"
```

Com o Smart App Control ligado, o Windows recusa carregar DLLs sem assinatura digital e sem
reputação no `testhost.exe` — evento 3077 do Code Integrity, erro `0x800711C7`. Isso inclui a
`Docker.DotNet.Handler.Abstractions.dll` do Testcontainers e, numa pasta recém-clonada, até as
DLLs do próprio projeto. A falha parece do projeto e é da máquina.

O script copia o código para uma pasta temporária e roda a suíte num container Linux, onde a
política não alcança; o cache do NuGet fica num volume (`reprise-nuget`) para as próximas vezes.
Desligar o Smart App Control também resolveria, mas é irreversível: o Windows não deixa religá-lo
sem reinstalar o sistema.
