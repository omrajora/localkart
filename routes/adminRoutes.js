const express = require("express");
const User = require("../models/user");
const Shop = require("../models/Shop");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Every route here is admin-only
router.use(protect, authorize("admin"));

// ---- USERS ----
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch("/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body;
    if (!["customer", "vendor", "delivery", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---- SHOPS ----
router.get("/shops", async (req, res) => {
  try {
    const shops = await Shop.find().sort({ createdAt: -1 });
    res.json(shops);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch("/shops/:id", async (req, res) => {
  try {
    const shop = await Shop.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    res.json(shop);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/shops/:id", async (req, res) => {
  try {
    await Shop.findByIdAndDelete(req.params.id);
    await Product.deleteMany({ shop: req.params.id });
    res.json({ message: "Shop and its products deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---- PRODUCTS ----
router.get("/products", async (req, res) => {
  try {
    const products = await Product.find().populate("shop", "name").sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---- ORDERS ----
router.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find().populate("user", "name email").sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
