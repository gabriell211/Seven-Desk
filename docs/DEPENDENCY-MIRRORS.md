# Espelhos das dependências Git do Seven Desk

A integração de Rust usa cópias **read-only** de hwcodec e externals hospedadas na VPS do Seven Desk. A cópia não muda autoria, licenças ou os commits das dependências originais.

| Dependência de terceiros | Commit fixado | Espelho próprio |
| --- | --- | --- |
| rustdesk-org/hwcodec | ec38ebaf2454269d4c5668a57e3813c6e5541be7 | https://downloads.sevendesk.tech/deps/hwcodec.git |
| rustdesk-org/externals | 8903740a1f47884906a6e347ad3d8d56304d9771 | https://downloads.sevendesk.tech/deps/externals.git |

As fontes de origem foram copiadas via Git, mantendo o histórico e as referências exatas. O submódulo externals está vinculado ao commit acima. As variáveis GIT_CONFIG_* dos workflows redirecionam somente estas duas URLs de origem. As quatro invocações Docker do run-on-arch-action recebem o mesmo redirecionamento.

**Não são componentes originais do Seven Desk.** O pacote externals contém SDKs e headers de fabricantes e pode estar sujeito a termos adicionais de redistribuição. Preservar avisos, origem e histórico; realizar revisão de licenciamento antes da distribuição comercial definitiva. Não remover atribuições nem modificar permissões de terceiros.

## Operação

- Verificar origem e SHAs com: bash .github/scripts/verify-dependency-mirrors.sh
- A VPS possui os repositórios bare na pasta /srv/sevendesk/downloads/deps. Caddy os entrega via HTTP estático, sem push e sem índice de diretórios.
- O servidor usa protocolo Git HTTP estático, que não suporta clone shallow. Fazer clone completo quando necessário.
- Atualizações dos espelhos precisam ser explícitas e revisadas, com um commit novo aprovado, alteração de testes e confirmação do submódulo correspondente.
- GitHub continua hospedando outros componentes e dependências do build, portanto este espelho não equivale a uma cópia integral de todos os projetos de terceiros.
- O caminho /deps não é um instalador para clientes e não é exibido na página de download. A distribuição dos instaladores Seven Desk permanece independente.

## Diagnóstico da falha original

O cargo build --locked do macOS falhou ao buscar a revisão de hwcodec e depois o commit do submódulo externals via GitHub. Os espelhos removem a dependência direta desses dois endpoints, mantendo Cargo.lock e o conteúdo original. Os checks do PR #29 devem confirmar a mudança. Não confundir aprovação de CI com homologação real de conexão ou UAC em duas máquinas.
