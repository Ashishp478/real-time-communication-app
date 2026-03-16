import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import callRoutes from "./routes/call.route.js";

import { app, server } from "./lib/socket.js";

dotenv.config();
const PORT = process.env.PORT || 3001;
const __dirname = path.resolve();

// allow large images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(cookieParser());

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://real-time-communication-app-theta.vercel.app",
    ],
    methods: ["GET","POST","PUT","DELETE","OPTIONS"],
    credentials: true,
  })
);

// routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/calls", callRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("/", (req, res) => {
    res.send("Backend is running");
  });
}

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on PORT:", PORT);
  connectDB();
});