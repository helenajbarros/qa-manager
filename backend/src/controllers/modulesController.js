const svc = require("../services/modulesService");
const r   = require("../utils/response");

const index   = async (req,res,next) => { try { r.ok(res, svc.findAll(req.query)); } catch(e){next(e);} };
const show    = async (req,res,next) => { try { const x=svc.findById(req.params.id); x?r.ok(res,x):r.notFound(res,"Módulo"); } catch(e){next(e);} };
const store   = async (req,res,next) => { try { if(!req.body.name?.trim()) return r.badRequest(res,"name obrigatório"); r.created(res,svc.create(req.body)); } catch(e){next(e);} };
const update  = async (req,res,next) => { try { if(!svc.findById(req.params.id)) return r.notFound(res,"Módulo"); r.ok(res,svc.update(req.params.id,req.body)); } catch(e){next(e);} };
const destroy = async (req,res,next) => { try { const x=svc.remove(req.params.id); x.changes===0?r.notFound(res,"Módulo"):r.noContent(res); } catch(e){next(e);} };

module.exports = { index, show, store, update, destroy };
