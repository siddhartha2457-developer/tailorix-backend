const mongoose = require("mongoose")

const connectDB = async () => {
  try {
    // Try both environment variable names
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI

    if (!mongoURI) {
      console.error("❌ MongoDB URI not found in environment variables")
      console.log("Please set either MONGODB_URI or MONGO_URI in your .env file")
      process.exit(1)
    }

    console.log("🔗 Connecting to MongoDB...")
    console.log("URI:", mongoURI.replace(/\/\/.*@/, "//***:***@")) // Hide credentials

    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
    console.log(`📊 Database: ${conn.connection.name}`)
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message)

    if (error.message.includes("ECONNREFUSED")) {
      console.log("💡 Connection refused - check if MongoDB is running")
    } else if (error.message.includes("authentication failed")) {
      console.log("💡 Authentication failed - check username/password")
    } else if (error.message.includes("ENOTFOUND")) {
      console.log("💡 Host not found - check MongoDB URI")
    }

    process.exit(1)
  }
}

module.exports = connectDB
