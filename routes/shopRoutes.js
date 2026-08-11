const express = require("express");
const Shop = require("../models/Shop");
const { protect, authorize } = require("../middleware/authMiddleware");
const { geocodeAddress } = require("../utils/geocode");

const router = express.Router();

// GET /api/shops - public, used by customer homepage
router.get("/", async (req, res) => {
  try {
    const shops = await Shop.find();
    res.json(shops);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/shops/mine - vendor's own shops
router.get("/mine", protect, authorize("vendor", "admin"), async (req, res) => {
  try {
    const shops = await Shop.find({ owner: req.user._id });
    res.json(shops);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// DELETE /api/shops/:id - vendor apni shop delete kar sakta hai
router.delete("/:id", protect, authorize("vendor", "admin"), async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    if (shop.owner.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this shop" });
    }

    await Shop.findByIdAndDelete(req.params.id);

    // Delete all products of this shop too
    const Product = require("../models/Product");
    await Product.deleteMany({ shop: req.params.id });

    res.json({ message: "Shop and its products deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/shops - only vendor/admin can create a shop
router.post("/", protect, authorize("vendor", "admin"), async (req, res) => {
  try {
    const { name, category, address, image, letter } = req.body;

    if (!name || !category || !address) {
      return res.status(400).json({ message: "name, category and address are required" });
    }

    const coords = await geocodeAddress(address);

    const shop = await Shop.create({
      name,
      category,
      address,
      owner: req.user._id,
      image,
      letter,
      location: coords ? { type: "Point", coordinates: [coords.lng, coords.lat] } : undefined
    });

    res.status(201).json(shop);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
