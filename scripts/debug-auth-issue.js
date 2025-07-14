const mongoose = require("mongoose")
const User = require("../models/User")
const jwt = require("jsonwebtoken")
require("dotenv").config()

async function debugAuthIssue() {
  try {
    console.log("🔍 Debugging Authentication Issue")
    console.log("================================")

    // Check environment variables
    console.log("\n📋 Environment Check:")
    console.log("JWT_SECRET exists:", !!process.env.JWT_SECRET)
    console.log("MONGODB_URI exists:", !!process.env.MONGODB_URI)
    console.log("MONGO_URI exists:", !!process.env.MONGO_URI)

    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET missing!")
      return
    }

    // Connect to database
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI
    await mongoose.connect(mongoUri)
    console.log("✅ Database connected")

    // Check if any tailors exist
    const tailorCount = await User.countDocuments({ role: "tailor" })
    console.log(`\n👥 Tailors in database: ${tailorCount}`)

    if (tailorCount === 0) {
      console.log("⚠️  No tailors found. Creating test tailor...")

      const testTailor = new User({
        firstName: "Debug",
        lastName: "Tailor",
        email: "debug.tailor@example.com",
        password: "password123",
        phone: "+919876543210",
        role: "tailor",
        isVerified: true,
        isActive: true,
        businessName: "Debug Tailoring",
      })

      await testTailor.save()
      console.log("✅ Test tailor created")
    }

    // Get a real tailor
    const tailor = await User.findOne({ role: "tailor", isActive: true })

    if (!tailor) {
      console.error("❌ No active tailors found")
      return
    }

    console.log(`\n👤 Using tailor: ${tailor.email} (${tailor._id})`)

    // Generate token
    const token = jwt.sign({ userId: tailor._id }, process.env.JWT_SECRET, { expiresIn: "7d" })
    console.log("\n🎫 Generated Token:")
    console.log(token)

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log("\n✅ Token verification successful:")
    console.log("User ID:", decoded.userId)
    console.log("Expires:", new Date(decoded.exp * 1000))

    // Test database lookup
    const foundUser = await User.findById(decoded.userId)
    console.log("\n🔍 Database lookup:")
    console.log("User found:", !!foundUser)
    if (foundUser) {
      console.log("Email:", foundUser.email)
      console.log("Role:", foundUser.role)
      console.log("Active:", foundUser.isActive)
      console.log("Verified:", foundUser.isVerified)
    }

    console.log("\n🧪 Test Commands:")
    console.log("1. Copy this token:")
    console.log(`Bearer ${token}`)
    console.log("\n2. Test these endpoints in Postman:")
    console.log("GET http://localhost:5000/api/tailor/profile")
    console.log("GET http://localhost:5000/api/public/subscription-plans")
  } catch (error) {
    console.error("❌ Debug failed:", error.message)
  } finally {
    await mongoose.disconnect()
  }
}

debugAuthIssue()
