# Seven Desk signaling server

`rustdesk-server-license.patch` contains the Seven Desk source changes for the open-source RustDesk ID server. `build.sh` fetches the pinned upstream revision, applies this patch, tests it, and produces `seven-id` and `seven-relay` binaries. The upstream source is AGPL-3.0, as is this derived patch.

The new ID server checks `GET /api/license` before forwarding a connection request. It sends the existing `PunchHoleRequest.token` or `RequestRelay.token` as a Bearer token and permits only an HTTP 200 response with `allowed: true`. Empty, malformed, expired, or unavailable credentials fail closed. The receiving computer still registers and receives support without account login.

The Seven Desk build fails closed when `SEVEN_LICENSE_URL` is missing, invalid, or unavailable. Configure `SEVEN_LICENSE_URL=https://www.sevendesk.tech/api/license` in the dedicated ID server before attempting outgoing connections. Never place activation tokens in server logs or command-line arguments. The receiver still explicitly approves incoming support and does not need an account.

**Rollout safety:** the current VPS still runs legacy upstream signaling without this check. Build and run the modified binaries in isolation on non-production ports, verify both direct and relay sessions between two devices using a signed-in account, and check unsigned/revoked/expired/offline cases before cutover. Preserve the production server keys/data and provide rollback. Do not enable enforcement on the active ports before distributing updated installers, or existing clients may lose remote access.

The production VPS currently runs the upstream `rustdesk/rustdesk-server` containers as `seven-desk-hbbs-1` and `seven-desk-hbbr-1`. The Seven Desk signaling build is a candidate and must be tested on separate ports before replacing these services. Keep the existing public/private server identity and data directory during migration so installed clients can still authenticate.

## Corte obrigatório de versões antigas (geração 2)

Não publicar novas releases como "versões antigas bloqueadas" apenas removendo ZIPs do site. O backend do PR #23 contém o gate `SEVEN_ACTIVATION_GENERATION` (1 por padrão; 2 **somente no corte homologado**) para negar códigos `sd_` e emitir exclusivamente `sd2_`. A validação de licença deve acontecer no servidor de sinalização; controles de interface no aplicativo não são proteção suficiente.

A aplicação do gate **não impede** que um receptor antigo se registre enquanto `hbbs/hbbr` legados continuarem ativos. Para interromper ambos os sentidos das conexões com binários antigos, é preciso testar e implantar uma nova identidade de chave pública do servidor nos executáveis novos e trocar a chave do servidor coordenadamente. A nova chave pública é material de build; a **chave privada** deve permanecer no servidor em armazenamento seguro, nunca no repositório nem em comentários de PR. Confirmar o comportamento da versão de hbbs usada antes de fazer essa rotação.

Verificar recusa de versões antigas tanto como solicitantes quanto como receptores e em conexões direta/relay; se o software antigo ainda conseguir conectar, o lançamento fica bloqueado. Documentar rollback, que pode restaurar a identidade anterior e reabilitar conexões antigas. Esta mudança jamais deve ocorrer no serviço em produção antes de se confirmar que os novos instaladores e o portal/autenticação estão prontos.
