# Seven Desk — roteiro obrigatório de homologação (PR #23)

O objetivo é bloquear release e merge quando faltar teste real. Os resultados são associados ao commit SHA exato e não alteram a main, os serviços existentes nem os clientes.

## Infraestrutura e testes automatizados

Executar com Python 3.11+:

    python3 -m unittest discover -s scripts -p test_homologation_preflight.py -v
    python3 scripts/homologation_preflight.py --commit SHA_COMPLETO --output /tmp/sevendesk-homologacao.json

Este comando executa somente GET e HEAD: HTTPS validado, portal, flags de login, fontes privadas, perfil sem token, redirecionamento HTTP, manifesto, pacotes e tamanhos. Nenhum cadastro, pagamento, código ou sessão é criado. O relatório fica com permissão 0600.

A ausência de manifest.json é BLOCKED, nunca PASS. A presença do manifesto exige versão, commit, build_run_id, nomes seguros, SHA-256, versões portáteis Windows EXE (x64/ARM64), macOS DMG (x64/ARM64), Linux AppImage (x64/ARM64) e Android APK assinado. Cada pacote deve responder a HEAD com tamanho idêntico. O script não baixa os instaladores; a conferência integral dos hashes ainda é necessária antes de disponibilizá-los.

## Matriz de testes físicos e funcionais (todos obrigatórios)

| ID | Passo e critério esperado |
| --- | --- |
| WIN_PORTABLE | EXE Windows x64/ARM64 funciona com app aberto sem instalar e sem botão Iniciar sistema |
| WIN_ACCEPT | Balão no PC receptor exibe foto/nome/empresa e aceita apenas com consentimento |
| WIN_REJECT | Recusa encerra pedido sem conceder acesso |
| WIN_UAC_ALLOW | Elevação apenas com autorização UAC local e política compatível |
| WIN_UAC_DENY | Negar UAC não concede privilégios; nenhuma elevação automática |
| WIN_PANEL | Painel inferior direito, avatar, conectado, chat, arquivos, minimizar e desconectar |
| WIN_MONITOR | Troca de monitor afeta apenas a sessão remota autorizada |
| WIN_CHAT_TRANSFER | Chat e transferência permitidos funcionam, respeitando permissões |
| WIN_REVOKE | Código e ativação revogados não validam sessões ou perfis |
| WIN_ALIAS | Nome amigável do PC persiste sem alterar identificador remoto |
| WIN_OFFLINE | Queda de rede/VPS limpa sessões e recupera com segurança |
| WIN_UNATTENDED | Só há acesso não supervisionado após senha e política explícitas |
| LINUX_APPIMAGE | AppImage inicia sem instalação; suporte funciona sob permissões do SO |
| LINUX_CONSENT | Wayland/X11: consentimento; não burlar bloqueios do compositor |
| MAC_DMG | DMG abre app sem daemon obrigatório; identificação e conexão |
| MAC_CONSENT | Permissões de captura/acessibilidade negadas impedem ações dependentes |
| ANDROID_CONSENT | Balão recebe foto/nome/empresa e aceita/recusa; UAC indisponível |
| ACCOUNT_PF_PJ | Teste em staging: CPF/CNPJ válido, inválido e repetido; verificação e-mail |
| ACCOUNT_FIVE_SLOTS | Primeiro mês grátis, cinco dispositivos, sexto recusado pelo servidor |
| ACCOUNT_TECH_CLAIM | Tec_ e sd_ vinculados à mesma conta/slot; revogação efetiva |
| PAYMENT_SANDBOX | Pagamento de teste, webhook assinado, duplicação, reembolso/expiração |
| IDENTITY_AUTH | Identidade não pode ser falsificada via metadado remoto; sessão autenticada |

## Evidências e critério de liberação

Copiar docs/homologacao-evidencias.template.json para um local privado. Inserir o SHA completo da versão testada e, em cada caso, somente PASS, FAIL, BLOCKED ou PENDING; PASS exige tester e referência de evidência real. Não enviar senhas, tokens, documentos, fotos pessoais de clientes ou credenciais ao repositório. Ao finalizar executar:

    python3 scripts/homologation_preflight.py --commit SHA_COMPLETO --evidence /caminho/privado/evidencias.json --output /tmp/qa-release.json

Critérios para release: preflight_status PASS, manual PASS, release_gate PASS, GitHub CI verde no mesmo SHA, revisão sem bloqueios, teste físico Windows, Linux, macOS, Android e rollback pronto. Um teste unitário não substitui UAC, conexão real ou segurança de licença. Não publicar release, fazer merge nem ativar sinalização/licença no servidor até que tudo esteja comprovado. Corrigir problemas no PR #23; não abrir PR de reparo separado.

