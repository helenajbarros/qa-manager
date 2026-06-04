const svc    = require("../services/cyclesService");
const r      = require("../utils/response");
const path   = require("path");
const multer = require("multer");

const UPLOAD_DIR = process.env.QA_UPLOAD_DIR || path.resolve(__dirname, "../../uploads");
const storage = multer.diskStorage({
  destination: (_,__,cb) => cb(null, UPLOAD_DIR),
  filename:    (_,file,cb) => cb(null, `${Date.now()}_${file.originalname.replace(/\s/g,"_")}`),
});
const upload = multer({ storage, limits: { fileSize: 10*1024*1024 } });

const index   = async (req,res,next) => {
  try {
    const result = await svc.findAllCycles(req.query);
    if (result && result.data) {
      res.json({ success:true, data: result.data, total: result.total, page: result.page, pages: result.pages });
    } else {
      r.ok(res, result);
    }
  } catch(e){next(e);}
};
const show    = async (req,res,next) => { try { const x=await svc.findCycleById(req.params.id); x?r.ok(res,x):r.notFound(res,"Ciclo"); } catch(e){next(e);} };
const store   = async (req,res,next) => { try { if(!req.body.name?.trim()) return r.badRequest(res,"name obrigatório"); r.created(res, await svc.createCycle(req.body)); } catch(e){next(e);} };
const update  = async (req,res,next) => { try { if(!req.body.name?.trim()) return r.badRequest(res,"name obrigatório"); r.ok(res, await svc.updateCycle(req.params.id, req.body, req.user?.id)); } catch(e){next(e);} };
const destroy = async (req,res,next) => { try { const x=await svc.removeCycle(req.params.id); x.changes===0?r.notFound(res,"Ciclo"):r.noContent(res); } catch(e){next(e);} };

const listExecutions  = async (req,res,next) => { try { r.ok(res, await svc.findExecutionsByCycle(req.params.id)); } catch(e){next(e);} };
const addExecutions   = async (req,res,next) => { try { const {test_case_ids}=req.body; if(!Array.isArray(test_case_ids)||!test_case_ids.length) return r.badRequest(res,"test_case_ids obrigatório"); r.created(res,{added: await svc.addExecutions(req.params.id,test_case_ids)}); } catch(e){next(e);} };
const updateExecution = async (req,res,next) => { try { const x=await svc.findExecutionById(req.params.execId); if(!x) return r.notFound(res,"Execução"); r.ok(res, await svc.updateExecution(req.params.execId,req.body)); } catch(e){next(e);} };
const removeExecution = async (req,res,next) => { try { const x=await svc.removeExecution(req.params.execId); x.changes===0?r.notFound(res,"Execução"):r.noContent(res); } catch(e){next(e);} };

// Histórico de atividades do ciclo
const listActivity = async (req,res,next) => { try { r.ok(res, await svc.getActivity(req.params.id)); } catch(e){next(e);} };

const uploadEvidence = [upload.single("file"), async (req,res,next) => {
  try { if(!req.file) return r.badRequest(res,"Arquivo obrigatório"); r.ok(res, await svc.addEvidenceFile(req.params.execId, req.file)); } catch(e){next(e);}
}];
const deleteEvidence = async (req,res,next) => { try { r.ok(res, await svc.removeEvidenceFile(req.params.execId, req.params.fileId)); } catch(e){next(e);} };

module.exports = { index, show, store, update, destroy, listExecutions, addExecutions, updateExecution, removeExecution, uploadEvidence, deleteEvidence, listActivity };
