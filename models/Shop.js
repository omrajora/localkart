const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    address: { type: String, required: true },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] } // [lng, lat]
    },
    rating: { type: Number, default: 4.5 },
    image: { type: String, default: "" }, // real photo URL
    letter: { type: String, default: "S" }
  },
  { timestamps: true }
);

shopSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Shop", shopSchema);
