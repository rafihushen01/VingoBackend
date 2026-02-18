/* =========================================================
   🚀 VINGO GOD-TIER PRODUCTION SERVER (RAILWAY REALTIME CORE)
   ========================================================= */

const express = require("express")
const dotenv = require("dotenv")
const cors = require("cors")
const cookieParser = require("cookie-parser")
const http = require("http")
const compression = require("compression")
const mongoose = require("mongoose")
const { Server } = require("socket.io")

dotenv.config()

/* ===================== HARD ENV CHECK ===================== */
if (!process.env.MONGO_URL) {
  console.error("❌ FATAL: MONGO_URL missing in Railway ENV")
  process.exit(1)
}

/* ===================== EXPRESS ===================== */
const app = express()
app.set("trust proxy", 1)

/* ===================== HTTP SERVER ===================== */
const server = http.createServer(app)

/* ===================== ROUTES ===================== */
const userrouter = require("../src/route/AuthRoute.js")
const shoprouter = require("../src/route/ShopRoute.js")
const itemrouter = require("../src/route/ItemRoute.js")
const orderrouter = require("../src/route/OrderRoute.js")

/* ===================== SOCKET.IO (ULTRA REALTIME) ===================== */
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL,
      process.env.SECOND_FRONTEND_URL,
      process.env.THIRD_FRONTEND_URL
    ],
    credentials: true
  },
  transports: ["websocket", "polling"],
  pingTimeout: 25000,
  pingInterval: 20000,
  upgradeTimeout: 30000,
  allowEIO3: true
})

/* ===================== SOCKET ENGINE ===================== */
io.on("connection", (socket) => {
  console.log("🟢 Socket Connected:", socket.id)

  socket.on("join_room", (roomid) => socket.join(roomid))
  socket.on("leave_room", (roomid) => socket.leave(roomid))

  socket.on("new_order", (data) => {
    io.to(data.shopid).emit("order_received", data)
  })

  socket.on("order_status_update", (data) => {
    io.to(data.userid).emit("order_status_changed", data)
  })

  socket.on("disconnect", (reason) => {
    console.log("🔴 Socket Disconnected:", reason)
  })
})

/* ===================== GLOBAL PERFORMANCE ===================== */
app.use(compression())
app.use(express.json({ limit: "20mb" }))
app.use(cookieParser())

/* ===================== CORS SAFE ===================== */
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.SECOND_FRONTEND_URL,
  process.env.THIRD_FRONTEND_URL
]

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    return cb(null, false)
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"]
}))

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
  }, 15000)

  res.on("finish", () => clearTimeout(timer))
  next()
})

/* ===================== MONGODB GOD CONNECTION ===================== */
let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

async function connectDB() {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGO_URL, {
      maxPoolSize: 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 60000,
      family: 4,
      autoIndex: false
    }).then((mongoose) => {
      console.log("✅ MongoDB Connected")
      return mongoose
    }).catch((err) => {
      console.error("❌ MongoDB Crash:", err.message)
      process.exit(1)
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}

/* ===================== DB AUTO RECOVERY ===================== */
mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB Disconnected — Reconnecting...")
})

mongoose.connection.on("reconnected", () => {
  console.log("♻️ MongoDB Reconnected")
})

mongoose.connection.on("error", (err) => {
  console.error("🔥 MongoDB Error:", err.message)
})

/* ===================== HEALTH CHECK ===================== */
app.get("/", (req, res) => res.send("🚀 VINGO Backend Running"))

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    time: new Date()
  })
})

/* ===================== ROUTES ===================== */
app.use("/user", userrouter)
app.use("/shop", shoprouter)
app.use("/item", itemrouter)
app.use("/order", orderrouter)

/* ===================== GLOBAL ERROR SHIELD ===================== */
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.stack || err)
  if (!res.headersSent) {
    res.status(500).json({ message: "Internal Server Error" })
  }
})

/* ===================== KEEP ALIVE ===================== */
server.keepAliveTimeout = 65000
server.headersTimeout = 66000

/* ===================== START SERVER AFTER DB ===================== */
const PORT = process.env.PORT || 8080

connectDB().then(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 VINGO ULTRA SERVER RUNNING ON ${PORT}`)
  })
})
