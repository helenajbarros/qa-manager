const svc = require("../services/dashboardService");
const r   = require("../utils/response");

async function index(req, res, next) {
  try { r.ok(res, svc.getDashboard()); }
  catch (e) { next(e); }
}

module.exports = { index };
