/* =========================================================
   🚀 VINGO GOD MODE SERVER (RAILWAY + REALTIME + HTTPS)
   ========================================================= */

const express = require("express")
const cors = require("cors")
const cookieParser = require("cookie-parser")
const http = require("http")
const compression = require("compression")
const mongoose = require("mongoose")
const { Server } = require("socket.io")

/* ===================== ENV VALIDATION ===================== */
const requiredEnvs = ["MONGO_URL", "FRONTEND_URL"]
requiredEnvs.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ FATAL: ${key} missing in Railway ENV`)
    process.exit(1)
  }
})

/* ===================== EXPRESS APP ===================== */
const app = express()
app.set("trust proxy", 1) // Cloud safe

/* ===================== GLOBAL PERFORMANCE ===================== */
app.use(compression())
app.use(express.json({ limit: "25mb" }))
app.use(cookieParser())

/* ===================== CORS (RAILWAY SAFE) ===================== */
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.SECOND_FRONTEND_URL,
  process.env.THIRD_FRONTEND_URL
]

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
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

/* ===================== DB CONNECTION (RAILWAY + GOD MODE) ===================== */
let cached = global.mongoose
if (!cached) cached = global.mongoose = { conn: null, promise: null }

async function connectDB() {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URL, {
        maxPoolSize: 50,
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

/* ===================== ROUTES ===================== */
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
  cors: {
    origin: allowedOrigins,
    credentials: true
  },
  transports: ["websocket", "polling"],
  pingTimeout: 30000,
  pingInterval: 25000,
  upgradeTimeout: 40000,
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
server.keepAliveTimeout = 65000
server.headersTimeout = 66000

/* ===================== START SERVER (RAILWAY READY) ===================== */
const PORT = process.env.PORT
if (!PORT) {
  console.error("❌ FATAL: PORT missing from Railway ENV")
  process.exit(1)
}

connectDB().then(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 VINGO ULTRA SERVER RUNNING ON PORT ${PORT}`)
  })
})
