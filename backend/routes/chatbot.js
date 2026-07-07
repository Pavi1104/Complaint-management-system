const express = require("express");
const jwt = require("jsonwebtoken");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
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

const CATEGORIES = ["Electrical", "Plumbing", "Cleaning", "Lift", "Security"];
const CATEGORY_ALIASES = {
  electrical: "Electrical",
  electric: "Electrical",
  power: "Electrical",
  plumbing: "Plumbing",
  pipes: "Plumbing",
  cleaning: "Cleaning",
  cleaner: "Cleaning",
  lift: "Lift",
  elevator: "Lift",
  security: "Security",
  guard: "Security"
};
const PRIORITY_ALIASES = {
  high: "High",
  urgent: "High",
  immediate: "High",
  medium: "Medium",
  normal: "Medium",
  standard: "Medium",
  low: "Low",
  minor: "Low"
};

function normalizeText(text) {
  return (text || "").trim().toLowerCase();
}

function isUnrelatedQuery(message) {
  const msg = normalizeText(message);
  const unrelated = /\b(ipls?|movies|politics|programming|code|weather|jokes?|music|sports|shopping|travel|cooking|news|games|math|mathematics|finance|stock|fashion|restaurant|celebrity)\b/i;
  const portal = /\b(complaint|issue|ticket|register|login|password|history|dashboard|feedback|status|reopen|category|priority|image|upload|portal|user|admin|details)\b/i;
  return unrelated.test(msg) && !portal.test(msg);
}

