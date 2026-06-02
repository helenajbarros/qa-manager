const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "qa_secret_2024";

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autenticado" });
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch { res.status(401).json({ error: "Token inválido" }); }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acesso negado" });
  next();
}

// Admin ou Gerente
function requireAdminOrManager(req, res, next) {
  if (!["admin","manager"].includes(req.user?.role))
    return res.status(403).json({ error: "Acesso negado" });
  next();
}

module.exports = { authenticate, requireAdmin, requireAdminOrManager };
