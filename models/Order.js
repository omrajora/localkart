const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  name: String,
  price: Number,
  quantity: Number
});

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    taxes: { type: Number, default: 0 },
    total: { type: Number, required: true },
    address: { type: String, required: true },
    location: {
      lat: Number,
      lng: Number
    },
    distanceKm: Number,
    paymentMethod: { type: String, enum: ["UPI", "Cash on Delivery", "Debit Card", "Credit Card"], required: true },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    status: {
      type: String,
      enum: ["Placed", "Confirmed", "Packed", "Out for Delivery", "Delivered"],
      default: "Placed"
    },
    deliveryPartner: { type: String, default: "Not assigned" },
    eta: { type: String, default: "45 min" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
