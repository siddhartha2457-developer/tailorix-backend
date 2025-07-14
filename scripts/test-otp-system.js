// Backend test script to test OTP system
const mongoose = require("mongoose")
const User = require("../models/User")
require("dotenv").config()

async function testOTPSystem() {
  try {
    await mongoose.connect("mongodb+srv://tailorixin:cKpSHuEqIS2fzcM1@tailorix0.qr3ej9i.mongodb.net/tailorix?retryWrites=true&w=majority&appName=tailorix0")
    console.log("✅ Connected to MongoDB")

    // Find a user to test OTP with
    const testUser = await User.findOne({ role: "customer" })

    if (testUser) {
      console.log("📧 Testing OTP system with user:")
      console.log("Email:", testUser.email)
      console.log("Current verification status:", testUser.isVerified)

      // Generate OTP
      const otp = testUser.generateVerificationOTP()
      await testUser.save()

      console.log("\n🔢 Generated OTP:", otp)
      console.log("OTP expires at:", testUser.verificationOTPExpires)

      // Test OTP verification
      const verificationResult = testUser.verifyOTP(otp)
      console.log("\n✅ OTP verification test:", verificationResult)

      // Test wrong OTP
      const wrongOTPResult = testUser.verifyOTP("123456")
      console.log("❌ Wrong OTP test:", wrongOTPResult)

      console.log("\n🔗 Frontend URL for testing:")
      console.log(`http://localhost:5173/verify-email/${encodeURIComponent(testUser.email)}`)

      console.log("\n🧪 API endpoints to test:")
      console.log("POST http://localhost:5000/api/auth/verify-otp")
      console.log("Body:", JSON.stringify({ email: testUser.email, otp: otp }, null, 2))
      console.log("\nPOST http://localhost:5000/api/auth/resend-otp")
      console.log("Body:", JSON.stringify({ email: testUser.email }, null, 2))
    } else {
      console.log("❌ No users found for testing")

      // Create a test user
      console.log("🆕 Creating test user...")
      const testUser = new User({
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        password: "password123",
        phone: "+919876543210",
        role: "customer",
      })

      const otp = testUser.generateVerificationOTP()
      await testUser.save()

      console.log("✅ Test user created:")
      console.log("Email:", testUser.email)
      console.log("OTP:", otp)
      console.log("Frontend URL:", `http://localhost:5173/verify-email/${encodeURIComponent(testUser.email)}`)
    }
  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await mongoose.disconnect()
  }
}

testOTPSystem()
