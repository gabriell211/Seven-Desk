# Builds de homologação — Windows, Linux, macOS e Android

O PR #23 executa o workflow `Seven Desk Flutter CI` com `qa-artifacts: true` e
`upload-artifact: false`. Os pacotes são anexados ao **workflow run no GitHub
Actions**, não são colocados no site, no domínio de downloads e nem no GitHub
Releases. O workflow usa permissões `contents: read` e cada ação de publicar
release tem guarda explícita para não atuar em prévias.

| Plataforma | Arquivo esperado | Estado do pacote de QA |
| --- | --- | --- |
| Windows x64/ARM64 | `sevendesk-1.5.3-<arch>.exe` (portátil) e `.msi` opcional | Sem assinatura de publicação; validar UAC/portabilidade |
| Linux x64/ARM64 | `sevendesk-1.5.3-<arch>.AppImage` | Portátil; conceder permissão de execução localmente |
| macOS Intel/Apple Silicon | `sevendesk-1.5.3-<arch>.dmg` | Sem assinatura Apple/notarização; não distribuir a clientes |
| Android arm64, armv7, x86_64 e universal | `sevendesk-1.5.3-<arch>.apk` | QA assinado com chave de depuração, não válido para distribuição |

O workflow `verify-qa-binaries` só fica verde quando os pacotes obrigatórios de
Windows, macOS, Linux e Android universal estiverem presentes, não truncados,
com formatos de arquivos reconhecidos e SHA-256 registrado em
`sevendesk-qa-build-sha256`. Essa verificação **não** comprova assinatura de
código, comportamento gráfico, instalação ou conexão com o servidor.

## Homologação e publicação

1. No PR #23, abrir **Checks** e acompanhar o workflow `Seven Desk Flutter CI`
   relativo ao SHA correto; não usar um run antigo de outro commit.
2. Baixar os artefatos QA do run concluído e conferir o resumo de checksums.
   Não instalar binários não confiáveis em máquinas de clientes.
3. Executar a matriz de `docs/homologacao-seven-desk.md` em equipamentos
   autorizados, registrando evidências para o commit exato.
4. Se falhar, corrigir na **mesma branch e mesmo PR**. Não mesclar nem publicar
   release com CI vermelho, avisos relevantes ou testes reais pendentes.
5. Depois do aceite, assinar adequadamente os pacotes de produção, comprovar a
   integridade da versão e então publicar a tag/release e espelhar na VPS usando
   o script de publicação existente (sem criar manifestos fictícios).

Aviso: builds QA podem não ser executados quando não há runner GitHub disponível;
nesse caso, o workflow fica em fila. O commit do pipeline **não** significa que
EXE, MSI, AppImage, DMG ou APK já foram compilados.

## Compatibilidade intencionalmente quebrada

O próximo conjunto de executáveis deve usar a geração de ativação `sd2_` e a identidade pública renovada do Seven ID/Relay. Para desativar versões instaladas anteriormente, a equipe precisa executar o corte coordenado descrito em `docs/homologacao-seven-desk.md`, marcar os três testes de descontinuação como PASS com evidências reais e verificar que o servidor legado não permanece acessível como alternativa. **Nenhum dos dois passos está ativado na VPS de produção durante a preparação.**