function isGreeting(message) {
  return /\b(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(message);
}

function isRegisterIntent(message) {
  return /\b(register|raise|submit|create|new|file|log)\b.*\b(complaint|issue|ticket|request|problem)\b|\b(complaint|issue|problem)\b.*\b(register|raise|submit|create|new|file|log)\b/i.test(message);
}

function isStatusIntent(message) {
  return /\b(status|track|tracking|check|progress|where is my complaint|complaint status|complaint progress|track my complaint)\b/i.test(message);
}

function isHistoryIntent(message) {
  return /\b(history|past complaints|my complaints|previous complaints|complaint history)\b/i.test(message);
}

function isReopenIntent(message) {
  return /\b(reopen|re-opening|open again|open once more|reopen complaint|reopen issue)\b/i.test(message);
}

function isFeedbackIntent(message) {
  return /\b(feedback|rate|rating|review|comment|satisfied|unsatisfied)\b/i.test(message);
}

function isLoginIntent(message) {
  return /\b(login|log in|sign in|sign-in|username|password)\b/i.test(message) && /\b(issue|problem|help|can't|cannot|forgot|unable|fail|failed)\b/i.test(message);
}

function isRegistrationHelpIntent(message) {
  return /\b(sign up|register|create account|new account|create profile|registration)\b/i.test(message);
}

function isForgotPasswordIntent(message) {
  return /\b(forgot password|reset password|forgotten password|password reset|reset my password)\b/i.test(message);
}

function isCategoryIntent(message) {
  return /\b(category|categories|type of complaint|complaint types|what kind of issue|which category)\b/i.test(message);
}

function isPriorityIntent(message) {
  return /\b(priority|urgent|high|medium|low|important|severity)\b/i.test(message);
}

function isTimelineIntent(message) {
  return /\b(timeline|progress|stages|steps|where is my complaint|status update)\b/i.test(message);
}

function isImageUploadIntent(message) {
  return /\b(image|photo|picture|upload|attach)\b/i.test(message);
}

function isIdHelpIntent(message) {
  return /\b(complaint id|ticket id|reference id|id explanation|complaint number)\b/i.test(message);
}

function isPortalHelpIntent(message) {
  return /\b(dashboard|navigate|where is|how do i|how to use|help with portal|use the portal|website)\b/i.test(message);
}

function normalizeCategory(message) {
  if (!message) return null;
  const normalized = normalizeText(message);
  if (CATEGORY_ALIASES[normalized]) return CATEGORY_ALIASES[normalized];
  const exact = CATEGORIES.find(c => normalizeText(c) === normalized);
  return exact || null;
}

function normalizePriority(message) {
  if (!message) return null;
  const normalized = normalizeText(message);
  if (PRIORITY_ALIASES[normalized]) return PRIORITY_ALIASES[normalized];
  const exact = Object.values(PRIORITY_ALIASES).find(p => normalizeText(p) === normalized);
  return exact || null;
}

function getMissingFieldPrompt(step) {
  const prompts = {
    collect_block: "Please enter your Flat / Block Number:",
    collect_name: "Please enter your Name:",
    collect_phone: "Please enter your Phone Number:",
    collect_title: "Please enter a short Complaint Title:",
    collect_category: "Please choose a Category: Electrical, Plumbing, Cleaning, Lift or Security.",
    collect_priority: "Please choose Priority: High, Medium or Low.",
    collect_description: "Please enter the Complaint Description:",
  };
  return prompts[step] || "Please provide the requested information.";
}

function validateField(step, value) {
  if (!value || !value.toString().trim()) return false;
  const trimmed = value.toString().trim();
  if (step === "collect_phone") {
    const digits = trimmed.replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  }
  if (step === "collect_priority") {
    return Boolean(normalizePriority(trimmed));
  }
  if (step === "collect_category") {
    return Boolean(normalizeCategory(trimmed));
  }
  return true;
}

function normalizeFieldValue(step, message) {
  const value = message.toString().trim();
  if (step === "collect_category") {
    return normalizeCategory(value) || value;
  }
  if (step === "collect_priority") {
    return normalizePriority(value) || value;
  }
  return value;
}

function getComplaintHelpResponse(message) {
  if (isStatusIntent(message)) {
    return "You can view the latest complaint status on the Dashboard or Complaint History page. Open a complaint record to see full status updates and timeline details.";
  }
  if (isHistoryIntent(message)) {
    return "Your Complaint History is available on the History page. It shows all submitted complaints, current status, and actions for each complaint.";
  }
  if (isReopenIntent(message)) {
    return "To reopen a resolved complaint, open it from your History or Dashboard and use the Reopen button. This will return it to the pending workflow for further action.";
  }
  if (isFeedbackIntent(message)) {
    return "After a complaint is marked resolved, you can submit feedback using the Rate or Feedback option on that complaint. Your rating helps improve service quality.";
  }
  if (isCategoryIntent(message)) {
    return "The system supports these complaint categories: Electrical, Plumbing, Cleaning, Lift and Security. Choose the category that best matches your issue.";
  }
  if (isPriorityIntent(message)) {
    return "Priority can be High, Medium, or Low. Choose High for urgent issues, Medium for normal issues, and Low for minor requests.";
  }
  if (isTimelineIntent(message)) {
    return "Complaint timeline details are visible on the complaint record. Use the Dashboard or Complaint Details page to see each stage from submission to resolution.";
  }
  if (isImageUploadIntent(message)) {
    return "You can attach an image when submitting a complaint using the image upload field on the complaint form. This helps the team understand the issue better.";
  }
  if (isIdHelpIntent(message)) {
    return "The Complaint ID is generated when your complaint is registered. It appears in the Dashboard, History, details page, and confirmation messages. Use it as your reference for follow-up.";
  }
  if (isLoginIntent(message)) {
    return "If you cannot log in, please verify your email and password. Use the Forgot Password page if you need to reset your password.";
  }
  if (isRegistrationHelpIntent(message)) {
    return "To register, use the Sign Up page and enter your details. Once registered, you can log in and submit complaints from your Dashboard.";
  }
  if (isForgotPasswordIntent(message)) {
    return "Use the Forgot Password page to reset your password. Enter your registered email and follow the instructions sent to your inbox.";
  }
  if (isPortalHelpIntent(message)) {
    return "Use the Dashboard to submit new complaints and track your open requests. Visit Complaint History to review past complaints and open details for status updates.";
  }
  return null;
}

function beginComplaintFlow(state) {
  state.step = "collect_block";
  state.data = {};
  return "Let's register your complaint. Please enter your Flat / Block Number:";
}

function handleComplaintStep(state, message) {
  const step = state.step;
  const answer = normalizeFieldValue(step, message);

  if (!validateField(step, answer)) {
    if (step === "collect_phone") {
      return "Please enter a valid Phone Number so we can contact you.";
    }
    if (step === "collect_category") {
      return "Please choose one of these categories: Electrical, Plumbing, Cleaning, Lift, or Security.";
    }
    if (step === "collect_priority") {
      return "Please choose a priority: High, Medium, or Low.";
    }
    return getMissingFieldPrompt(step);
  }

  if (step === "collect_block") {
    state.data.block = answer;
    state.step = "collect_name";
    return "Enter your Name:";
  }

  if (step === "collect_name") {
    state.data.name = answer;
    state.step = "collect_phone";
    return "Enter your Phone Number:";
  }

  if (step === "collect_phone") {
    state.data.phone = answer;
    state.step = "collect_title";
    return "Enter Complaint Title:";
  }

  if (step === "collect_title") {
    state.data.title = answer;
    state.step = "collect_category";
    return "Enter Category (Electrical / Plumbing / Cleaning / Lift / Security):";
  }

  if (step === "collect_category") {
    state.data.category = answer;
    state.step = "collect_priority";
    return "Enter Priority (High / Medium / Low):";
  }

  if (step === "collect_priority") {
    state.data.priority = answer;
    state.step = "collect_description";
    return "Enter Description:";
  }

  if (step === "collect_description") {
    state.data.description = answer;
    return null;
  }

  return "Please continue with your complaint details.";
}

async function submitComplaint(state, authHeader) {
  const complaintResp = await fetch(`http://localhost:${process.env.PORT || 5000}/api/complaints/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader
    },
    body: JSON.stringify({
      block: state.data.block,
      residentName: state.data.name,
      phone: state.data.phone,
      title: state.data.title,
      category: state.data.category,
      priority: state.data.priority || "Medium",
      description: state.data.description
    })
  });

  return complaintResp;
}

/* ================= ROUTE ================= */
router.post("/complaint", verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.userId;
    const text = message || "";

    if (!userState[userId]) {
      userState[userId] = { step: "idle", data: {} };
    }

    const state = userState[userId];
    const normalizedMessage = normalizeText(text);

    if (isUnrelatedQuery(text)) {
      return res.json({
        result: "I'm designed specifically to assist with the Complaint Management System.\nI can help with complaint registration, complaint status, complaint history, feedback, login issues, and portal-related questions.\nFor any other assistance, please contact our Customer Care.\n📞 Customer Care: +91 9876543210\n✉ Email: support@complaintportal.com"
      });
    }

    if (state.step !== "idle") {
      const helpResponse = getComplaintHelpResponse(text);
      if (helpResponse) {
        return res.json({ result: helpResponse });
      }

      const stepResponse = handleComplaintStep(state, text);
      if (stepResponse) {
        return res.json({ result: stepResponse });
      }

      const complaintResp = await submitComplaint(state, req.headers.authorization);
      const complaintData = await complaintResp.json();
      userState[userId] = { step: "idle", data: {} };

      if (!complaintResp.ok) {
        return res.json({ result: "❌ Failed to register complaint. Please try again from the complaint form." });
      }

      return res.json({ result: `✅ Complaint registered successfully! Your Complaint ID is ${complaintData.complaintId}.` });
    }

    if (isGreeting(text)) {
      return res.json({
        result: "Hello! 👋 Welcome to Complaint Portal.\nI can help you with:\n• Registering complaints\n• Tracking complaint status\n• Reopening complaints\n• Feedback\n• Using the portal\nHow may I assist you today?"
      });
    }

    if (isRegisterIntent(text)) {
      return res.json({ result: beginComplaintFlow(state) });
    }

    const portalResponse = getComplaintHelpResponse(text);
    if (portalResponse) {
      return res.json({ result: portalResponse });
    }

    return res.json({
      result: "I can help with complaint registration, tracking status, reopening complaints, feedback, login issues, and portal usage. Please ask me about the Complaint Portal or type 'complaint' to register an issue."
    });
  } catch (error) {
    console.error("[Chatbot ERROR]", error);
    return res.json({ result: "Server error. Try again." });
  }
});

module.exports = router;
