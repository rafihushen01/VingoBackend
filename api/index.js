const express = require("express");
const http = require("http");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const helmet = require("helmet");
const morgan = require("morgan");
const dotenv = require("dotenv");

dotenv.config();

const REQUIRED_ENVS = ["MONGO_URL", "PORT", "FRONTEND_URL"];
REQUIRED_ENVS.forEach((key) => {
  if (!process.env[key]) {
    console.error(`FATAL: ${key} missing in environment`);
    process.exit(1);
  }
});

const app = express();
app.set("trust proxy", 1);

app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use(cookieParser());
app.use(morgan("tiny"));

const RAW_ORIGINS = [
  process.env.FRONTEND_URL,
  process.env.SECOND_FRONTEND_URL,
  process.env.THIRD_FRONTEND_URL,
  ...(process.env.ADDITIONAL_FRONTEND_URLS || "").split(","),
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

const sanitizeOrigin = (origin) => {
  const stripped = String(origin || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");

  if (!stripped) return "";

  try {
    const url = new URL(stripped);
    const isDefaultPort =
      (url.protocol === "https:" && url.port === "443") ||
      (url.protocol === "http:" && url.port === "80");
    const portPart = url.port && !isDefaultPort ? `:${url.port}` : "";
    return `${url.protocol}//${url.hostname}${portPart}`;
  } catch (error) {
    void error;
    return stripped.replace(/\/$/, "");
  }
};

const ALLOWED_ORIGINS = Array.from(
  new Set(RAW_ORIGINS.map((origin) => sanitizeOrigin(origin)).filter(Boolean))
);

const primaryFrontend = sanitizeOrigin(process.env.FRONTEND_URL);
let allowAnyVercelOrigin = false;
try {
  allowAnyVercelOrigin = new URL(primaryFrontend).hostname.endsWith(".vercel.app");
} catch (error) {
  void error;
}

const isOriginAllowed = (origin) => {
  if (!origin) return true;

  const cleanOrigin = sanitizeOrigin(origin);
  if (ALLOWED_ORIGINS.includes(cleanOrigin)) return true;

  if (process.env.ALLOW_VERCEL_PREVIEW === "true" || allowAnyVercelOrigin) {
    try {
      const hostname = new URL(cleanOrigin).hostname;
      if (hostname.endsWith(".vercel.app")) return true;
    } catch (error) {
      void error;
    }
  }

  return false;
};

const corsOptions = {
  origin: (origin, cb) => {
    if (isOriginAllowed(origin)) {
      return cb(null, true);
    }

    console.log("CORS rejected origin:", origin);
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Access-Token",
    "X-Auth-Token",
  ],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use((req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ message: "Request Timeout" });
    }
  }, 20000);

  res.on("finish", () => clearTimeout(timer));
  next();
});

let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URL, {
        maxPoolSize: 100,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 120000,
        family: 4,
        autoIndex: false,
      })
      .then((db) => {
        console.log("MongoDB connected");
        return db;
      })
      .catch((err) => {
        console.error("MongoDB connection failed:", err.message);
        process.exit(1);
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected, reconnecting...");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB error:", err.message);
});

app.get("/ping", (req, res) => res.send("Pong"));
app.get("/", (req, res) => res.send("VINGO Backend LIVE"));
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    time: new Date(),
    allowedOrigins: ALLOWED_ORIGINS,
  });
});

const userrouter = require("../src/route/AuthRoute.js");
const shoprouter = require("../src/route/ShopRoute.js");
const itemrouter = require("../src/route/ItemRoute.js");
const orderrouter = require("../src/route/OrderRoute.js");

app.use("/user", userrouter);
app.use("/shop", shoprouter);
app.use("/item", itemrouter);
app.use("/order", orderrouter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 35000,
  pingInterval: 25000,
  upgradeTimeout: 45000,
  allowEIO3: true,
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
  socket.on("join_room", (roomid) => socket.join(roomid));
  socket.on("leave_room", (roomid) => socket.leave(roomid));
  socket.on("new_order", (data) => io.to(data.shopid).emit("order_received", data));
  socket.on("order_status_update", (data) =>
    io.to(data.userid).emit("order_status_changed", data)
  );
  socket.on("disconnect", (reason) => console.log("Socket disconnected:", reason));
});

app.use((err, req, res, next) => {
  void next;
  console.error("Server error:", err.stack || err);
  if (!res.headersSent) res.status(500).json({ message: "Internal Server Error" });
});

server.keepAliveTimeout = 70000;
server.headersTimeout = 71000;

const PORT = process.env.PORT || 8080;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`VINGO listening on port ${PORT}`);
  console.log("Allowed CORS origins:", ALLOWED_ORIGINS);
});

connectDB().catch((err) => console.error("MongoDB async connection failed", err));
