import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: "http://localhost:3001/api",  // 🔥 add /api
  withCredentials: true,               // 🔥 VERY IMPORTANT
});