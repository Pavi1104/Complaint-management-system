const express = require("express");
const Complaint = require("../models/Complaint");
const Counter = require("../models/Counter");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const { sendEmail, createComplaintRegisteredHtml, createComplaintResolvedHtml, createComplaintReopenedHtml } = require("../utils/email");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Middleware to check login
const verifyToken = (req, res, next) => {
  const authHeader = req.header("Authorization");

  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1]; // remove 'Bearer'

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const verifyAdmin = (req, res, next) => {
  if (req.userRole !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};

// ================= ADD COMPLAINT =================
async function generateComplaintId() {
  const today = new Date();
  const dateKey = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const counter = await Counter.findOneAndUpdate(
    { date: dateKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const padded = String(counter.seq).padStart(4, "0");
  return `CMP-${dateKey}-${padded}`;
}

function uploadIfMultipart(req, res, next) {
  if (req.is('multipart/form-data')) {
    return upload.single('image')(req, res, next);
  }
  next();
}

router.post("/add", verifyToken, uploadIfMultipart, async (req, res) => {
  try {
    const { block, residentName, phone, title, priority, description, category } = req.body;

    const image = req.file ? req.file.filename : null;
    const complaintId = await generateComplaintId();

    const complaint = new Complaint({
      complaintId,
      block,
      residentName,
      phone,
      title,
      description,
      priority,
      category,
      image,
      createdBy: req.userId
    });

    await complaint.save();

    const user = await User.findById(req.userId);
    if (user) {
      const html = createComplaintRegisteredHtml(user, complaint);
      sendEmail({
        to: user.email,
        subject: "Complaint Registered Successfully",
        html
      }).catch(err => {
        console.error("Complaint registration email failed:", err);
      });
    }

    // 🔥 SOCKET EVENT (notify all clients)
    const io = req.app.get("io");
    io.emit("complaintUpdated");

    res.status(201).json({ message: "Complaint added successfully", complaintId: complaint.complaintId });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ================= VIEW MY COMPLAINTS =================
router.get("/my", verifyToken, async (req, res) => {
  try {
    const complaints = await Complaint.find({ createdBy: req.userId });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ================= ADMIN: VIEW ALL =================
router.get("/all", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const complaints = await Complaint.find();
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ================= ADMIN: UPDATE STATUS =================
router.put("/update/:id", verifyToken, async (req, res) => {
  try {
    const { status } = req.body;

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const previousStatus = complaint.status;
    const hasCurrentFeedback = complaint.feedback && complaint.feedback.rating;

    if (status === "Reopened" && previousStatus === "Resolved" && hasCurrentFeedback) {
      if (!Array.isArray(complaint.feedbacks)) {
        complaint.feedbacks = [];
      }
      complaint.feedbacks.push({
        rating: complaint.feedback.rating,
        comment: complaint.feedback.comment,
        submittedAt: complaint.feedback.submittedAt,
        userId: complaint.createdBy
      });
      complaint.feedback = undefined;
      complaint.status = "Pending";
    } else {
      complaint.status = status;
    }

    await complaint.save();

    const io = req.app.get("io");
    io.emit("complaintUpdated");

    if (status === "Resolved" && previousStatus !== "Resolved") {
      const complaintOwner = await User.findById(complaint.createdBy);
      if (complaintOwner) {
        const html = createComplaintResolvedHtml(complaintOwner, complaint);
        sendEmail({
          to: complaintOwner.email,
          subject: "Complaint Resolved",
          html
        }).catch(err => {
          console.error("Complaint resolved email failed:", err);
        });
      }

      io.emit("complaintResolved", {
        complaintId: complaint.complaintId,
        title: complaint.title,
        userId: complaint.createdBy ? complaint.createdBy.toString() : null,
        residentName: complaint.residentName
      });
    }

    if (status === "Reopened" && previousStatus === "Resolved" && hasCurrentFeedback) {
      const adminUser = await User.findOne({ role: "admin" });
      if (adminUser) {
        const html = createComplaintReopenedHtml(adminUser, complaint);
        sendEmail({
          to: adminUser.email,
          subject: "Complaint Reopened",
          html
        }).catch(err => {
          console.error("Complaint reopened email failed:", err);
        });
      }

      io.emit("complaintReopened", {
        complaintId: complaint.complaintId,
        title: complaint.title,
        residentName: complaint.residentName
      });
    }

    res.json({ message: "Status updated", complaint });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ================= USER: EDIT COMPLAINT =================
router.put("/edit/:id", verifyToken, async (req, res) => {
  try {
    const { block, residentName, phone, title, description, category } = req.body;

    const complaint = await Complaint.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.userId }, // only owner can edit
      { block, residentName, phone, title, description, category },
      { new: true }
    );

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found or not authorized" });
    }

    const io = req.app.get("io");
    io.emit("complaintUpdated");

    res.json({ message: "Complaint updated", complaint });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// USER: ADD FEEDBACK (only if resolved)
router.post("/feedback/:id", verifyToken, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating is required and must be between 1 and 5" });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    if (complaint.status !== "Resolved") {
      return res.status(400).json({ message: "Feedback allowed only after resolution" });
    }

    if (!Array.isArray(complaint.feedbacks)) {
      complaint.feedbacks = [];
    }

    const feedbackEntry = {
      rating,
      comment,
      submittedAt: new Date(),
      userId: req.userId
    };

    complaint.feedbacks.push(feedbackEntry);
    complaint.feedback = feedbackEntry;
    await complaint.save();

    const io = req.app.get("io");
    io.emit("complaintUpdated");
    io.emit("feedbackSubmitted", {
      complaintId: complaint.complaintId,
      title: complaint.title,
      residentName: complaint.residentName,
      rating,
      comment,
      submittedAt: feedbackEntry.submittedAt
    });

    res.json({ message: "Feedback submitted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET SINGLE COMPLAINT DETAILS
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }
    res.json(complaint);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

