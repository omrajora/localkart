const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/user");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

// GET /api/dashboard - returns stats relevant to the logged-in user's role
router.get("/", async (req, res) => {
  try {
    const role = req.user.role;
    const result = {};

    if (role === "customer") {
      const orders = await Order.find({ user: req.user._id });
      result.customer = {
        totalOrders: orders.length,
        deliveryTarget: "45 min"
      };
    }

    if (role === "vendor" || role === "admin") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const ordersToday = await Order.countDocuments({ createdAt: { $gte: today } });
      const revenueAgg = await Order.aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: "$total" } } }
      ]);
      const lowStock = await Product.find({ stock: { $lt: 20 } }).limit(5);

      result.vendor = {
        ordersToday,
        dailyRevenue: revenueAgg[0]?.total || 0,
        lowStockProducts: lowStock
      };
    }

    if (role === "delivery") {
      const completedToday = await Order.countDocuments({ status: "Delivered", deliveryPartner: req.user.name });
      result.delivery = {
        completedToday,
        activeOrders: await Order.find({ deliveryPartner: req.user.name, status: { $ne: "Delivered" } })
      };
    }

    if (role === "admin") {
      const users = await User.countDocuments();
      const orders = await Order.countDocuments();
      const gmvAgg = await Order.aggregate([{ $group: { _id: null, total: { $sum: "$total" } } }]);

      result.admin = {
        users,
        orders,
        gmv: gmvAgg[0]?.total || 0
      };
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
