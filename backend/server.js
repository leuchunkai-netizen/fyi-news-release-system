const path = require("path");

// Project root .env, then backend/.env (override: true so backend wins when both define the same key).
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });

const express = require("express");
const cors = require("cors");
const { createApiLimiter } = require("./utils/rateLimiter");
const articlesRouter = require("./routes/articles");
const usersRouter = require("./routes/users");

const app = express();
const PORT = process.env.PORT || 10000;

const distPath = path.join(__dirname, "..", "dist");

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

const apiLimiter = createApiLimiter();

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/articles", apiLimiter, articlesRouter);
app.use("/api/users", apiLimiter, usersRouter);

app.use(express.static(distPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
