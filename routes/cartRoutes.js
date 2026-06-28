const express = require("express");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// All cart routes require login - cart belongs to req.user
router.use(protect);

// GET /api/cart
router.get("/", async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    const response = cart.items.map((item) => ({
      productId: item.product,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    }));

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/cart - add item { productId, quantity }
router.post("/", async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ message: "productId and quantity (>=1) are required" });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    const existing = cart.items.find((item) => item.product.toString() === productId);
    if (existing) {
      existing.quantity += Number(quantity);
    } else {
      cart.items.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: Number(quantity)
      });
    }

    await cart.save();

    res.json(
      cart.items.map((item) => ({
        productId: item.product,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }))
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/cart/:productId - update quantity (removes item if quantity <= 0)
router.patch("/:productId", async (req, res) => {
  try {
    const { quantity } = req.body;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    if (Number(quantity) <= 0) {
      cart.items = cart.items.filter((item) => item.product.toString() !== req.params.productId);
    } else {
      const item = cart.items.find((item) => item.product.toString() === req.params.productId);
      if (!item) return res.status(404).json({ message: "Item not in cart" });
      item.quantity = Number(quantity);
    }

    await cart.save();

    res.json(
      cart.items.map((item) => ({
        productId: item.product,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }))
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
