const svc = require("../services/dashboardService");
const r   = require("../utils/response");
const { getUserProjectIds } = require("../services/userProjectsService");

// BUG 5 CORRIGIDO: qualquer gerente autenticado podia ver dashboard de qualquer projeto
async function canAccessProject(user, projectId) {
  if (!projectId) return true;
  if (user.role === "admin") return true;
  if (user.role === "manager") {
    const { query } = require("../database/connection");
    const rows = await query("SELECT id FROM projects WHERE id=$1 AND created_by_id=$2", [projectId, user.id]);
    if (rows.length > 0) return true;
  }
  const ids = await getUserProjectIds(user.id, user.role);
  return (ids || []).map(Number).includes(Number(projectId));
}

const index = async (req,res,next) => {
  try {
    const { project_id } = req.query;
    if (project_id && !(await canAccessProject(req.user, project_id))) {
      return res.status(403).json({success:false,error:"Sem acesso a este projeto"});
    }
    r.ok(res, await svc.getDashboard(req.query));
  } catch(e){next(e);}
};

module.exports = { index };
