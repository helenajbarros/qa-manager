const svc  = require("../services/bugsService");
const r    = require("../utils/response");
const path = require("path");
const multer = require("multer");
const storage = multer.diskStorage({
  destination: (_,__,cb) => cb(null, process.env.QA_UPLOAD_DIR || "uploads"),
  filename: (_,file,cb) => cb(null, `bug-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10*1024*1024 } });

const index   = async (req,res,next) => { try { r.ok(res, await svc.findAll(req.query)); } catch(e){next(e);} };
const show    = async (req,res,next) => { try { const x=await svc.findById(req.params.id); x?r.ok(res,x):r.notFound(res,"Bug"); } catch(e){next(e);} };
const store   = async (req,res,next) => { try { if(!req.body.title?.trim()) return r.badRequest(res,"title obrigatório"); r.created(res, await svc.create(req.body)); } catch(e){next(e);} };
const update  = async (req,res,next) => { try { if(!req.body.title?.trim()) return r.badRequest(res,"title obrigatório"); if(!await svc.findById(req.params.id)) return r.notFound(res,"Bug"); r.ok(res, await svc.update(req.params.id,req.body)); } catch(e){next(e);} };
const destroy = async (req,res,next) => { try { const x=await svc.remove(req.params.id); x.changes===0?r.notFound(res,"Bug"):r.noContent(res); } catch(e){next(e);} };
const uploadFile = [upload.single("file"), async (req,res,next) => { try { if(!req.file) return r.badRequest(res,"Arquivo obrigatório"); r.ok(res, await svc.addFile(req.params.id,req.file)); } catch(e){next(e);} }];
const deleteFile = async (req,res,next) => { try { r.ok(res, await svc.removeFile(req.params.id,req.params.fileId)); } catch(e){next(e);} };

module.exports = { index, show, store, update, destroy, uploadFile, deleteFile };
