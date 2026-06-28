const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Only initialize if keys exist, so app doesn't crash when payment isn't configured yet
const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      })
    : null;

// POST /api/payment/create-order - creates a Razorpay order for a given amount (in rupees)
router.post("/create-order", protect, async (req, res) => {
  if (!razorpay) {
    return res.status(503).json({
      message: "Payment gateway not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env"
    });
  }

  try {
    const { amount } = req.body; // amount in rupees
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay needs paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID // safe to expose, it's the public key
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/payment/verify - verifies payment signature after checkout completes on frontend
router.post("/verify", protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      return res.status(400).json({ verified: false, message: "Payment signature mismatch" });
    }

    res.json({ verified: true, message: "Payment verified successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
