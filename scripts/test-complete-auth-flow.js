const mongoose = require("mongoose")
const User = require("../models/User")
const jwt = require("jsonwebtoken")
const fetch = require("node-fetch") // You might need to install this: npm install node-fetch
require("dotenv").config()

async function testCompleteAuthFlow() {
  try {
    console.log("🧪 Testing Complete Authentication Flow")
    console.log("======================================")

    // Connect to database
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI
    await mongoose.connect(mongoUri)
    console.log("✅ Database connected")

    // Find a tailor user
    const tailor = await User.findOne({ role: "tailor", isActive: true })

    if (!tailor) {
      console.log("❌ No active tailor found")
      return
    }

    console.log("👤 Testing with user:")
    console.log("Email:", tailor.email)
    console.log("Role:", tailor.role)
    console.log("Active:", tailor.isActive)
    console.log("Verified:", tailor.isVerified)

    // Generate token
    const token = jwt.sign({ userId: tailor._id }, process.env.JWT_SECRET, { expiresIn: "7d" })
    console.log("\n🎫 Generated token:", token.substring(0, 50) + "...")

    // Test token verification
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      console.log("✅ Token verification successful")
      console.log("User ID:", decoded.userId)
    } catch (error) {
      console.log("❌ Token verification failed:", error.message)
      return
    }

    // Test API endpoints (if server is running)
    console.log("\n🌐 Testing API Endpoints:")

    const baseURL = "http://localhost:5000"
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }

    // Test public endpoint (no auth)
    try {
      console.log("1. Testing public endpoint...")
      const publicResponse = await fetch(`${baseURL}/api/public/subscription-plans`)
      const publicData = await publicResponse.json()
      console.log("✅ Public endpoint:", publicResponse.status, publicData.success ? "Success" : "Failed")
    } catch (error) {
      console.log("❌ Public endpoint failed:", error.message)
    }

    // Test protected endpoint
    try {
      console.log("2. Testing protected endpoint...")
      const profileResponse = await fetch(`${baseURL}/api/tailor/profile`, { headers })
      const profileData = await profileResponse.json()
      console.log("✅ Protected endpoint:", profileResponse.status, profileData.success ? "Success" : "Failed")

      if (!profileData.success) {
        console.log("Error message:", profileData.message)
      }
    } catch (error) {
      console.log("❌ Protected endpoint failed:", error.message)
      console.log("💡 Make sure your server is running on port 5000")
    }

    console.log("\n📋 Manual Testing:")
    console.log("Copy this token for Postman:")
    console.log(`Bearer ${token}`)
    console.log("\nTest URLs:")
    console.log("GET http://localhost:5000/api/public/subscription-plans (no auth)")
    console.log("GET http://localhost:5000/api/tailor/profile (with auth)")
    console.log("GET http://localhost:5000/api/tailor/subscription/plans (with auth)")
  } catch (error) {
    console.error("❌ Test failed:", error.message)
  } finally {
    await mongoose.disconnect()
    console.log("🔌 Disconnected from MongoDB")
  }
}

testCompleteAuthFlow()
