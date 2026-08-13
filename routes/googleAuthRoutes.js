const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");

const router = express.Router();

// GET /auth/google - redirect to Google login
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// GET /auth/google/callback - Google redirects here after login
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/?error=google_failed", session: false }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user._id, role: req.user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const user = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    };

    // Send token to frontend via URL — frontend will pick it up
    const redirectUrl = `${process.env.SITE_URL}/?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`;
    res.redirect(redirectUrl);
  }
);

module.exports = router;