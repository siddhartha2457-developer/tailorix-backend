const mongoose = require("mongoose")
const User = require("../models/User")
require("dotenv").config()

async function fixUserVerification() {
  try {
    console.log("🔧 Fixing User Verification Issues")
    console.log("==================================")

    // Connect to database
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI
    await mongoose.connect(mongoUri)
    console.log("✅ Database connected")

    // Find the specific user from debug output
    const user = await User.findOne({ email: "siddhartha421543@gmail.com" })

    if (!user) {
      console.log("❌ User not found")
      return
    }

    console.log("👤 Current user status:")
    console.log("Email:", user.email)
    console.log("Role:", user.role)
    console.log("Is Active:", user.isActive)
    console.log("Is Verified:", user.isVerified)

    // Fix verification status
    if (!user.isVerified) {
      console.log("\n🔧 Fixing verification status...")
      user.isVerified = true
      user.verificationOTP = undefined
      user.verificationOTPExpires = undefined
      await user.save()
      console.log("✅ User verification status fixed")
    }

    // Ensure user is active
    if (!user.isActive) {
      console.log("\n🔧 Activating user account...")
      user.isActive = true
      await user.save()
      console.log("✅ User account activated")
    }

    console.log("\n✅ Updated user status:")
    console.log("Is Active:", user.isActive)
    console.log("Is Verified:", user.isVerified)

    // Generate new token for testing
    const jwt = require("jsonwebtoken")
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" })

    console.log("\n🎫 New Token for Testing:")
    console.log(`Bearer ${token}`)

    console.log("\n🧪 Test in Postman:")
    console.log("URL: GET http://localhost:5000/api/tailor/profile")
    console.log("Header: Authorization")
    console.log(`Value: Bearer ${token}`)
  } catch (error) {
    console.error("❌ Error:", error.message)
  } finally {
    await mongoose.disconnect()
    console.log("🔌 Disconnected from MongoDB")
  }
}

fixUserVerification()
