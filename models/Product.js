const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    category: {
      type: String,
      enum: ["Fresh", "Medicine", "Bakery", "Dairy", "Stationery", "Electronics"],
      required: true
    },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    image: { type: String, default: "" }, // real photo URL (uploaded or stock photo)
    letter: { type: String, default: "P" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
