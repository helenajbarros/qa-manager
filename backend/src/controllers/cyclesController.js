const svc  = require("../services/cyclesService");
const r    = require("../utils/response");
const path = require("path");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: path.resolve(__dirname, "../../uploads"),
  filename: (_req, file, cb) => cb(null, `ev-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10*1024*1024 } });

const index   = async (req,res,next) => { try { r.ok(res, svc.findAllCycles(req.query)); } catch(e){next(e);} };
const show    = async (req,res,next) => { try { const x=svc.findCycleById(req.params.id); x?r.ok(res,x):r.notFound(res,"Ciclo"); } catch(e){next(e);} };
const store   = async (req,res,next) => { try { if(!req.body.name?.trim()) return r.badRequest(res,"name obrigatório"); r.created(res,svc.createCycle(req.body)); } catch(e){next(e);} };
const update  = async (req,res,next) => { try { if(!req.body.name?.trim()) return r.badRequest(res,"name obrigatório"); if(!svc.findCycleById(req.params.id)) return r.notFound(res,"Ciclo"); r.ok(res,svc.updateCycle(req.params.id,req.body)); } catch(e){next(e);} };
const destroy = async (req,res,next) => { try { const x=svc.removeCycle(req.params.id); x.changes===0?r.notFound(res,"Ciclo"):r.noContent(res); } catch(e){next(e);} };

const listExecutions  = async (req,res,next) => { try { r.ok(res, svc.findExecutionsByCycle(req.params.id)); } catch(e){next(e);} };
const addExecutions   = async (req,res,next) => { try { const {test_case_ids}=req.body; if(!Array.isArray(test_case_ids)||!test_case_ids.length) return r.badRequest(res,"test_case_ids obrigatório"); r.created(res,{added:svc.addExecutions(req.params.id,test_case_ids)}); } catch(e){next(e);} };
const updateExecution = async (req,res,next) => { try { const x=svc.findExecutionById(req.params.execId); if(!x) return r.notFound(res,"Execução"); r.ok(res,svc.updateExecution(req.params.execId,req.body)); } catch(e){next(e);} };
const removeExecution = async (req,res,next) => { try { const x=svc.removeExecution(req.params.execId); x.changes===0?r.notFound(res,"Execução"):r.noContent(res); } catch(e){next(e);} };
const uploadEvidence  = async (req,res,next) => { try { if(!req.file) return r.badRequest(res,"Arquivo obrigatório"); r.ok(res,svc.addEvidenceFile(req.params.execId,req.file)); } catch(e){next(e);} };
const deleteEvidence  = async (req,res,next) => { try { r.ok(res,svc.removeEvidenceFile(req.params.execId,req.params.fileId)); } catch(e){next(e);} };

module.exports = { index, show, store, update, destroy, listExecutions, addExecutions, updateExecution, removeExecution, uploadEvidence: [upload.single("file"), uploadEvidence], deleteEvidence };
