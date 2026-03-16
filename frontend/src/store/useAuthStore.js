import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { useCallStore } from "./useCallStore";

const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:3001"
    : "https://real-time-communication-app-iwd.onrender.com";

export const useAuthStore = create((set, get) => ({
  // ---------------- STATE ---------------- //
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  // ---------------- AUTH ---------------- //
  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
    } catch {
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created");
      get().connectSocket();
    } catch (e) {
      toast.error(e.response?.data?.message || "Signup failed");
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Login success");
      get().connectSocket();
    } catch (e) {
      toast.error(e.response?.data?.message || "Login failed");
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      get().disconnectSocket();
      toast.success("Logged out");
    } catch (e) {
      toast.error(e.response?.data?.message || "Logout failed");
    }
  },

  // ---------------- SOCKET SETUP ---------------- //
  connectSocket: () => {
    const { authUser } = get();
    if (!authUser) return;

    // prevent duplicate connection
    if (get().socket?.connected) return;

    const socket = io(BASE_URL, {
      query: { userId: authUser._id },
      withCredentials: true,
    });

    socket.connect();
    set({ socket });

    console.log("✅ SOCKET CONNECTED:", socket.id);

    // ---------------- ONLINE USERS ---------------- //
    socket.on("getOnlineUsers", (users) => {
      set({ onlineUsers: users });
    });

    // ---------------- CALL EVENTS ---------------- //
    const callStore = useCallStore.getState();

    // 📞 Incoming voice/video call
    socket.on("incomingCall", ({ from, offer, type }) => {
      console.log("📞 Incoming call:", type, "from", from);
      callStore.receiveCall(from, offer, type);
    });

    // ✅ Answer received
    socket.on("callAnswered", ({ answer }) => {
      console.log("✅ Call answered");
      callStore.handleAnswer(answer);
    });

    // ❄ ICE candidate
    socket.on("iceCandidate", ({ candidate }) => {
      callStore.addIceCandidate(candidate);
    });

    // ❌ Call ended
    socket.on("callEnded", () => {
      console.log("❌ Call ended by remote user");
      callStore.endCall();
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
    });
  },

  // ---------------- DISCONNECT ---------------- //
  disconnectSocket: () => {
    if (get().socket?.connected) get().socket.disconnect();
    set({ socket: null });
  },
}));
