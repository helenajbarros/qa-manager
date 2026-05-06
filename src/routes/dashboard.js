const { Router } = require("express");
const c = require("../controllers/dashboardController");

const router = Router();

router.get("/", c.index);

module.exports = router;
