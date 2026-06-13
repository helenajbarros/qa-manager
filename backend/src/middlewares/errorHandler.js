/**
 * Middleware global de tratamento de erros.
 * Deve ser o último app.use() registrado.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(`[ERROR] ${req.method} ${req.path}`, err.message);

  // Erros de validação com status explícito (ex: módulo com casos vinculados)
  if (err.status === 400)
    return res.status(400).json({ success: false, error: err.message });

  if (err.message?.includes("UNIQUE constraint"))
    return res.status(409).json({ success: false, error: "Registro duplicado." });

  if (err.message?.includes("FOREIGN KEY constraint"))
    return res.status(400).json({ success: false, error: "Referência inválida (chave estrangeira)." });

  res.status(500).json({ success: false, error: "Erro interno do servidor." });
}

module.exports = errorHandler;