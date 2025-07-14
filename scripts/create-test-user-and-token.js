const mongoose = require("mongoose")
const User = require("../models/User")
const jwt = require("jsonwebtoken")
require("dotenv").config()

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  })
}

async function createTestUserAndToken() {
  try {
    console.log("🔗 Connecting to MongoDB...")

    // Try both MONGODB_URI and MONGO_URI
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI

    if (!mongoUri) {
      console.error("❌ No MongoDB URI found!")
      console.log("Please check your .env file has either MONGODB_URI or MONGO_URI")
      return
    }

    console.log("Using MongoDB URI:", mongoUri.replace(/\/\/.*@/, "//***:***@"))

    await mongoose.connect(mongoUri)
    console.log("✅ Connected to MongoDB")

    // Check if test tailor already exists
    let testTailor = await User.findOne({ email: "test.tailor@example.com" })

    if (!testTailor) {
      console.log("🆕 Creating test tailor user...")
      testTailor = new User({
        firstName: "Test",
        lastName: "Tailor",
        email: "test.tailor@example.com",
        password: "password123",
        phone: "+919876543210",
        role: "tailor",
        isVerified: true,
        isActive: true,
        businessName: "Test Tailoring Services",
        businessAddress: {
          street: "123 Test Street",
          city: "Test City",
          state: "Test State",
          pincode: "123456",
        },
        subscription: {
          planName: "Basic",
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      })

      await testTailor.save()
      console.log("✅ Test tailor created successfully")
    } else {
      console.log("✅ Test tailor already exists")
    }

    // Generate token for this real user
    const token = generateToken(testTailor._id)

    console.log("\n🔑 Test User Details:")
    console.log("User ID:", testTailor._id)
    console.log("Email:", testTailor.email)
    console.log("Role:", testTailor.role)
    console.log("Is Verified:", testTailor.isVerified)
    console.log("Is Active:", testTailor.isActive)

    console.log("\n🎫 Generated Token:")
    console.log(token)

    console.log("\n🧪 Test in Postman:")
    console.log("URL: GET http://localhost:5000/api/tailor/profile")
    console.log("Header: Authorization")
    console.log("Value: Bearer " + token)

    console.log("\n📋 Other test endpoints:")
    console.log("GET http://localhost:5000/api/public/subscription-plans (no auth)")
    console.log("GET http://localhost:5000/api/tailor/subscription/plans (with auth)")
    console.log("GET http://localhost:5000/api/tailor/dashboard (with auth)")

    // Test token verification
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      console.log("\n✅ Token verification successful")
      console.log("Decoded:", { userId: decoded.userId, exp: new Date(decoded.exp * 1000) })
    } catch (error) {
      console.error("❌ Token verification failed:", error.message)
    }
  } catch (error) {
    console.error("❌ Error:", error.message)

    if (error.message.includes("ECONNREFUSED")) {
      console.log("\n💡 MongoDB connection failed. Check:")
      console.log("1. MongoDB URI is correct")
      console.log("2. Network connectivity")
      console.log("3. MongoDB Atlas IP whitelist")
    }
  } finally {
    await mongoose.disconnect()
    console.log("🔌 Disconnected from MongoDB")
  }
}

createTestUserAndToken()
