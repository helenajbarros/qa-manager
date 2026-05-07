/**
 * Padroniza todas as respostas da API.
 */

const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });

const created = (res, data) => ok(res, data, 201);

const noContent = (res) => res.status(204).send();

const notFound = (res, entity = "Recurso") =>
  res.status(404).json({ success: false, error: `${entity} não encontrado(a)` });

const badRequest = (res, message) =>
  res.status(400).json({ success: false, error: message });

const conflict = (res, message) =>
  res.status(409).json({ success: false, error: message });

const serverError = (res, err) => {
  console.error(err);
  res.status(500).json({ success: false, error: "Erro interno do servidor" });
};

module.exports = { ok, created, noContent, notFound, badRequest, conflict, serverError };
