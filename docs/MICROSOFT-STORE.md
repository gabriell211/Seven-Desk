# Seven Desk na Microsoft Store (MSIX)

O website continua distribuindo EXE, MSI, Linux, macOS e Android pela VPS.
**Este pipeline separado gera um MSIXBUNDLE para revisão no Microsoft Partner Center.**
Não publica releases no GitHub, não instala nada no site e não submete à Store automaticamente.

## O que o CI cria

- Pacote MSIX x64 contendo o diretório completo do build nativo Flutter, incluindo SevenDesk.exe, DLLs e assets.
- Pacote MSIX ARM64 separado, preservando a arquitetura real do PE.
- Um único arquivo sevendesk-<versão>.msixbundle com os dois pacotes e arquivo SHA-256.
- Manifestos com execução Win32 full-trust (mediumIL) e logotipos PNG reais gerados do res/icon.png.
- Teste de empacotamento/desempacotamento com MakeAppx e validação SHA-256 do executável original.

O CI do PR usa **exclusivamente para QA** o build Windows 1.5.4 aprovado na execução
https://github.com/gabriell211/Seven-Desk/actions/runs/44484512121
(commit f7f91b9b54efc674a260980590ff433864c3821b). A identidade SevenDesk.StoreQA
é fictícia para teste e nunca deve ser enviada ao Partner Center.

## Preparação da identidade real

1. Criar/verificar a conta Microsoft Partner Center e reservar o nome **Seven Desk**.
2. Em Product identity, copiar literalmente Identity Name e Publisher; copiar também o nome de exibição do publicador.
3. Configurar, como **repository variables** (não credenciais), os três valores:
   - MS_STORE_PACKAGE_NAME
   - MS_STORE_PUBLISHER
   - MS_STORE_PUBLISHER_DISPLAY_NAME
4. Produzir build Windows x64 e ARM64 em um workflow oficial concluído com sucesso (main ou tag), com payload completo sevendesk-unsigned-windows-x86_64 e sevendesk-unsigned-windows-aarch64.
5. Executar manualmente **Seven Desk Microsoft Store MSIX** com source_run_id, source_commit SHA completo, versão MSIX de quatro partes (ex.: 1.5.4.0) e use_partner_center=true. O workflow verifica a procedência, não aceita PR QA e **não publica** na loja por conta própria.
6. Conferir os arquivos, abrir o Partner Center e submeter o bundle para certificação. A Microsoft assina gratuitamente o MSIX depois da aprovação.

Não crie nem use certificado autoassinado como se fosse uma assinatura comercial. Para instalar o MSIX não assinado fora da Store, é necessário um processo de assinatura de teste controlado; nunca distribuí-lo no site público. Versões devem ser crescentes e ter a quarta parte 0.

## Homologação obrigatória da edição Store

MSIX usa redirecionamento/virtualização de arquivos e Registro e pode impedir o
comportamento de drivers, serviços Windows, elevação UAC, acesso não assistido e
instalação de componentes do sistema. **A integridade do MSIX não valida essas funcionalidades.**

Antes do envio definitivo:
- Testar instalação e abertura como pacote MSIX assinado para homologação em Windows 10/11, x64 e ARM64, usando dispositivos autorizados.
- Testar conexão e desconexão reais em duas máquinas, UAC, serviço em segundo plano, atualização, transferência de arquivos, driver de vídeo, scanner/impressão e funcionamento sem instalar o EXE tradicional.
- Conferir logos/capturas/privacidade, executar Windows App Certification Kit e revisar capacidades restritas (runFullTrust).
- Se a versão MSIX não suportar os recursos essenciais, não publicá-la como equivalente ao aplicativo tradicional. A rota MSI/EXE na Store exige assinatura CA dos executáveis, diferente do MSIX.

Referências:
- https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-manual-conversion
- https://learn.microsoft.com/en-us/windows/apps/publish/store-readiness-checklist
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
