const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema({
  block:String,
residentName:String,
phone:String,
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  priority:{
  type:String,
  default:"Low"
},
  status: {
    type: String,
    default: "Pending" // Pending, In Progress, Resolved
  },
  feedback: {
  rating: Number,
  comment: String,
  submittedAt: Date
},
  image: {
    type: String, // Path to the uploaded image
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

module.exports = mongoose.model("Complaint", complaintSchema);
