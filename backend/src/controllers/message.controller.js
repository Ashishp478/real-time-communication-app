import cloudinary from "../lib/cloudinary.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

// ✅ USERS FOR SIDEBAR
export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const users = await User.find({ _id: { $ne: loggedInUserId } })
      .select("-password");

    res.status(200).json(users);
  } catch (error) {
    console.error("Sidebar error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ GET MESSAGES
export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Fetch error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ✅ SEND MESSAGE (TEXT + IMAGE + VOICE FIXED)
export const sendMessage = async (req, res) => {
  try {
    const { text, image, audio } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl = null;
    let audioUrl = null;

    // ✅ IMAGE UPLOAD
    if (image) {
      const uploadedImage = await cloudinary.uploader.upload(image, {
        folder: "chat_images"
      });
      imageUrl = uploadedImage.secure_url;
    }

    // ✅ VOICE MESSAGE UPLOAD (CLOUDINARY FIXED ✅)
// ✅ AUDIO UPLOAD (FIXED)
if (audio) {
  const base64 = audio.split(",")[1];

  const upload = await cloudinary.uploader.upload(
    `data:audio/webm;base64,${base64}`,
    {
      folder: "chat_audio",
      resource_type: "video"
    }
  );

  audioUrl = upload.secure_url;
}


    // ✅ SAVE MESSAGE TO DB
    const message = await Message.create({
      senderId,
      receiverId,
      text: text || "",
      image: imageUrl,
      audio: audioUrl
    });

    // ✅ SEND THROUGH SOCKET.IO
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", message);
    }

    res.status(201).json(message);

  } catch (error) {
    console.error("SEND MESSAGE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};
