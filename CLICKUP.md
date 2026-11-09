# Integração com o ClickUp (v1.8.2)

**Enviar:** na tela de Bugs, marque os bugs e clique em "Enviar ao ClickUp como task". O link da task fica na coluna Tracker.
**Espelhar:** quando a task muda de status no ClickUp (ex.: "em andamento"), o status do bug muda aqui.

## Configuração (só admin, uma vez)
1. ClickUp → Configurações → Apps → API Token (começa com `pk_`).
2. Na tela de Bugs, clique em ⚙ → cole o token → "Salvar token" (fica criptografado, não volta para a tela).
3. "Buscar listas (boards)" → escolha a lista → "Usar esta lista".
4. (Opcional) "Ligar espelhamento automático": cria um webhook no ClickUp apontando para este servidor. Exige servidor em https
   (defina `PUBLIC_API_URL=https://seu-servidor` se estiver atrás de proxy). Sem isso, use "↻ Sincronizar status".

## Quem pode o quê
- Admin: configura token, lista e espelhamento.
- Admin, manager e editor: enviam bugs e sincronizam. Viewer só consulta.

## Mapa de status (ClickUp → bug)
tipo open / "a fazer" → aberto · "em andamento", "review", "teste" → em andamento · tipo done / "concluído" → corrigido · tipo closed → fechado.
Status que o QA Manager não sabe traduzir não mudam o bug (aparecem em "Sincronizar status").

## Envio automático (opcional)
No ⚙, marque "Enviar ao ClickUp assim que um bug for criado". Vale só para bugs criados na tela "Novo bug" por admin/manager/editor.
Bugs vindos do QA Autopilot continuam manuais. Se o ClickUp falhar, o bug é criado normalmente e você envia depois pelo botão.

## Rodando local com Docker
Abra `http://localhost:8080/qa-manager/` (login inicial `admin@qa.com` / `admin123`). A tela usa o backend do próprio compose, não o servidor publicado.

## Token: cada pessoa usa o seu (v1.8.3)
Cada usuário (editor ou acima) cola o próprio token pessoal em ⚙ ClickUp (ClickUp → Configurações → API da ClickUp). A task sai no nome de quem enviou. Sem token pessoal, o envio é bloqueado. O admin escolhe a lista e liga o espelhamento. Os tokens ficam criptografados no banco.

## v1.8.6: anexos e status nos dois sentidos
- Ao enviar, os arquivos de evidência do bug (até 10) são anexados na task.
- Mudou o status do bug aqui → muda na task (usa o status equivalente da lista; se não houver, registra no histórico). Usa o token de quem mudou.
- Mudou na task → muda aqui (webhook ou "Sincronizar status").

## v1.8.7: quem moveu e responsável espelhados
- Mudou o status da task no ClickUp → o bug muda aqui, o histórico mostra o status e **quem moveu** ("movido no ClickUp por Fulano"). Se a pessoa tiver usuário no QA Manager com o **mesmo e-mail** (ou mesmo nome), a mudança aparece no nome dela.
- Atribuiu alguém à task → vira o **responsável** do bug (casando pelo e-mail/nome do usuário) e ele recebe notificação. Remover o responsável na task limpa aqui. Sem usuário correspondente, o histórico avisa para cadastrar com o mesmo e-mail.
- "Sincronizar status" também atualiza o responsável.
- **Importante:** quem já ligou o espelhamento deve **desligar e ligar de novo** (Opções do admin) para o ClickUp passar a avisar também as trocas de responsável.

## v1.8.9: responsável travado + nome sem conta
- Bug que está no ClickUp: o campo Responsável (dev) é definido lá; aqui fica só leitura ("🔗 definido no ClickUp") e editar o bug não o troca.
- Se o dev atribuído no ClickUp ainda não tem usuário no QA Manager (e-mail/nome iguais), o **nome dele do ClickUp aparece mesmo assim** (lista e tela do bug); quando o usuário for cadastrado e a task for sincronizada, passa a ser o usuário de verdade. Coluna nova `bugs.clickup_assignee` criada sozinha.
