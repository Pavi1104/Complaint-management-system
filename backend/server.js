const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
require("dotenv").config({ path: __dirname + '/.env' });

const authRoutes = require("./routes/auth");
const complaintRoutes = require("./routes/complaint");

const app = express();

/* middleware */
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* routes */
app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
const chatbotRouter = require("./routes/chatbot");
app.use("/api/chatbot", chatbotRouter);

/* MongoDB */
const mongoUrl = process.env.MONGO_URL || "mongodb+srv://pavithralakshmisasikumar_db_user:n8oa8tpG86AuNSJa@cluster0.t3u74fa.mongodb.net/complaint_db";
mongoose.connect(mongoUrl)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

/* test route */
app.get("/", (req, res) => {
  res.send("Server is running");
});

/* 🔥 SOCKET.IO SETUP */
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
});

/* make io available in routes */
app.set("io", io);

/* start server */
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
