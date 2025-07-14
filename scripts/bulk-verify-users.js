const mongoose = require("mongoose")
const User = require("../models/User")
require("dotenv").config()

async function bulkVerifyUsers() {
  try {
    console.log("🔧 Bulk Verifying All Users")
    console.log("===========================")

    // Connect to database
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI
    await mongoose.connect(mongoUri)
    console.log("✅ Database connected")

    // Find all unverified users
    const unverifiedUsers = await User.find({ isVerified: false })
    console.log(`📊 Found ${unverifiedUsers.length} unverified users`)

    if (unverifiedUsers.length === 0) {
      console.log("✅ All users are already verified!")
      return
    }

    // Bulk update all users to verified
    const result = await User.updateMany(
      { isVerified: false },
      {
        $set: { isVerified: true },
        $unset: { verificationOTP: 1, verificationOTPExpires: 1 },
      },
    )

    console.log(`✅ Updated ${result.modifiedCount} users to verified status`)

    // Show updated stats
    const totalUsers = await User.countDocuments()
    const verifiedUsers = await User.countDocuments({ isVerified: true })
    const activeUsers = await User.countDocuments({ isActive: true })

    console.log("\n📊 Updated Statistics:")
    console.log(`Total Users: ${totalUsers}`)
    console.log(`Verified Users: ${verifiedUsers}`)
    console.log(`Active Users: ${activeUsers}`)

    // Show some sample users
    const sampleUsers = await User.find({}).select("email role isVerified isActive").limit(5)
    console.log("\n👥 Sample Users:")
    sampleUsers.forEach((user, index) => {
      console.log(
        `   ${index + 1}. ${user.email} (${user.role}) - Verified: ${user.isVerified}, Active: ${user.isActive}`,
      )
    })
  } catch (error) {
    console.error("❌ Error:", error.message)
  } finally {
    await mongoose.disconnect()
    console.log("🔌 Disconnected from MongoDB")
  }
}

bulkVerifyUsers()
