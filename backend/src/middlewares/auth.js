const { verifyToken } = require("../services/usersService");

// Verifica se está autenticado
function authenticate(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, error: "Não autenticado" });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ success: false, error: "Token inválido ou expirado" });
  req.user = payload;
  next();
}

// Só admin pode executar
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin")
    return res.status(403).json({ success: false, error: "Acesso negado. Apenas admins." });
  next();
}

// Admin ou Gerente
function requireAdminOrManager(req, res, next) {
  if (!["admin","manager"].includes(req.user?.role))
    return res.status(403).json({ success: false, error: "Acesso negado." });
  next();
}

// Admin ou editor podem modificar
function requireEditor(req, res, next) {
  if (!["admin","manager","editor"].includes(req.user?.role))
    return res.status(403).json({ success: false, error: "Acesso negado. Apenas editores ou admins." });
  next();
}

module.exports = { authenticate, requireAdmin, requireAdminOrManager, requireEditor };
