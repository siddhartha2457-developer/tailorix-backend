const mongoose = require("mongoose")
const SubscriptionPlan = require("../models/SubscriptionPlan")
require("dotenv").config()

const seedSubscriptionPlans = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI)
    console.log("Connected to MongoDB")

    // Clear existing plans
    await SubscriptionPlan.deleteMany({})

    // Create subscription plans
    const plans = [
      {
        name: "Basic",
        displayName: "Basic Plan",
        price: 0,
        currency: "INR",
        duration: 30, // 30 days
        features: {
          listingLimit: 2,
          visibility: "city",
          analytics: false,
          whatsappIntegration: true,
          prioritySupport: false,
          customBranding: false,
        },
        description: "Perfect for getting started",
        benefits: ["2 product listings", "City-wide visibility", "WhatsApp integration", "Community support"],
        isActive: true,
        displayOrder: 1,
        isPopular: false,
      },
      {
        name: "Advance",
        displayName: "Advance Plan",
        price: 499,
        currency: "INR",
        duration: 30, // 30 days
        features: {
          listingLimit: 10,
          visibility: "area",
          analytics: false,
          whatsappIntegration: true,
          prioritySupport: false,
          customBranding: false,
        },
        description: "Great for growing businesses",
        benefits: [
          "10 product listings",
          "Local area visibility (top 10)",
          "WhatsApp integration",
          "Community support",
        ],
        isActive: true,
        displayOrder: 2,
        isPopular: true,
      },
      {
        name: "Premium",
        displayName: "Premium Plan",
        price: 999,
        currency: "INR",
        duration: 30, // 30 days
        features: {
          listingLimit: 20,
          visibility: "top",
          analytics: true,
          whatsappIntegration: true,
          prioritySupport: true,
          customBranding: true,
        },
        description: "Best for established tailors",
        benefits: [
          "20 product listings",
          "Top visibility across platform",
          "Advanced analytics",
          "WhatsApp integration",
          "Priority support",
          "Custom branding",
        ],
        isActive: true,
        displayOrder: 3,
        isPopular: false,
      },
    ]

    await SubscriptionPlan.insertMany(plans)
    console.log("Subscription plans seeded successfully")

    process.exit(0)
  } catch (error) {
    console.error("Error seeding database:", error)
    process.exit(1)
  }
}

// Run seeding
seedSubscriptionPlans()
