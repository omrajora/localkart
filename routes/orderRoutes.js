const express = require("express");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const { protect, authorize } = require("../middleware/authMiddleware");
const { geocodeAddress, distanceInKm } = require("../utils/geocode");

const router = express.Router();

router.use(protect);

const HUB_LOCATION = { lat: 12.9716, lng: 77.5946 };

// POST /api/orders - place an order using current cart
router.post("/", async (req, res) => {
  try {
    const { address, paymentMethod, paymentStatus, razorpayOrderId, razorpayPaymentId } = req.body;

    if (!address || !paymentMethod) {
      return res.status(400).json({ message: "address and paymentMethod are required" });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryFee = subtotal > 300 ? 0 : 35;
    const taxes = Math.round(subtotal * 0.05);
    const total = subtotal + deliveryFee + taxes;

    const coords = await geocodeAddress(address);
    const distanceKm = coords ? distanceInKm(HUB_LOCATION, coords) : null;

    const order = await Order.create({
      user: req.user._id,
      items: cart.items.map((item) => ({
        product: item.product,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      subtotal,
      deliveryFee,
      taxes,
      total,
      address,
      location: coords || undefined,
      distanceKm,
      paymentMethod,
      paymentStatus: paymentStatus || (paymentMethod === "Cash on Delivery" ? "pending" : "paid"),
      razorpayOrderId,
      razorpayPaymentId,
      eta: distanceKm ? `${Math.max(15, Math.round(distanceKm * 6))} min` : "45 min"
    });

    cart.items = [];
    await cart.save();

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/orders/vendor - orders containing items from this vendor's shops
router.get("/vendor", authorize("vendor", "admin"), async (req, res) => {
  try {
    const Shop = require("../models/Shop");
    const myShops = await Shop.find({ owner: req.user._id }).select("_id");
    const shopIds = myShops.map((s) => s._id);
    const Product = require("../models/Product");
    const myProducts = await Product.find({ shop: { $in: shopIds } }).select("_id");
    const myProductIds = myProducts.map((p) => p._id.toString());

    const orders = await Order.find({ "items.product": { $in: myProductIds } })
      .populate("user", "name")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/orders/delivery - active assignment + available orders
router.get("/delivery", authorize("delivery", "admin"), async (req, res) => {
  try {
    const active = await Order.findOne({
      deliveryPartner: req.user.name,
      status: { $nin: ["Delivered", "Cancelled"] }
    }).sort({ createdAt: -1 });

    const available = await Order.find({
      status: { $in: ["Packed", "Confirmed"] },
      $or: [{ deliveryPartner: "Not assigned" }, { deliveryPartner: { $exists: false } }]
    }).limit(10);

    res.json({ active, available });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/orders/:id/accept - delivery partner accepts assignment
router.post("/:id/accept", authorize("delivery"), async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { deliveryPartner: req.user.name },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/orders/:id/cancel - customer cancels order (only when status is Placed)
router.post("/:id/cancel", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (order.status !== "Placed") {
      return res.status(400).json({ message: "Order can only be cancelled when status is Placed" });
    }

    order.status = "Cancelled";
    await order.save();

    res.json({ message: "Order cancelled successfully", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/orders/latest - most recent order for logged-in user
router.get("/latest", async (req, res) => {
  try {
    const order = await Order.findOne({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(order || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/orders - all orders of logged-in user
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/orders/:id/status - vendor/delivery/admin updates order status
router.patch("/:id/status", authorize("delivery", "vendor", "admin"), async (req, res) => {
  try {
    const { status, deliveryPartner } = req.body;
    const validStatuses = ["Placed", "Confirmed", "Packed", "Out for Delivery", "Delivered", "Cancelled"];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { ...(status && { status }), ...(deliveryPartner && { deliveryPartner }) },
      { new: true }
    );

    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;