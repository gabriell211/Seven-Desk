# Dependências Git do Seven Desk

Os builds do CI buscam as dependências diretamente das origens GitHub, mantendo as revisões imutáveis em `Cargo.lock` e nos submódulos. Não há redirecionamento obrigatório para a VPS: uma indisponibilidade do domínio de downloads do Seven Desk não deve impedir os builds de Android, Windows, Linux ou macOS.

| Dependência de terceiros | Commit fixado | Origem |
| --- | --- | --- |
| rustdesk-org/hwcodec | ec38ebaf2454269d4c5668a57e3813c6e5541be7 | https://github.com/rustdesk-org/hwcodec |
| rustdesk-org/externals | 8903740a1f47884906a6e347ad3d8d56304d9771 | https://github.com/rustdesk-org/externals |

As cópias read-only `https://downloads.sevendesk.tech/deps/hwcodec.git` e `https://downloads.sevendesk.tech/deps/externals.git` permanecem na VPS apenas como arquivos opcionais para recuperação manual. Não são usadas automaticamente pelos workflows. Para conferir a integridade desses arquivos, executar `bash .github/scripts/verify-dependency-mirrors.sh`; a verificação não é requisito para build.

**Licenciamento:** `hwcodec` e `externals` são componentes de terceiros, não código original do Seven Desk. `externals` contém SDKs e headers sujeitos a termos adicionais. Preservar licenças, autoria e histórico, e realizar revisão de redistribuição antes da distribuição comercial.

## Operação

- A origem é GitHub; `cargo build --locked` mantém o commit do `hwcodec` fixado e o próprio `hwcodec` aponta para o submódulo `externals` no commit esperado.
- Uma atualização de dependência exige revisão explícita e atualização do lockfile, nunca alteração silenciosa de commits.
- Os repositórios Git opcionais da VPS ficam em `/srv/sevendesk/downloads/deps` e são servidos por Caddy via Git HTTP estático, somente leitura.
- O Git HTTP estático não é compatível com clone shallow. Não utilizá-lo como destino obrigatório do CI.
- O endpoint `/deps` não é um instalador para clientes. A entrega dos instaladores continua independente.
- O PR #29 apresentou falhas de busca dos commits nas execuções macOS e no Android ARMv7 quando o CI redirecionava essas dependências à VPS. Foi removido o redirecionamento obrigatório; o novo CI ainda precisa passar.
- A aprovação do CI não substitui homologação de conexão remota e UAC em duas máquinas reais.

## Window helper Windows (MIT)

A biblioteca de janela auxiliar segue com os direitos do projeto original (MIT, copyright (c) 2022 fufesou). O commit fixado `ecd8d6a139eee76845ea66423fb739af450fda90` foi copiado como repositório Git somente leitura para `https://downloads.sevendesk.tech/deps/window-helper.git`. A workflow continua produzindo os mesmos DLLs `topmostwindow-artifacts-x64` e `topmostwindow-artifacts-ARM64`, mas usa diretório temporário `SevenDeskWindowHelper`.

O `WindowInjection.vcxproj` original habilita PCH como `Use` nas configurações ARM64 e sobrescreve como `Create` em `pch.cpp`. Para evitar erro MSVC C3859/C1076 em CI, o script `scripts/ci/patch-window-helper-pch.ps1` desabilita **ambos os tipos de PCH somente na cópia de build ARM64**, mantendo o x64 inalterado. O MSBuild roda com paralelismo limitado e **não ignora falhas**. A compilação da DLL segue obrigatória.

O repositório original não foi modificado. O código continua sendo uma dependência de terceiro com a licença MIT incluída e os avisos de autoria preservados. Os testes automatizados da configuração não substituem a validação real do binário ARM64 no GitHub Actions.
