const svc = require("../services/testCasesService");
const r   = require("../utils/response");

const index   = async (req,res,next) => { try { r.ok(res, await svc.findAll(req.query)); } catch(e){next(e);} };
const show    = async (req,res,next) => { try { const x=await svc.findById(req.params.id); x?r.ok(res,x):r.notFound(res,"Recurso"); } catch(e){next(e);} };
const store   = async (req,res,next) => { try { r.created(res, await svc.create(req.body)); } catch(e){next(e);} };
const update  = async (req,res,next) => { try { const x=await svc.update(req.params.id,req.body); x?r.ok(res,x):r.notFound(res,"Recurso"); } catch(e){next(e);} };
const destroy = async (req,res,next) => { try { const x=await svc.remove(req.params.id); x.changes===0?r.notFound(res,"Recurso"):r.noContent(res); } catch(e){next(e);} };

module.exports = { index, show, store, update, destroy };
