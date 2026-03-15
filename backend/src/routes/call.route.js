import express from "express";
import CallHistory from "../models/callhistory.model.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * GET USER CALL HISTORY
 */
router.get("/", protectRoute, async (req, res) => {
  try {
    const calls = await CallHistory.find({
      $or: [
        { caller: req.user._id },
        { receiver: req.user._id }
      ]
    })
      .populate("caller receiver", "fullName profilePic")
      .sort({ startedAt: -1 });

    res.json(calls);
  } catch (err) {
    console.error("Call history error:", err);
    res.status(500).json({ message: "Failed to fetch call history" });
  }
});

export default router;
