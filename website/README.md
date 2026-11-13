# Seven Desk — website oficial

Site institucional estático em português do Brasil para o Seven Desk.

**Produção:** https://www.sevendesk.tech/

## Estrutura

- `index.html`: página inicial, recursos, casos de uso, instruções e downloads.
- `styles.css`: design responsivo, tipografia, acessibilidade e ilustração da interface.
- `script.js`: menu responsivo, perguntas frequentes e ano do rodapé.
- `privacidade.html` e `licencas.html`: transparência, atribuições e privacidade do site.
- `favicon.svg`: identidade do site.
- `vercel.json`: cabeçalhos de segurança e URLs limpas.

## Domínio e DNS

A Vercel serve o site em `www.sevendesk.tech` (CNAME `7a02be585b4d78b4.vercel-dns-017.com`). O domínio raiz `sevendesk.tech` permanece apontando para o servidor de acesso remoto em `187.53.111.184`, por isso o painel da Vercel pode informar que o apex está mal configurado. **Não alterar o A/AAAA do apex para resolver o alerta**, pois isso pode interromper conexões remotas. Redirecionamento HTTPS do apex para www exige configuração no servidor que atende o domínio raiz, ou migração de todos os endpoints remotos para um subdomínio próprio.

## Publicação

O projeto Vercel **seven-desk-site** está conectado ao repositório `gabriell211/Seven-Desk`, com Root Directory `website`. Ele é **independente** do projeto `seven-desk-deploy`, que atende à infraestrutura de conexão remota. Ao alterar o site na branch de produção, o Vercel pode disparar um novo deploy automaticamente.

A página é estática e não requer ambiente Node, variáveis secretas nem banco de dados.

## Downloads

Os botões apontam para a página de Releases do repositório oficial, não para um binário fixo. Se o repositório permanecer privado, usuários não autorizados precisarão de acesso para baixar os arquivos. Para distribuição pública, publique os instaladores homologados em um canal público sob controle do projeto; não exponha chaves privadas ou tokens no frontend.

## Compatibilidade e segurança

As ilustrações da home são **conceituais**, não capturas de uma sessão real. Recursos podem variar conforme a versão do cliente e a topologia da rede. A identidade visual e os avisos legais não alteram as obrigações de licença das bibliotecas de terceiros.
