const svc    = require("../services/projectsService");
const multer = require("multer");
const r      = require("../utils/response");

// Usa memoryStorage para ter req.file.buffer disponível (necessário para salvar como base64)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

exports.index = async (req, res, next) => {
  try {
    const data = await svc.findAll(req.user.id, req.user.role);
    r.ok(res, data);
  } catch(e) { next(e); }
};

exports.show = async (req, res, next) => {
  try {
    const data = await svc.findById(req.params.id);
    if (!data) return r.notFound(res);
    r.ok(res, data);
  } catch(e) { next(e); }
};

exports.store = async (req, res, next) => {
  try {
    const data = await svc.create(req.body);
    r.created(res, data);
  } catch(e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const data = await svc.update(req.params.id, req.body);
    if (!data) return r.notFound(res);
    r.ok(res, data);
  } catch(e) { next(e); }
};

exports.destroy = async (req, res, next) => {
  try {
    await svc.remove(req.params.id);
    r.ok(res, { deleted: true });
  } catch(e) { next(e); }
};

exports.uploadLogo = [
  upload.single("logo"),
  async (req, res, next) => {
    try {
      if (!req.file) return r.badRequest(res, "Arquivo não enviado");
      const data = await svc.saveLogo(req.params.id, req.file.buffer, req.file.mimetype);
      r.ok(res, data);
    } catch(e) { next(e); }
  }
];
