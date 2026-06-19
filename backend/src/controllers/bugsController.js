const svc    = require("../services/bugsService");
const r      = require("../utils/response");
const path   = require("path");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (_,__,cb) => cb(null, process.env.QA_UPLOAD_DIR || "uploads"),
  filename:    (_,file,cb) => cb(null, `bug-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10*1024*1024 } });

const index   = async (req,res,next) => {
  try {
    const result = await svc.findAll(req.query);
    // Sempre retorna array em data + meta no topo para o api.js processar corretamente
    if (result && result.data) {
      res.json({ success:true, data: result.data, total: result.total, page: result.page, pages: result.pages });
    } else {
      r.ok(res, result);
    }
  } catch(e){next(e);}
};
const show    = async (req,res,next) => {
  try {
    const x = await svc.findById(req.params.id);
    const activity = await svc.getActivity(req.params.id);
    x ? r.ok(res, {...x, activity}) : r.notFound(res,"Bug");
  } catch(e){next(e);}
};
const store   = async (req,res,next) => {
  try {
    if(!req.body.title?.trim()) return r.badRequest(res,"title obrigatório");
    console.log("[BUG CREATE] body:", JSON.stringify({
      actual_result: req.body.actual_result,
      expected_result: req.body.expected_result,
      environment: req.body.environment,
      priority: req.body.priority
    }));
    r.created(res, await svc.create(req.body));
  } catch(e){next(e);}
};
const update  = async (req,res,next) => {
  try {
    // title só é obrigatório se enviado (permite atualizações parciais como autosave de steps)
    if("title" in req.body && !req.body.title?.trim()) return r.badRequest(res,"title obrigatório");
    const existing = await svc.findById(req.params.id);
    if(!existing) return r.notFound(res,"Bug");
    // Merge com dados existentes para atualizações parciais
    const merged = { ...existing, ...req.body };
    r.ok(res, await svc.update(req.params.id, merged, req.user?.id));
  } catch(e){next(e);}
};
const destroy = async (req,res,next) => {
  try {
    const x = await svc.remove(req.params.id);
    x.changes===0 ? r.notFound(res,"Bug") : r.noContent(res);
  } catch(e){next(e);}
};
const uploadFile = [
  upload.single("file"),
  async (req,res,next) => {
    try {
      if(!req.file) return r.badRequest(res,"Arquivo obrigatório");
      r.ok(res, await svc.addFile(req.params.id, req.file));
    } catch(e){next(e);}
  }
];
const deleteFile = async (req,res,next) => {
  try { r.ok(res, await svc.removeFile(req.params.id, req.params.fileId)); } catch(e){next(e);}
};

// Bugs relacionados
const addRelation = async (req,res,next) => {
  try {
    const { related_bug_id } = req.body;
    if (!related_bug_id) return r.badRequest(res, "related_bug_id obrigatório");
    r.ok(res, await svc.addRelation(req.params.id, related_bug_id));
  } catch(e){next(e);}
};
const removeRelation = async (req,res,next) => {
  try {
    r.ok(res, await svc.removeRelation(req.params.id, req.params.relatedId));
  } catch(e){next(e);}
};

module.exports = { index, show, store, update, destroy, uploadFile, deleteFile,
  addRelation, removeRelation };