# Seven Desk — site oficial

Website e área de conta do **Seven Desk**, com identidade escura/roxa e páginas em português do Brasil.

- **Produção:** https://www.sevendesk.tech/
- **Repositório:** https://github.com/gabriell211/Seven-Desk
- **Documentação principal:** [README do Seven Desk](../README.md)
- **Instaladores:** [downloads do Seven Desk](https://downloads.sevendesk.tech/)

## Executar testes e compilar

Requer Node.js 24 e npm, com as versões de dependências registradas em `package-lock.json`.

```bash
cd website
npm ci
npm test
npm run build
```

O build usa esbuild e publica os arquivos estáticos permitidos em `website/public/`. As APIs sob `api/`, o código servidor sob `lib/`, arquivos de banco e valores secretos **não podem ser copiados** para o diretório público.

## Estrutura

| Arquivo ou diretório | Função |
| --- | --- |
| `index.html`, `styles.css`, `script.js` | Página inicial e layout responsivo |
| `assets/seven-desk-logo.svg`, `favicon.svg` | Identidade visual roxa oficial |
| `conta.html`, `conta.js`, `conta.css` | Login, cadastro, verificação e recuperação de senha |
| `api/` | Rotas de backend (disponibilidade de conta e autenticação) |
| `lib/` | Módulos privados de backend quando presentes |
| `tests/` | Testes Node de rotas, segurança, conteúdo e ícones |
| `vercel.json` | Rewrites, redirecionamentos e cabeçalhos |
| `licencas.html`, `privacidade.html` | Termos, atribuições e privacidade |

## Rotas

- `/`: apresentação, planos e downloads.
- `/entrar`: autenticação.
- `/cadastro`: criação de conta, quando liberada.
- `/recuperar-senha` e `/redefinir-senha`: recuperação por código OTP, quando habilitada.
- `/favicon.svg`: favicon original; `/favicon.ico` redireciona para o SVG, evitando requisições 404 de navegadores.

## Publicação e DNS

O projeto **`seven-desk-site`** na Vercel usa o diretório `website`. O site funciona no subdomínio `www.sevendesk.tech`.

O domínio raiz `sevendesk.tech` atende à infraestrutura de conexões remotas e não deve ser repontado para a Vercel sem uma migração planejada. O código do cliente utiliza seu próprio endpoint de servidor.

Alterações na branch `main` podem iniciar um deploy pela integração Git. Consulte a Vercel e os testes da CI antes de afirmar que uma revisão está publicada. Limites de builds do plano podem impedir a criação de novos deployments.

## Autenticação, dados e pagamentos

O site contém fluxos de autenticação conectados ao Neon Auth e pode utilizar PostgreSQL em APIs de assinaturas. A presença de páginas e variáveis configuradas **não significa** que o cadastro ou a cobrança estejam liberados.

As flags `SEVEN_ACCOUNT_STATUS_ENABLED`, `SEVEN_REGISTRATION_ENABLED`, `SEVEN_PASSWORD_RECOVERY_ENABLED` e as flags de cobrança devem permanecer desativadas até que autenticação, entrega de OTP, licenciamento no servidor, conciliação de pagamentos e estornos estejam homologados. Nunca armazene chaves de pagamento, senha SMTP ou string de conexão diretamente no JavaScript público.

## Identidade e licenças

O visual do website acompanha o aplicativo Seven Desk. Componentes de terceiros continuam sujeitos aos avisos e licenças do repositório, inclusive à [GNU AGPL-3.0](../LICENCE) onde aplicável.

## Diagnóstico rápido

- **`/favicon.ico` retorna 404:** confirme se a versão publicada contém o redirecionamento de `vercel.json` para `/favicon.svg`. Um commit no GitHub, sozinho, não garante que a Vercel tenha executado o deploy.
- **Aviso `XSLTProcessor` de `xslt-extension.js`:** quando o arquivo é carregado por uma extensão do navegador, a mensagem não é emitida pelo site Seven Desk. Atualize ou desative a extensão responsável para testar.
- **Status vermelho da Vercel:** diferencie falha de compilação de limite de builds do plano; veja a URL e os eventos associados ao commit.
