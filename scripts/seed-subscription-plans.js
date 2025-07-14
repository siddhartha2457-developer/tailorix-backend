const mongoose = require("mongoose")
const SubscriptionPlan = require("../models/SubscriptionPlan")
require("dotenv").config()

// Subscription plans configuration
const subscriptionPlans = [
  {
    name: "Basic",
    displayName: "Basic Plan",
    description: "Perfect for getting started with basic features",
    price: 0, // Free plan
    duration: 30, // 30 days
    features: {
      listingLimit: 2,
      visibility: "city",
      analytics: false,
      prioritySupport: false,
      customBranding: false,
      bulkOrders: false,
      advancedReports: false,
    },
    isActive: true,
    displayOrder: 1,
    popularPlan: false,
    color: "#6B7280", // Gray
  },
  {
    name: "Silver",
    displayName: "Silver Plan",
    description: "Great for growing businesses with enhanced features",
    price: 299, // ₹299 per month
    duration: 30, // 30 days
    features: {
      listingLimit: 10,
      visibility: "state",
      analytics: true,
      prioritySupport: false,
      customBranding: false,
      bulkOrders: true,
      advancedReports: false,
    },
    isActive: true,
    displayOrder: 2,
    popularPlan: true, // Most popular
    color: "#C0C0C0", // Silver
  },
  {
    name: "Gold",
    displayName: "Gold Plan",
    description: "Premium plan with all features for established businesses",
    price: 599, // ₹599 per month
    duration: 30, // 30 days
    features: {
      listingLimit: 50,
      visibility: "national",
      analytics: true,
      prioritySupport: true,
      customBranding: true,
      bulkOrders: true,
      advancedReports: true,
    },
    isActive: true,
    displayOrder: 3,
    popularPlan: false,
    color: "#FFD700", // Gold
  },
]

async function seedSubscriptionPlans() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb+srv://tailorixin:cKpSHuEqIS2fzcM1@tailorix0.qr3ej9i.mongodb.net/tailorix?retryWrites=true&w=majority&appName=tailorix0")
    console.log("✅ Connected to MongoDB")

    // Clear existing plans
    await SubscriptionPlan.deleteMany({})
    console.log("🗑️  Cleared existing subscription plans")

    // Create new plans
    const createdPlans = await SubscriptionPlan.insertMany(subscriptionPlans)
    console.log(`✅ Created ${createdPlans.length} subscription plans:`)

    createdPlans.forEach((plan, index) => {
      console.log(`   ${index + 1}. ${plan.displayName}`)
      console.log(`      💰 Price: ₹${plan.price}${plan.price === 0 ? " (FREE)" : "/month"}`)
      console.log(`      📅 Duration: ${plan.duration} days`)
      console.log(`      📋 Listings: ${plan.features.listingLimit}`)
      console.log(`      🌍 Visibility: ${plan.features.visibility}`)
      console.log(`      📊 Analytics: ${plan.features.analytics ? "✅" : "❌"}`)
      console.log(`      🎨 Color: ${plan.color}`)
      console.log("")
    })

    // Test API endpoints
    console.log("🧪 Test these API endpoints:")
    console.log("GET /api/tailor/subscription/plans - Get all plans")
    console.log("POST /api/payment/subscription/activate-free - Activate free plan")
    console.log("POST /api/payment/subscription/create-order - Create paid subscription order")
    console.log("POST /api/payment/subscription/verify - Verify subscription payment")

    console.log("\n🎉 Subscription plans seeded successfully!")
  } catch (error) {
    console.error("❌ Error seeding subscription plans:", error)
  } finally {
    await mongoose.disconnect()
    console.log("🔌 Disconnected from MongoDB")
  }
}

// Run the seeding
seedSubscriptionPlans()
