const svc    = require("../services/projectsService");
const r      = require("../utils/response");
const multer = require("multer");

// Usa memória — não salva em disco
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Apenas imagens são aceitas"));
  },
});

const index   = async (req,res,next) => { try { r.ok(res, svc.findAll()); } catch(e){next(e);} };
const show    = async (req,res,next) => { try { const p=svc.findById(req.params.id); p?r.ok(res,p):r.notFound(res,"Projeto"); } catch(e){next(e);} };
const store   = async (req,res,next) => { try { if(!req.body.name?.trim()) return r.badRequest(res,"name obrigatório"); r.created(res,svc.create(req.body)); } catch(e){next(e);} };
const update  = async (req,res,next) => { try { if(!svc.findById(req.params.id)) return r.notFound(res,"Projeto"); r.ok(res,svc.update(req.params.id,req.body)); } catch(e){next(e);} };
const destroy = async (req,res,next) => { try { const x=svc.remove(req.params.id); x.changes===0?r.notFound(res,"Projeto"):r.noContent(res); } catch(e){next(e);} };

const uploadLogo = [
  upload.single("logo"),
  async (req, res, next) => {
    try {
      if (!req.file) return r.badRequest(res, "Nenhuma imagem enviada");
      r.ok(res, svc.saveLogo(req.params.id, req.file.buffer, req.file.mimetype));
    } catch(e) { next(e); }
  }
];

module.exports = { index, show, store, update, destroy, uploadLogo };
