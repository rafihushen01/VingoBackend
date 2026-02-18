/* =========================================================
   🚀 VINGO ULTRA PRODUCTION SERVER (RAILWAY + REALTIME)
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

/* ===================== EXPRESS APP ===================== */
const app = express()
app.set("trust proxy", 1) // Railway / Cloud safe

/* ===================== HTTP SERVER ===================== */
const server = http.createServer(app)

/* ===================== ROUTES ===================== */
const userrouter = require("../src/route/AuthRoute.js")
const shoprouter = require("../src/route/ShopRoute.js")
const itemrouter = require("../src/route/ItemRoute.js")
const orderrouter = require("../src/route/OrderRoute.js")

/* ===================== SOCKET.IO ===================== */
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL,
      process.env.SECOND_FRONTEND_URL,
      process.env.THIRD_FRONTEND_URL
    ],
    credentials: true
  },
  pingTimeout: 20000,
  pingInterval: 25000,
  transports: ["websocket", "polling"]
})

/* ===================== SOCKET HANDLER ===================== */
io.on("connection", (socket) => {
  console.log("🟢 Socket Connected:", socket.id)

  socket.on("join_room", (roomid) => {
    socket.join(roomid)
  })

  socket.on("leave_room", (roomid) => {
    socket.leave(roomid)
  })

  socket.on("new_order", (data) => {
    io.to(data.shopid).emit("order_received", data)
  })

  socket.on("order_status_update", (data) => {
    io.to(data.userid).emit("order_status_changed", data)
  })

  socket.on("disconnect", () => {
    console.log("🔴 Socket Disconnected:", socket.id)
  })
})

/* ===================== GLOBAL PERFORMANCE ===================== */
app.use(compression())
app.use(express.json({ limit: "15mb" }))
app.use(cookieParser())

/* ===================== CORS (RAILWAY SAFE) ===================== */
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.SECOND_FRONTEND_URL,
  process.env.THIRD_FRONTEND_URL
]

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    return callback(null, false)
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"]
}))

/* ===================== NO CACHE (LIVE APIs) ===================== */
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
  next()
})

/* ===================== REQUEST TIMEOUT ===================== */
app.use((req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ message: "Request Timeout" })
    }
  }, 12000)

  res.on("finish", () => clearTimeout(timeout))
  next()
})

/* ===================== MONGODB (RAILWAY OPTIMIZED) ===================== */
let isConnected = false

async function connectDBOnce() {
  if (isConnected) return
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      maxPoolSize: 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 60000,
      family: 4
    })
    isConnected = true
    console.log("✅ MongoDB Connected")
  } catch (err) {
    console.error("❌ MongoDB Failed:", err.message)
    process.exit(1)
  }
}

connectDBOnce()

/* ===================== HEALTH CHECK ===================== */
app.get("/", (req, res) => {
  res.status(200).send("🚀 VINGO Backend Running")
})

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
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

/* ===================== GLOBAL ERROR HANDLER ===================== */
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err)
  if (!res.headersSent) {
    res.status(500).json({ message: "Internal Server Error" })
  }
})

/* ===================== KEEP ALIVE ===================== */
server.keepAliveTimeout = 65000
server.headersTimeout = 66000

/* ===================== START SERVER ===================== */
const PORT = process.env.PORT || 8080

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on ${PORT}`)
})
