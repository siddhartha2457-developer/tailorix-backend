const jwt = require("jsonwebtoken")
require("dotenv").config()

// Test JWT token generation and verification
function testAuthToken() {
  console.log("🔑 Testing JWT Token System")
  console.log("JWT_SECRET exists:", !!process.env.JWT_SECRET)

  if (!process.env.JWT_SECRET) {
    console.error("❌ JWT_SECRET not found in environment variables!")
    console.log("Please add JWT_SECRET to your .env file:")
    console.log("JWT_SECRET=your_super_secret_key_here")
    return
  }

  // Test token generation
  const testUserId = "507f1f77bcf86cd799439011" // Sample MongoDB ObjectId
  const testPayload = {
    userId: testUserId,
    role: "tailor",
    email: "test@example.com",
  }

  try {
    // Generate token
    const token = jwt.sign(testPayload, process.env.JWT_SECRET, { expiresIn: "7d" })
    console.log("✅ Token generated successfully")
    console.log("Token:", token.substring(0, 50) + "...")

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log("✅ Token verified successfully")
    console.log("Decoded payload:", decoded)

    console.log("\n🧪 Test this token in Postman:")
    console.log("Header: Authorization")
    console.log("Value: Bearer " + token)

    console.log("\n📋 Test API endpoints:")
    console.log("GET http://localhost:5000/api/tailor/profile")
    console.log("GET http://localhost:5000/api/public/subscription-plans (no auth needed)")
  } catch (error) {
    console.error("❌ Token test failed:", error.message)
  }
}

testAuthToken()
