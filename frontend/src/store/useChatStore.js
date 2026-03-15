import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { useCallStore } from "./useCallStore";   // ✅ VC

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,

  // ✅ FIXED ROUTE
  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/auth/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
  set({ isMessagesLoading: true });
  try {
    const res = await axiosInstance.get(`/messages/${userId}`);

    // ✅ Mark messages as seen in DB
    await axiosInstance.put(`/messages/seen/${userId}`);

    // ✅ Update local state instantly
    const updatedMessages = res.data.map((msg) =>
  String(msg.senderId) === String(userId)
    ? { ...msg, seen: true }
    : msg
);

    set({ messages: updatedMessages });

  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to load messages");
  } finally {
    set({ isMessagesLoading: false });
  }
},
  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData
      );
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response?.data?.message || "Message failed");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", (newMessage) => {
      const isMessageSentFromSelectedUser =
        newMessage.senderId === selectedUser._id;

      if (!isMessageSentFromSelectedUser) return;

      set({
        messages: [...get().messages, newMessage],
      });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
  },

  // ✅ VOICE CALL START
  startVoiceCall: () => {
    const { selectedUser } = get();
    if (!selectedUser) {
      toast.error("Select a user first");
      return;
    }

    const callStore = useCallStore.getState();
    callStore.startCall(selectedUser._id);
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));  