const multer = require("multer");
const path   = require("path");
const fs     = require("fs");

function getUploadDir() {
  const dir = process.env.QA_UPLOAD_DIR || path.resolve(__dirname, "../../uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createUpload(prefix = "file") {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, getUploadDir()),
    filename:    (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      cb(null, `${prefix}-${unique}${path.extname(file.originalname)}`);
    },
  });
  return multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
}

module.exports = { createUpload };
