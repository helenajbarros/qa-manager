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
