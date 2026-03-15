// backend/test-server.js

import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("Test server is working ✅");
});

const PORT = 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TEST server running on http://localhost:${PORT}`);
});
