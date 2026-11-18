# Downloads do Seven Desk com Traefik (VPS existente)

Este modo publica `downloads.sevendesk.tech` sem substituir o portal, o banco, as chaves de sinalização ou os contêineres `hbbs`/`hbbr`. É específico para hosts cujo Traefik existente já atende 80/443 com Docker provider e resolver ACME chamado `letsencrypt`.

## Arquivos versionados

- `traefik-downloads.compose.yml`: serviço `downloads`, somente na rede Docker `frontend`, sem publicar portas no host, com certificados terminados pelo Traefik.
- `Caddyfile.downloads`: servidor HTTP interno em 8080, arquivos somente de `/srv/downloads`, nega caminhos ocultos e usa HTTP/1 para eliminar avisos de HTTP/2/3 sem TLS interno.
- `compose.yml`: banco/site permanecem independentes. O perfil `cutover` é **alternativo**, não execute em paralelo com Traefik.

## Aplicação incremental (não executar `down` ou `--remove-orphans` em produção)

Antes de qualquer alteração, faça backup da configuração Compose e confirme que o domínio aponta para a VPS e o Traefik atual tem o resolver `letsencrypt`. Para uma instalação cujo diretório Compose é `/docker/seven-desk-portal`, copie **somente** o arquivo de overlay e o Caddyfile versionados para esse diretório. Compare e concilie com as rotas existentes; não substitua o Compose de produção automaticamente.

```bash
cd /docker/seven-desk-portal
export SEVEN_DOCKER_FRONTEND_NETWORK=seven-desk-portal_frontend

docker compose -p seven-desk-portal \
  -f docker-compose.yml -f traefik-downloads.compose.yml config --quiet

docker compose -p seven-desk-portal \
  -f docker-compose.yml -f traefik-downloads.compose.yml \
  up -d --no-deps downloads
```

O site de produção já foi testado com esse padrão em 18/11/2026: certificado Let's Encrypt válido, HTTPS sem erro de confiança, HTTP redirecionado para HTTPS, arquivo público servido e arquivos iniciados por ponto bloqueados (404). Se o serviço `downloads` já existir no Compose operacional, concilie os labels em vez de criar serviços duplicados.

## Homologação e release

```bash
curl --fail --silent --show-error --head https://www.sevendesk.tech/
curl -sS -o /dev/null -w '%{ssl_verify_result}\n' https://downloads.sevendesk.tech/
curl --head http://downloads.sevendesk.tech/
```

A verificação de confiança TLS deve retornar `0` e o HTTP deve redirecionar para HTTPS. Use um arquivo temporário inofensivo para testar entrega e remova-o em seguida; teste também a negação de dotfiles, sem colocar segredos verdadeiros no diretório. O CI valida o servidor interno (sem simular um certificado público). Testes de NAT/P2P, consentimento, UAC, autenticação, licença e instaladores continuam necessários.

O diretório `/srv/sevendesk/downloads` permanece vazio até a publicação de uma release homologada via `scripts/publish_vps_release.py`; não anunciar downloads fictícios nem criar links para arquivos inexistentes. Preserve a atual sinalização e certificados no rollback.
