const mongoose = require("mongoose")

const connectdb = async () => {
  try {

    if (!process.env.MONGO_URL) {
      console.error("❌ MONGO_URL is MISSING in ENV")
      process.exit(1)
    }

    await mongoose.connect(process.env.MONGO_URL, {
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 60000,
      family: 4
    })

    console.log("✅ MongoDB Connected Successfully")

  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error.message)
    process.exit(1)
  }
}

module.exports = connectdb
