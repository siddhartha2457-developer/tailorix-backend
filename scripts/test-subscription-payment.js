const mongoose = require("mongoose")
const User = require("../models/User")
const SubscriptionPlan = require("../models/SubscriptionPlan")
const Payment = require("../models/Payment")
require("dotenv").config()

async function testSubscriptionPayment() {
  try {
    await mongoose.connect("mongodb+srv://tailorixin:cKpSHuEqIS2fzcM1@tailorix0.qr3ej9i.mongodb.net/tailorix?retryWrites=true&w=majority&appName=tailorix0")
    console.log("✅ Connected to MongoDB")

    // Find or create a test tailor
    let testTailor = await User.findOne({ role: "tailor", email: "test.tailor@example.com" })

    if (!testTailor) {
      console.log("🆕 Creating test tailor...")
      testTailor = new User({
        firstName: "Test",
        lastName: "Tailor",
        email: "test.tailor@example.com",
        password: "password123",
        phone: "+919876543210",
        role: "tailor",
        isVerified: true,
        businessName: "Test Tailoring Services",
        businessAddress: {
          street: "123 Test Street",
          city: "Test City",
          state: "Test State",
          pincode: "123456",
        },
      })
      await testTailor.save()
      console.log("✅ Test tailor created")
    }

    // Get subscription plans
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ displayOrder: 1 })
    console.log(`\n📋 Available subscription plans (${plans.length}):`)

    plans.forEach((plan, index) => {
      console.log(`   ${index + 1}. ${plan.displayName} - ₹${plan.price}${plan.price === 0 ? " (FREE)" : "/month"}`)
      console.log(`      ID: ${plan._id}`)
      console.log(`      Features: ${plan.features.listingLimit} listings, ${plan.features.visibility} visibility`)
    })

    // Test free plan activation
    const freePlan = plans.find((p) => p.price === 0)
    if (freePlan) {
      console.log(`\n🆓 Testing free plan activation: ${freePlan.displayName}`)
      console.log("API Call:")
      console.log(`POST /api/payment/subscription/activate-free`)
      console.log(`Body: { "planId": "${freePlan._id}" }`)
      console.log(`Headers: { "Authorization": "Bearer <tailor_jwt_token>" }`)
    }

    // Test paid plan payment creation
    const paidPlan = plans.find((p) => p.price > 0)
    if (paidPlan) {
      console.log(`\n💳 Testing paid plan payment: ${paidPlan.displayName}`)
      console.log("API Call:")
      console.log(`POST /api/payment/subscription/create-order`)
      console.log(`Body: { "planId": "${paidPlan._id}" }`)
      console.log(`Headers: { "Authorization": "Bearer <tailor_jwt_token>" }`)
    }

    // Show current subscription status
    console.log(`\n👤 Test tailor current subscription:`)
    console.log(`   Plan: ${testTailor.subscription.planName}`)
    console.log(`   Active: ${testTailor.subscription.isActive}`)
    console.log(`   Start: ${testTailor.subscription.startDate || "Not set"}`)
    console.log(`   End: ${testTailor.subscription.endDate || "Not set"}`)

    // Show recent payments
    const recentPayments = await Payment.find({
      userId: testTailor._id,
      purpose: "subscription",
    })
      .sort({ createdAt: -1 })
      .limit(5)

    console.log(`\n💰 Recent subscription payments (${recentPayments.length}):`)
    recentPayments.forEach((payment, index) => {
      console.log(`   ${index + 1}. ${payment.orderId} - ₹${payment.amount} - ${payment.status}`)
    })

    console.log("\n🧪 Frontend test URLs:")
    console.log(`http://localhost:5173/subscription - Subscription plans page`)
    console.log(`http://localhost:5173/tailor/subscription - Tailor subscription management`)

    console.log("\n🔑 Test tailor credentials:")
    console.log(`Email: ${testTailor.email}`)
    console.log(`Password: password123`)
    console.log(`Role: ${testTailor.role}`)
  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await mongoose.disconnect()
    console.log("🔌 Disconnected from MongoDB")
  }
}

testSubscriptionPayment()
