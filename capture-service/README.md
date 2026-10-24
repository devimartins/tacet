# ForjaClip Capture — protótipo em desenvolvimento

Serviço separado de captura dos miniplayers da página `cortes-youtube.html`.
Não altera IA, pagamentos, login ou o Worker `tacet-ai`. NÃO está publicado.
A integração nas páginas existentes está proposta em `docs/integration-proposal.patch`, para o Claude revisar/aplicar. `CFG.CAPTURE_API` vazio mantém os botões desativados. Não mesclar na main antes da validação descrita abaixo. Branch de colaboração: `codex/captura-cortes`.

## Fluxo implementado

1. A página cria cards; somente nela o módulo `capture-client.js` é importado.
2. Se houver URL configurada, cada card ganha um rodapé próprio, sem sobreposição.
3. Ao clicar, um snapshot captura tempos, texto editado, estilo, visibilidade, posição/sincronia da legenda, nomes e posições dos falantes e modo de enquadramento.
4. API valida sessão via Supabase Auth, valida payload e enfileira um trabalho por usuário (até 120 s; limite diário configurável).
5. Worker sequencial abre navegador em tela virtual exclusiva do container. Grava a composição 720×1280 e áudio de um dispositivo virtual com FFmpeg.
6. Legendas usam o mesmo código da prévia. Tela dividida reproduz dois players, só um com áudio, e falha se perderem sincronia.
7. Progresso da gravação vem do tempo do player. Fila/preparo/finalização são indeterminados; somente arquivo validado fica pronto.
8. Arquivo fica acessível por link aleatório por uma hora. Cancelamento e expiração fazem parte do fluxo.

A gravação ocorre em tempo real. Vídeo de 60 s requer pelo menos essa duração, mais fila e processamento. O resultado é uma nova gravação da composição, não o arquivo original do YouTube.

## Executar em servidor Linux com Docker

Na raiz do repositório:

```sh
cp capture-service/.env.example capture-service/.env
# Preencher PUBLIC_BASE_URL e SUPABASE_ANON_KEY localmente. Não commitar .env.
docker build -f capture-service/Dockerfile -t forjaclip-capture .
docker run --rm --name forjaclip-capture --shm-size=1g --env-file capture-service/.env -p 127.0.0.1:8080:8080 forjaclip-capture
```

Disponibilizar o serviço por proxy HTTPS no domínio de PUBLIC_BASE_URL. Configurar limite de corpo (256 KB) e rate limit no proxy. Serviço exige processo persistente e binários de navegador/FFmpeg; não é um arquivo estático do GitHub Pages nem código para colar no Worker existente.

Só depois dos testes, definir `CAPTURE_API: "https://dominio-do-servico"` no config.js do site. Nenhuma chave secreta deve ser colocada no front-end. O serviço reutiliza o token de sessão do usuário e valida no Supabase; só necessita a chave anon pública no ambiente. Não precisa de service role.

## API

- `POST /jobs`: Authorization Bearer; snapshot; retorna id e estado.
- `GET /jobs/:id`: Authorization Bearer; somente o dono; progresso/erro/link.
- `DELETE /jobs/:id`: Authorization Bearer; somente o dono; cancela.
- `GET /downloads/:id?token=...`: link temporário, não contém token Supabase.
- `GET /health`: saúde do processo HTTP, NÃO confirma disponibilidade do YouTube/FFmpeg.

`npm test` dentro de capture-service usa node:test e FFmpeg/ffprobe. Não requer Playwright instalado para testes de validação/fila/mídia sintética.

## Limites e critérios antes de produção

- NÃO foi executado o fluxo real navegador → embed → áudio → FFmpeg neste ambiente. Docker/Xvfb/PulseAudio não estão disponíveis aqui. É obrigatório testar a imagem Docker.
- O início da gravação é alinhado por relógio do browser e progresso do FFmpeg. Essa aproximação precisa de calibração com claquete/contador e conferência A/V; não promete precisão de quadro.
- O embed pode exibir anúncios/logos/controles, falhar por região/rede ou negar reprodução. Os tempos e estados da API não garantem detecção de anúncios. Não existe detecção automática de anúncio implementada; manter piloto controlado até validação.
- Testar origem/referer do renderer local. Se YouTube retornar 153, servir a rota de render sob a origem HTTPS real, mantendo navegação restrita à rota do serviço. Não contornar restrições do provedor.
- Validar se `--kiosk` no Chromium ocupa exatamente o display 720×1280 sem chrome do navegador; gravação X11 captura pixels do display inteiro, que deve conter apenas a composição.
- Autenticação e limite existem; regras de planos/estilos Pro ainda precisam ser alinhadas antes de liberar. Não criar nova cobrança sem requisito.
- Uma instância, um worker, fila e cotas em memória. Reinício perde trabalhos e cotas; arquivos antigos são limpos. Evoluir para armazenamento/fila persistentes antes de escalar.
- Hospedagem e tráfego têm custos. Não foi contratado nem configurado servidor.
- Revisar políticas de uso e mensagens de privacidade para este processamento externo, com conteúdo autorizado para gravação.

## Teste de aceitação obrigatório

Vídeo próprio/autorizado com contador e áudio: corte de 10 s e de 60 s; conferir começo/fim e sincronia; testar legenda ligada/desligada, todos os estilos usados, edições, crop/contain, follow/split; confirmar MP4 720×1280 com áudio audível, sem cards/controles externos. Testar fila, cancelamento, falha de embed, expiração e isolamento entre usuários. O botão deve estar ausente em outras páginas e não criar trabalhos antes do clique.
