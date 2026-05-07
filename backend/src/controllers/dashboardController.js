const svc = require("../services/dashboardService");
const r   = require("../utils/response");
const index = async (req,res,next) => { try { r.ok(res, await svc.getDashboard(req.query)); } catch(e){next(e);} };
module.exports = { index };
