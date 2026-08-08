const express = require("express");
const Review = require("../models/Review");
const Order = require("../models/Order");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// GET /api/reviews/:productId - get all reviews for a product (public)
router.get("/:productId", async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .sort({ createdAt: -1 });
    const avgRating = reviews.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;
    res.json({ reviews, avgRating, total: reviews.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/reviews/:productId - submit a review (only if user has ordered this product)
router.post("/:productId", protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({ message: "Rating and comment are required" });
    }

    // Check if user has actually ordered this product
    const hasBought = await Order.findOne({
      user: req.user._id,
      "items.product": req.params.productId,
      status: "Delivered"
    });

    if (!hasBought) {
      return res.status(403).json({ message: "You can only review products you have purchased and received." });
    }

    // Check if already reviewed
    const alreadyReviewed = await Review.findOne({
      product: req.params.productId,
      user: req.user._id
    });

    if (alreadyReviewed) {
      return res.status(400).json({ message: "You have already reviewed this product." });
    }

    const review = await Review.create({
      product: req.params.productId,
      user: req.user._id,
      name: req.user.name,
      rating: Number(rating),
      comment
    });

    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/reviews/:reviewId - delete own review
router.delete("/:reviewId", protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    await review.deleteOne();
    res.json({ message: "Review deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;