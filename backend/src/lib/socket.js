import { Server } from "socket.io";
import http from "http";
import express from "express";
import CallHistory from "../models/callhistory.model.js";
import User from "../models/user.model.js";

const app = express();
const server = http.createServer(app);

// userId -> socketId
const userSocketMap = new Map();

// socketId -> callId
const activeCalls = new Map();

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",  // ✅ yaha change karo
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// helper
export function getReceiverSocketId(userId) {
  return userSocketMap.get(userId?.toString());
}

io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;

  console.log("✅ User connected:", userId, socket.id);

  if (userId) {
    userSocketMap.set(userId.toString(), socket.id);
    await User.findByIdAndUpdate(userId, { lastSeen: null }).catch(console.log);
  }

  io.emit("getOnlineUsers", [...userSocketMap.keys()]);

  // ================= 📞 START CALL =================
  socket.on("callUser", async ({ to, offer, type }) => {
    if (!userId || !to) return;

    const receiverSocketId = userSocketMap.get(to.toString());
    if (!receiverSocketId) return;

    const call = await CallHistory.create({
      caller: userId,
      receiver: to,
      type,
      status: "missed",
      startedAt: new Date(),
    });

    activeCalls.set(socket.id, call._id.toString());

    io.to(receiverSocketId).emit("incomingCall", {
      from: userId.toString(),
      offer,
      type,
      callId: call._id.toString(),
    });

    console.log("📞 Call started:", call._id.toString());
  });

  // ================= ✅ ANSWER CALL =================
  socket.on("answerCall", async ({ to, answer, callId }) => {
    if (!to || !callId) return;

    const receiverSocketId = userSocketMap.get(to.toString());
    if (!receiverSocketId) return;

    await CallHistory.findByIdAndUpdate(callId, {
      status: "answered",
      startedAt: new Date(),
    });

    activeCalls.set(socket.id, callId.toString());

    io.to(receiverSocketId).emit("callAnswered", {
      answer,
      callId,
    });

    console.log("✅ Call answered:", callId);
  });

  // ================= ❄ ICE =================
  socket.on("iceCandidate", ({ to, candidate }) => {
    if (!to || !candidate) return;

    const receiverSocketId = userSocketMap.get(to.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("iceCandidate", { candidate });
    }
  });

  // ================= ❌ END CALL =================
  socket.on("endCall", async ({ to, callId }) => {
    const receiverSocketId = userSocketMap.get(to?.toString());

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("callEnded", { callId });
    }

    if (!callId) return;

    const call = await CallHistory.findById(callId);
    if (!call || !call.startedAt) return;

    const duration = Math.floor((Date.now() - new Date(call.startedAt)) / 1000);

    await CallHistory.findByIdAndUpdate(callId, {
      status: "ended",
      endedAt: new Date(),
      duration,
    });

    activeCalls.delete(socket.id);

    console.log("📴 Call ended:", callId);
  });

  // ================= ✍️ TYPING =================
  socket.on("typing", ({ to }) => {
    const receiverSocketId = userSocketMap.get(to?.toString());
    if (receiverSocketId) io.to(receiverSocketId).emit("typing", { from: userId });
  });

  socket.on("stopTyping", ({ to }) => {
    const receiverSocketId = userSocketMap.get(to?.toString());
    if (receiverSocketId) io.to(receiverSocketId).emit("stopTyping", { from: userId });
  });

  // ================= ❌ DISCONNECT =================
  socket.on("disconnect", async () => {
    console.log("❌ Disconnected:", userId);

    if (userId) {
      userSocketMap.delete(userId.toString());
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    }

    const callId = activeCalls.get(socket.id);

    if (callId) {
      const call = await CallHistory.findById(callId);
      if (call && call.startedAt) {
        const duration = Math.floor((Date.now() - new Date(call.startedAt)) / 1000);

        await CallHistory.findByIdAndUpdate(callId, {
          status: "ended",
          endedAt: new Date(),
          duration,
        });
      }

      activeCalls.delete(socket.id);
    }

    io.emit("getOnlineUsers", [...userSocketMap.keys()]);
  });
});

export { io, app, server };
