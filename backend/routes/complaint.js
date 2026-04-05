const express = require("express");
const Complaint = require("../models/Complaint");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");

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
router.post("/add", verifyToken, upload.single('image'), async (req, res) => {
  try {
    const {block, residentName, phone, title, priority, description, category } = req.body;

    const image = req.file ? req.file.filename : null;

    const complaint = new Complaint({
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

    // 🔥 SOCKET EVENT (notify all clients)
    const io = req.app.get("io");
    io.emit("complaintUpdated");

    res.status(201).json({ message: "Complaint added successfully" });
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

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }
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

    // 🔥 live update
    const io = req.app.get("io");
    io.emit("complaintUpdated");

    res.json({ message: "Complaint updated", complaint });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

    // 🔥 SOCKET EVENT (notify all clients)
    const io = req.app.get("io");
    io.emit("complaintUpdated");

    res.json({ message: "Status updated", complaint });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// USER: ADD FEEDBACK (only if resolved)
router.post("/feedback/:id", verifyToken, async (req, res) => {
  const { rating, comment } = req.body;

  const complaint = await Complaint.findById(req.params.id);

  if (!complaint) {
    return res.status(404).json({ message: "Complaint not found" });
  }

  if (complaint.status !== "Resolved") {
    return res.status(400).json({ message: "Feedback allowed only after resolution" });
  }

  complaint.feedback = {
    rating,
    comment,
    submittedAt: new Date()
  };

  await complaint.save();

  // 🔥 live update
  const io = req.app.get("io");
  io.emit("complaintUpdated");

  res.json({ message: "Feedback submitted" });
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

