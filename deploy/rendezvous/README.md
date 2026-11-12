# Servidor privado de ID e relay do Seven Desk

O Seven Desk utiliza o protocolo RustDesk Server OSS para sinalizacao (hbbs) e relay (hbbr). Esta configuracao **nao necessita de login de conta**. O computador de destino **continua exigindo senha ou autorizacao** para cada sessao conforme sua politica. A chave publica do servidor autentica o transporte; nao e uma senha de acesso remoto.

## Servidor

Requisitos: VPS **Linux** com IP publico acessivel, Docker Engine e Compose, DNS apontando para a VPS e capacidade de receber TCP e UDP. Vercel/Neon nao executam hbbs/hbbr nas portas necessarias; Cloudflare STUN/TURN nao substitui o servidor de ID.

1. Copie `.env.example` para `.env` neste diretorio e troque `desk.example.com` pelo seu dominio publico. **Nao** coloque `.env`, chaves privadas ou pasta `data/` no Git.
2. Execute `docker compose up -d` nesta pasta e confira `docker compose ps`.
3. Libere **TCP 21115, 21116 e 21117** e **UDP 21116** no firewall da VPS, nas regras do provedor e nos roteadores aplicaveis. Nunca aponte `21116` para a porta HTTPS do site.
4. Depois que hbbs inicializar, leia a **chave publica** com `cat data/id_ed25519.pub`. Guarde `data/id_ed25519` (privada) apenas na VPS com acesso restrito e backups protegidos.
5. Verifique os logs com `docker compose logs --tail=100 hbbs hbbr`. Os dois computadores precisam utilizar o mesmo servidor de ID e chave publica.

O caminho P2P e tentado primeiro. Se NAT/firewall impedir a conexao direta, hbbr fornece o relay. O relay requer TCP 21117. As portas WebSocket 21118 e 21119 so sao necessarias para clientes web e **nao estao habilitadas neste exemplo**. Se habilitadas, proteja-as por proxy confiavel devido aos cabecalhos de IP que podem ser falsificados.

## Aplicativo Seven Desk

Para instalar a configuracao manualmente, abra **Configuracoes > Rede > ID/Relay Server** nas duas pontas e informe:

- ID Server: `desk.example.com:21116`
- Relay Server: `desk.example.com:21117` (opcional quando o servidor o informa)
- Key: conteudo de `data/id_ed25519.pub`
- API Server: **vazio**, pois a API de login e especifica da edicao Pro

Para builds gerenciadas do cliente Flutter, passe estes parametros `--dart-define` ao comando de build do projeto (substituindo os exemplos pelos dados reais):

```text
--dart-define=SEVEN_DESK_ID_SERVER=desk.example.com:21116
--dart-define=SEVEN_DESK_RELAY_SERVER=desk.example.com:21117
--dart-define=SEVEN_DESK_SERVER_KEY=CHAVE_PUBLICA_BASE64
```

O Seven Desk utiliza os parametros somente no primeiro inicio de uma instalacao limpa. Nao altera ID/relay/key/API ja configurados, nao altera clientes personalizados com configuracao incorporada, nao sobrescreve sessao de conta persistida e nao interfere no acesso remoto autenticado. Se os parametros estiverem ausentes ou invalidos, nenhuma rede e modificada. O login do servidor publico nao e contornado: o cliente usa o servidor privado indicado.

**Teste de homologacao:** (1) dois clientes no servidor privado, (2) conectar por ID com permissao/senha, (3) testar relay com P2P indisponivel, (4) testar reinicio do app, (5) testar instalacao com servidor antigo para confirmar que nao e sobrescrito, (6) testar perda do servidor sem mensagens que prometam conexao inexistente.

## Licencas

Seven Desk deve preservar as licencas e atribuicoes de componentes upstream, inclusive AGPL quando aplicavel. O nome e identidade visual do produto nao alteram essas obrigacoes.
