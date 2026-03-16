import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: "https://real-time-communication-app-iiwd.onrender.com/api",
  withCredentials: true,
});