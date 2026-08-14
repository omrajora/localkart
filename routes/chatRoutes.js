const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const router = express.Router();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// POST /api/chat - customer sends message, Gemini responds
router.post("/", async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({
        message: "Message is required",
      });
    }

    const systemPrompt = `
You are a helpful customer support assistant for "Local Kart" - a hyperlocal marketplace that connects customers with nearby local shops.

About Local Kart:
- Customers can browse nearby shops and products on a live map
- Categories: Fresh, Medicine, Bakery, Dairy, Stationery, Electronics
- Delivery fee: Rs. 35 (free above Rs. 300)
- 5% tax on all orders
- Payment methods: UPI, Cash on Delivery, Debit Card
- Order statuses: Placed → Confirmed → Packed → Out for Delivery → Delivered
- Customers can cancel orders only when status is "Placed"
- Customers can review products after delivery

Current context:
${context || "Customer is browsing the app"}

Rules:
- Keep responses short and helpful (2-3 sentences max)
- If asked about specific order details you don't have, ask them to check the Tracking page
- Always be friendly and professional
- Respond in the same language the customer uses (Hindi or English)
- Don't make up shop names or product prices
`;

    const interaction = await ai.interactions.create({
      model: "gemini-3.5-flash",
      input: `${systemPrompt}

Customer: ${message}`,
      generation_config: {
        thinking_level: "minimal",
      },
    });

    res.json({
      reply: interaction.output_text,
    });

  } catch (error) {
    console.error("Gemini error:", error.message);

    res.status(500).json({
      reply:
        "Sorry, I'm having trouble responding right now. Please try again.",
    });
  }
});

module.exports = router;