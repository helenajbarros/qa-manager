const svc = require("../services/testCasesService");
const r   = require("../utils/response");

const index   = async (req,res,next) => {
  try {
    const result = await svc.findAll(req.query);
    if (result && result.data) {
      res.json({ success:true, data: result.data, total: result.total, page: result.page, pages: result.pages });
    } else {
      r.ok(res, result);
    }
  } catch(e){next(e);}
};
const show    = async (req,res,next) => { try { const x=await svc.findById(req.params.id); x?r.ok(res,x):r.notFound(res,"Recurso"); } catch(e){next(e);} };
const store   = async (req,res,next) => { try { r.created(res, await svc.create(req.body, req.user?.id)); } catch(e){next(e);} };
const update  = async (req,res,next) => { try { const x=await svc.update(req.params.id, req.body, req.user?.id); x?r.ok(res,x):r.notFound(res,"Recurso"); } catch(e){next(e);} };
const destroy = async (req,res,next) => { try { const x=await svc.remove(req.params.id); x.changes===0?r.notFound(res,"Recurso"):r.noContent(res); } catch(e){next(e);} };

// Histórico de atividades do caso de teste
const listActivity = async (req,res,next) => { try { r.ok(res, await svc.getActivity(req.params.id)); } catch(e){next(e);} };

module.exports = { index, show, store, update, destroy, listActivity };