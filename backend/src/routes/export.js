const { Router }   = require("express");
const { authenticate } = require("../middlewares/auth");
const { getExportData } = require("../services/exportService");
const r = require("../utils/response");

const router = Router();

router.get("/", authenticate, async (req, res, next) => {
  try {
    r.ok(res, await getExportData(req.query));
  } catch(e) { next(e); }
});

module.exports = router;
