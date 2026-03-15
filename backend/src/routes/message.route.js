import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getMessages,
  sendMessage,
  getUsersForSidebar
} from "../controllers/message.controller.js";
import Message from "../models/message.model.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, sendMessage);
router.put("/seen/:id", protectRoute, async (req, res) => {
  try {
    await Message.updateMany(
      {
        senderId: req.params.id,
        receiverId: req.user._id,
        seen: false,
      },
      { seen: true }
    );

    res.json({ message: "Messages marked as seen" });
  } catch (error) {
    res.status(500).json({ message: "Error updating seen status" });
  }
});

export default router;
