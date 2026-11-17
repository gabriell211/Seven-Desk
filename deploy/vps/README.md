# Seven Desk — Docker na VPS (preparação isolada)

## Importante: esta é a etapa de infraestrutura, não a migração completa

O usuário confirmou que não existem clientes nem usuários reais. Não há motivo para importar contas fictícias, pedidos simulados ou tokens de homologação.

Este compose prepara PostgreSQL local, site Node.js e Caddy opcional. Conta, cobrança, webhooks e licenciamento continuam fechados. As APIs atuais ainda usam Neon Auth e não podem ser ativadas até concluir a migração para autenticação própria. Não exclua ainda os recursos antigos nem altere o DNS.

## Proteções

- PostgreSQL 17 em rede interna, senha via Docker Secret em /etc/sevendesk/secrets/pg_password e sem expor 5432.
- Site não publica portas, root filesystem de somente leitura, processo não-root, limites de PIDs e volume para avatar.
- Caddy HTTPS somente no profile cutover, desativado na preparação. Antes de iniciá-lo, verifique Caddy/Nginx e portas 80/443 ocupadas.
- Volumes persistentes para PostgreSQL, TLS, uploads e downloads. Não versionar segredos ou chaves do servidor remoto.
- Servidores ID e relay remotos não são substituídos neste compose inicial. Testar P2P, relay e UAC antes da troca.

## Preparação na VPS

Instale Docker Engine e Compose plugin atualizados, configure firewall, SSH por chave e mantenha o daemon Docker inacessível pela internet. Prepare o arquivo de configuracao (somente valores publicos; as flags do Compose permanecem desligadas):

    cd deploy/vps
    cp .env.example .env
    chmod 600 .env

Os dominios do arquivo .env sao consumidos pelo Caddy apenas no futuro profile cutover. Alterar .env NAO libera cadastro, cobranca ou licenciamento. As senhas permanecem exclusivamente em arquivos de segredos no host.

Crie o segredo localmente:

    sudo install -d -m 0700 /etc/sevendesk/secrets
    sudo sh -c 'umask 077; openssl rand -hex 32 > /etc/sevendesk/secrets/pg_password'

Prepare o clone do repositório e valide sem publicar portas:

    cd deploy/vps
    docker compose config -q
    docker compose up -d --build db site
    docker compose ps
    docker compose exec site node -e "fetch('http://127.0.0.1:3100/api/account-availability').then(r=>r.json()).then(console.log)"
    docker compose exec db pg_isready -U sevendesk -d sevendesk

É intencional que cadastro e cobrança estejam desativados. O serviço edge exige profile cutover e não é iniciado por padrão. Para interromper sem perder dados use docker compose stop. Nunca use docker compose down -v em produção, pois apaga volumes.

## Próximas etapas para retirar Neon e Vercel

1. Migrar frontend de @neon/auth para Better Auth auto-hospedado, com PostgreSQL local, JWT, OTP, recuperação e SMTP Hostinger sevendesk@sevendesk.tech.
2. Migrar SQL de usuários, assinaturas, pedidos e códigos de ativação de neon_auth para esquema próprio; gerar migrações e validar integridade e privilégio mínimo.
3. Concluir a integração do aplicativo com autenticação e licenças antes de abrir cadastro e cobrança.
4. Validar InfinitePay, webhook, estornos e idempotência sem cobrar usuários reais.
5. Migrar seven-id e seven-relay para imagens construídas de fontes fixadas; testar em duas máquinas e portas alternativas antes de substituir serviços.
6. Hospedar downloads e manifesto na VPS, com instaladores verdadeiros.
7. Testar rollback, backup/restauração e HTTPS; só então ativar cutover e mudar DNS.
8. Depois de tudo aprovado, desativar e remover recursos de Neon e Vercel, em operação explícita e revisada, nunca antes do novo sistema funcionar.

## Backups

Instale age e mantenha chave privada de restauração fora da VPS. Grave dumps cifrados em destino remoto montado:

    BACKUP_DIR=/mnt/backup-offsite AGE_RECIPIENT='age1...' bash backup-encrypted.sh

Faça também backups cifrados de downloads, avatares, certificados e chave privada do servidor ID. Teste a recuperação em outra máquina. Backup no mesmo disco não é offsite.

## Corte final

    docker compose --profile cutover config -q

A ativação do edge publica 80/443 e pode conflitar com o Caddy ou Nginx em execução. Nunca inicie o profile cutover sem auditoria das portas, validação TLS e plano de rollback. Sem acesso SSH à VPS, o corte não é executável daqui.
