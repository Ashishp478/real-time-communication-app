import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: "https://real-time-communication-app-iwd.onrender.com/api",
  withCredentials: true,
});