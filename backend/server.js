const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
require("dotenv").config({ path: __dirname + '/.env' });

const authRoutes = require("./routes/auth");
const complaintRoutes = require("./routes/complaint");
const chatbotRouter = require("./routes/chatbot");

const app = express();

/* middleware */
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* serve frontend static files */
const frontendPath = path.resolve(__dirname, "frontend");
console.log("Frontend path:", frontendPath);

app.use(express.static(frontendPath));

/* routes */
app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/chatbot", chatbotRouter);

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});


/* MongoDB */
const mongoUrl = process.env.MONGO_URL;
mongoose.connect(mongoUrl)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

/* fallback: serve frontend index for unknown routes */


/* SOCKET.IO SETUP */
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
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
