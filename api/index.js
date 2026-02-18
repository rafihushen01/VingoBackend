/* =========================================================
   🚀 VINGO GOD-MODE ULTRA SERVER (RAILWAY + REALTIME + HTTPS)
   ========================================================= */

const express = require("express")
const cors = require("cors")
const cookieParser = require("cookie-parser")
const http = require("http")
const compression = require("compression")
const mongoose = require("mongoose")
const { Server } = require("socket.io")
const helmet = require("helmet") // Security headers
const morgan = require("morgan") // Logger
const dotenv=require("dotenv")
dotenv.config()
/* ===================== ENV VALIDATION ===================== */
const REQUIRED_ENVS = ["MONGO_URL","PORT", "FRONTEND_URL"]
REQUIRED_ENVS.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ FATAL: ${key} missing in Railway ENV`)
    process.exit(1)
  }
})

/* ===================== EXPRESS APP ===================== */
const app = express()
app.set("trust proxy", 1) // Cloud safe

/* ===================== GLOBAL MIDDLEWARE ===================== */
app.use(helmet())
app.use(compression())
app.use(express.json({ limit: "25mb" }))
app.use(express.urlencoded({ extended: true, limit: "25mb" }))
app.use(cookieParser())
app.use(morgan("tiny")) // Logs requests

/* ===================== CORS (RAILWAY SAFE) ===================== */
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  process.env.SECOND_FRONTEND_URL,
  process.env.THIRD_FRONTEND_URL
]

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
      return cb(new Error("CORS BLOCKED"))
    },
    credentials: true,
    methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"]
  })
)

/* ===================== NO CACHE ===================== */
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
  next()
})

/* ===================== REQUEST TIMEOUT GUARD ===================== */
app.use((req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ message: "Request Timeout" })
    }
  }, 20000) // 20s timeout

  res.on("finish", () => clearTimeout(timer))
  next()
})

/* ===================== MONGODB GOD CONNECTION ===================== */
let cached = global.mongoose
if (!cached) cached = global.mongoose = { conn: null, promise: null }

async function connectDB() {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URL, {
        maxPoolSize: 100,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 120000,
        family: 4,
        autoIndex: false
      })
      .then((mongoose) => {
        console.log("✅ MongoDB Connected")
        return mongoose
      })
      .catch((err) => {
        console.error("❌ MongoDB Crash:", err.message)
        process.exit(1)
      })
  }

  cached.conn = await cached.promise
  return cached.conn
}

/* ===================== DB AUTO-RECOVERY ===================== */
mongoose.connection.on("disconnected", () =>
  console.warn("⚠️ MongoDB Disconnected — Reconnecting...")
)
mongoose.connection.on("reconnected", () =>
  console.log("♻️ MongoDB Reconnected")
)
mongoose.connection.on("error", (err) =>
  console.error("🔥 MongoDB Error:", err.message)
)

/* ===================== ROUTES (TRILLION-DOLLAR) ===================== */
const userrouter = require("../src/route/AuthRoute.js")
const shoprouter = require("../src/route/ShopRoute.js")
const itemrouter = require("../src/route/ItemRoute.js")
const orderrouter = require("../src/route/OrderRoute.js")

app.use("/user", userrouter)
app.use("/shop", shoprouter)
app.use("/item", itemrouter)
app.use("/order", orderrouter)

/* ===================== SOCKET.IO (ULTRA REALTIME) ===================== */
const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  transports: ["websocket", "polling"],
  pingTimeout: 35000,
  pingInterval: 25000,
  upgradeTimeout: 45000,
  allowEIO3: true
})

io.on("connection", (socket) => {
  console.log("🟢 Socket Connected:", socket.id)

  socket.on("join_room", (roomid) => socket.join(roomid))
  socket.on("leave_room", (roomid) => socket.leave(roomid))
  socket.on("new_order", (data) => io.to(data.shopid).emit("order_received", data))
  socket.on("order_status_update", (data) =>
    io.to(data.userid).emit("order_status_changed", data)
  )
  socket.on("disconnect", (reason) => console.log("🔴 Socket Disconnected:", reason))
})

/* ===================== HEALTH CHECK ===================== */
app.get("/", (req, res) => res.status(200).send("🚀 VINGO Backend LIVE"))
app.get("/health", (req, res) =>
  res.json({
    status: "OK",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    time: new Date()
  })
)

/* ===================== GLOBAL ERROR SHIELD ===================== */
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.stack || err)
  if (!res.headersSent) res.status(500).json({ message: "Internal Server Error" })
})

/* ===================== KEEP-ALIVE ===================== */
server.keepAliveTimeout = 70000
server.headersTimeout = 71000

/* ===================== START SERVER (RAILWAY READY) ===================== */
const PORT = process.env.PORT || 8080
if (!PORT) {
  console.error("❌ FATAL: PORT missing from Railway ENV")
  process.exit(1)
}

connectDB().then(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 VINGO GOD-MODE SERVER RUNNING ON PORT ${PORT}`)
  })
})
