const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const User = require("../models/user");

const router = express.Router();

// Store reset tokens temporarily in memory
// (works fine for college project - in production use Redis or DB)
const resetTokens = {};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "No account found with this email" });

    const token = crypto.randomBytes(32).toString("hex");
    resetTokens[token] = { userId: user._id, expiry: Date.now() + 3600000 }; // 1 hour

    const resetLink = `${process.env.SITE_URL || "https://localkart-n25o.onrender.com"}/reset-password.html?token=${token}`;

    await transporter.sendMail({
      from: `"Local Kart" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset - Local Kart",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:20px;border:1px solid #eee;border-radius:8px;">
          <h2 style="color:#1f7a4d;">Local Kart - Password Reset</h2>
          <p>Hi <strong>${user.name}</strong>,</p>
          <p>You requested a password reset. Click the button below to set a new password:</p>
          <a href="${resetLink}" style="display:inline-block;background:#1f7a4d;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0;">Reset Password</a>
          <p style="color:#888;font-size:13px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      `
    });

    res.json({ message: "Password reset email sent. Check your inbox." });
  } catch (error) {
    res.status(500).json({ message: "Failed to send email: " + error.message });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "Token and password are required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    const record = resetTokens[token];
    if (!record) return res.status(400).json({ message: "Invalid or expired reset link" });
    if (Date.now() > record.expiry) {
      delete resetTokens[token];
      return res.status(400).json({ message: "Reset link has expired. Please request a new one." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(record.userId, { password: hashedPassword });
    delete resetTokens[token];

    res.json({ message: "Password updated successfully. You can now login." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
