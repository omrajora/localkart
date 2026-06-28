const express = require("express");
const upload = require("../middleware/upload");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// POST /api/upload - vendor/admin upload a real image, get back a usable URL
router.post("/", protect, authorize("vendor", "admin"), upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No image file received" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

module.exports = router;
