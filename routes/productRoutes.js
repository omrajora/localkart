const express = require("express");
const { body, validationResult } = require("express-validator");
const Product = require("../models/Product");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// GET /api/products - public, supports ?category= filter
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.category && req.query.category !== "All") {
      filter.category = req.query.category;
    }
    const products = await Product.find(filter).populate("shop", "name location address");
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/products/mine - vendor's own products (across their shops)
router.get("/mine", protect, authorize("vendor", "admin"), async (req, res) => {
  try {
    const Shop = require("../models/Shop");
    const myShops = await Shop.find({ owner: req.user._id }).select("_id");
    const shopIds = myShops.map((s) => s._id);
    const products = await Product.find({ shop: { $in: shopIds } }).populate("shop", "name");
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const productValidation = [
  body("name").trim().notEmpty().withMessage("Product name is required"),
  body("shop").notEmpty().withMessage("Shop id is required"),
  body("category")
    .isIn(["Fresh", "Medicine", "Bakery", "Dairy", "Stationery", "Electronics"])
    .withMessage("Invalid category"),
  body("price").isFloat({ min: 0 }).withMessage("Price must be a positive number"),
  body("stock").isInt({ min: 0 }).withMessage("Stock must be a non-negative integer")
];

// POST /api/products - vendor/admin only
router.post("/", protect, authorize("vendor", "admin"), productValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  }

  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/products/:id - vendor/admin can update stock/price
router.patch("/:id", protect, authorize("vendor", "admin"), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/products/:id - vendor/admin only
router.delete("/:id", protect, authorize("vendor", "admin"), async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
