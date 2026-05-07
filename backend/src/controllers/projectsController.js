const svc    = require("../services/projectsService");
const r      = require("../utils/response");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2*1024*1024 }, fileFilter: (_,file,cb) => file.mimetype.startsWith("image/") ? cb(null,true) : cb(new Error("Apenas imagens")) });

const index   = async (req,res,next) => { try { r.ok(res, await svc.findAll()); } catch(e){next(e);} };
const show    = async (req,res,next) => { try { const p=await svc.findById(req.params.id); p?r.ok(res,p):r.notFound(res,"Projeto"); } catch(e){next(e);} };
const store   = async (req,res,next) => { try { if(!req.body.name?.trim()) return r.badRequest(res,"name obrigatório"); r.created(res, await svc.create(req.body)); } catch(e){next(e);} };
const update  = async (req,res,next) => { try { if(!await svc.findById(req.params.id)) return r.notFound(res,"Projeto"); r.ok(res, await svc.update(req.params.id,req.body)); } catch(e){next(e);} };
const destroy = async (req,res,next) => { try { const x=await svc.remove(req.params.id); x.changes===0?r.notFound(res,"Projeto"):r.noContent(res); } catch(e){next(e);} };
const uploadLogo = [upload.single("logo"), async (req,res,next) => { try { if(!req.file) return r.badRequest(res,"Imagem obrigatória"); r.ok(res, await svc.saveLogo(req.params.id,req.file.buffer,req.file.mimetype)); } catch(e){next(e);} }];

module.exports = { index, show, store, update, destroy, uploadLogo };
