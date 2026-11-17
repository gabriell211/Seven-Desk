# Seven Desk — VPS Docker self-host (PR #20)

## Objetivo e limites de segurança

A instalação pretendida é **100% própria**: website e API Node.js, Better Auth local,
PostgreSQL, SMTP Hostinger, InfinitePay, licenças, downloads e Seven ID/Relay. Nenhum
cliente real foi registrado, portanto **não importar** contas de testes do Neon.

O Docker Compose usa serviços privados com três perfis:
- Por padrão: banco e site, sem portas públicas, cadastros e pagamentos desativados
- setup: migração do Better Auth e criação transacional das tabelas comerciais
- signaling: os binários Seven ID/Relay em host network (NÃO ligar sem auditoria de portas)
- cutover: Caddy 80/443 para servir www e downloads após verificar o DNS e o TLS

**Ainda não houve deploy nem homologação real na VPS**. Um build CI aprovado não prova
que SMTP, pagamentos, P2P ou UAC funcionem. Não remover a origem antiga antes de
ser possível fazer rollback para ela.

## Arquivos privados e pré-requisitos

No servidor Linux, configurar usuário com SSH por chave, firewall e Docker Engine +
plugin Compose. Nunca expor 5432, API Docker, Postgres ou diretórios de segredos.

    cd deploy/vps
    cp .env.example .env
    chmod 600 .env
    sudo install -d -m 0700 /etc/sevendesk/secrets
    sudo sh -c 'umask 077; openssl rand -hex 32 > /etc/sevendesk/secrets/pg_password'
    sudo sh -c 'umask 077; openssl rand -hex 32 > /etc/sevendesk/secrets/app_db_password'
    sudo sh -c 'umask 077; openssl rand -hex 48 > /etc/sevendesk/secrets/auth_secret'

Inserir as credenciais reais **diretamente na VPS** (nunca aqui ou no Git):

    sudo install -m 600 -o root -g root /dev/null /etc/sevendesk/secrets/smtp_password
    sudo install -m 600 -o root -g root /dev/null /etc/sevendesk/secrets/infinitepay_api_key

Os arquivos acima devem ser preenchidos de forma segura no terminal da VPS; nunca
colocar senhas na linha de comando, em comentários, mensagens ou em logs. A senha SMTP
corresponde à conta Hostinger sevendesk@sevendesk.tech. A chave InfinitePay não será
utilizada até serem ativadas todas as flags após a homologação.

## Instalação isolada e migração de banco

    docker compose config -q
    docker compose build site
    docker compose up -d db
    docker compose --profile setup run --rm migrate
    docker compose up -d site
    docker compose ps
    docker compose exec site node -e "fetch('http://127.0.0.1:3100/api/account-availability').then(r=>r.json()).then(console.log)"

A migração programática do Better Auth cria tabelas de contas, sessões, OTP, JWKS e
limites de requisição. O migrador aplica 001_billing.sql, 002_app_tokens.sql e
003_technician_slots.sql uma única vez por transação e cria a role sevendesk_app
sem permissão para modificar DDL.

O site continua com as flags fechadas; nenhum usuário pode ser registrado até
verificar a infraestrutura e ativar a configuração de homologação.
Não usar docker compose down -v: apaga volumes.

## Testes obrigatórios para liberação

1. Acesso HTTPS sem vazamento de secrets, cookies seguros e renovação TLS
2. OTP recebido de Seven Desk <sevendesk@sevendesk.tech> por SMTP Hostinger
3. Cadastro, confirmação, login, logout, sessões, recuperação e mudança de senha
4. Emissão/revogação de códigos (até cinco slots) e sincronização do perfil
5. InfinitePay: pedido único, notificação válida, reenvio idempotente, falha, reembolso
   e atualização/expiração de assinatura; não criar pagamentos reais só para testar
6. Seven ID/Relay: conexão entre dois equipamentos, NAT/P2P, fallback relay e UAC
7. Distribuição dos arquivos verdadeiros e hashes do manifesto pelo domínio downloads
8. Backup externo cifrado, restauração isolada, falha de disco, rollback e reinício

## Servidores de conexão remota

O perfil signaling usa o upstream OSS fixado em signaling/build.sh e aplica a alteração
de licença do Seven Desk. O build inicial usa Rust, **não uma imagem :latest**.
Ele faz bind das portas 21115–21117 do host. Não iniciar até conferir:

    sudo ss -ltnup | grep -E ':2111[5-9]'
    docker compose --profile signaling config -q

Salvar e transferir as chaves ED25519 já existentes para o volume novo, verificando
permissões do UID 10001 antes do corte. Não substituir as chaves privadas do servidor.
O bloqueio de licença fica desativado até clientes e endpoint estarem homologados.
As licenças e atribuições legais dos componentes upstream permanecem válidas.

## Liberação / eliminação dos serviços anteriores

Só ativar o profile cutover após concluir todo o checklist e auditar portas/DNS.
Depois de HTTPS, banco, contas, pagamento, ID/relay e downloads funcionarem na VPS,
desligar as integrações externas e excluir os recursos antigos, mantendo backups
por tempo compatível com a política de segurança. Não excluir repositórios nem
credenciais de suporte até a continuidade ter sido comprovada.

## Backup criptografado

Guardar a chave privada age de recuperação **fora da VPS** e o destino de backup em
armazenamento remoto:

    BACKUP_DIR=/mnt/backup-offsite AGE_RECIPIENT='age1...' bash backup-encrypted.sh

O script atual cobre o banco. Certificados TLS, arquivos de download, avatares e
chaves privadas de ID exigem rotina cifrada adicional e testes de restauração.
