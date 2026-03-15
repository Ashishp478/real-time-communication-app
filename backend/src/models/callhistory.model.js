import mongoose from "mongoose";

const callHistorySchema = new mongoose.Schema({
  caller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: ["audio", "video"],
    required: true
  },
  status: {
    type: String,
    enum: ["missed", "answered", "ended"],
    default: "missed"
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  },
  duration: {
    type: Number,   // seconds
    default: 0
  }
}, { timestamps: true });

export default mongoose.model("CallHistory", callHistorySchema);
