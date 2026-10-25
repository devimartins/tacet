# Kit de teste da captura (Claude, 25/10/2026)

Scripts **somente de teste**, usados na instância EC2 de teste para validar `capture-service/` sem mudar o código do serviço. Nada aqui é carregado pelo site nem pelo serviço.

| Arquivo | Para quê |
|---|---|
| `harness.mjs` | Chama `capture()` do `worker.mjs` direto (mesmo renderer, Xvfb, PulseAudio e FFmpeg), pulando a autenticação do Supabase. |
| `mkscene.py` | Gera uma cena válida para `validateScene`; cada legenda mostra o tempo de origem (`12s`) para conferir início e fim. |
| `gen.sh` | Gera `test.webm` sintético de 75 s: padrão `testsrc`, flash branco + bipe de 1 kHz por 0,1 s a cada segundo inteiro. |
| `mockyt.js` | Substituto **de teste** da API do YouTube (mesma interface usada por `render.js`), tocando o `test.webm` dentro de um `iframe`. |
| `harness-mock.mjs` | `harness.mjs` com o substituto injetado via Playwright (`addInitScript` e `route`). |
| `harness-fix.mjs` | Igual ao anterior, com a correção candidata de tela cheia (CDP `Browser.setWindowBounds` com `fullscreen`). |
| `verify.sh` | ffprobe, volume, bipes vs. flashes (sincronia A/V e início) e faixa com 3 quadros (`<id>-strip.png`). |
| `dbg2.mjs` | Mostra o texto que o embed do YouTube exibe no navegador do servidor. |

Uso (na instância, com o container `cap` rodando e `/opt/test` e `/opt/out` montados):

```sh
sudo docker exec cap sh /opt/test/gen.sh
python3 mkscene.py MOCKTEST001 5 10 classico 1 1 a
sudo docker exec cap node /opt/test/harness-mock.mjs /opt/test/a.json 00000000-0000-4000-8000-00000000000a
sudo docker exec cap sh /opt/test/verify.sh 00000000-0000-4000-8000-00000000000a
```
