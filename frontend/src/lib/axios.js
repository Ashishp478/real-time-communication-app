import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: "https://real-time-communication-backend.onrender.com/api",
  withCredentials: true,               // 🔥 VERY IMPORTANT
});