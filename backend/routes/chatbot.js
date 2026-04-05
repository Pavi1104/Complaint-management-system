const express = require("express");
const jwt = require("jsonwebtoken");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const router = express.Router();

/* ================= TOKEN ================= */
function verifyToken(req, res, next) {
  const authHeader = req.header("Authorization");
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

/* ================= TEMP MEMORY ================= */
let userState = {}; // { userId: { step, data } }

/* ================= ROUTE ================= */
router.post("/complaint", verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.userId;

    if (!userState[userId]) {
      userState[userId] = { step: "idle", data: {} };
    }

    const state = userState[userId];
    const msg = message.toLowerCase();

    console.log("[Chatbot]", userId, message);

    /* ================= NORMAL CHAT ================= */

    if (state.step === "idle") {

      if (/hi|hello|hey/i.test(msg)) {
        return res.json({ result: "Hello 😊 How can I help you?" });
      }

      if (/how.*complaint|register.*complaint|help/i.test(msg)) {
        return res.json({
          result: "To register complaint, type 'complaint' or say your issue 👍"
        });
      }

      if (/thanks|thank you/i.test(msg)) {
        return res.json({ result: "You're welcome 😊" });
      }

      if (/bad|worst|not satisfied|poor|issue not fixed/i.test(msg)) {
        return res.json({
          result: "Sorry 😔 I will inform the admin about this issue."
        });
      }

      /* ================= START COMPLAINT ================= */

      if (/complaint|issue|problem/i.test(msg)) {
        state.step = "collect_block";
        return res.json({ result: "Enter your Flat / Block Number:" });
      }

      return res.json({ result: "I didn't understand. Please type 'complaint' to register issue." });
    }

    /* ================= FORM FLOW ================= */

    if (state.step === "collect_block") {
      state.data.block = message;
      state.step = "collect_name";
      return res.json({ result: "Enter your Name:" });
    }

    if (state.step === "collect_name") {
      state.data.name = message;
      state.step = "collect_phone";
      return res.json({ result: "Enter your Phone Number:" });
    }

    if (state.step === "collect_phone") {
      state.data.phone = message;
      state.step = "collect_title";
      return res.json({ result: "Enter Complaint Title:" });
    }

    if (state.step === "collect_title") {
      state.data.title = message;
      state.step = "collect_category";
      return res.json({ result: "Enter Category (Electrical / Plumbing / Cleaning / Lift / Security):" });
    }

    if (state.step === "collect_category") {
      state.data.category = message;
      state.step = "collect_description";
      return res.json({ result: "Enter Description:" });
    }

    if (state.step === "collect_description") {
      state.data.description = message;

      /* ================= CREATE COMPLAINT ================= */

      const complaintResp = await fetch("http://localhost:5000/api/complaints/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: req.headers.authorization
        },
        body: JSON.stringify({
          block: state.data.block,
          residentName: state.data.name,
          phone: state.data.phone,
          title: state.data.title,
          category: state.data.category,
          priority: "Medium",
          description: state.data.description
        })
      });

      userState[userId] = { step: "idle", data: {} };

      if (!complaintResp.ok) {
        return res.json({ result: "❌ Failed to register complaint" });
      }

      return res.json({ result: "✅ Complaint registered successfully!" });
    }

  } catch (error) {
    console.error("[Chatbot ERROR]", error);
    return res.json({ result: "Server error. Try again." });
  }
});

module.exports = router;
