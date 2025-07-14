const mongoose = require("mongoose")
const SubscriptionPlan = require("../models/SubscriptionPlan")
require("dotenv").config()

// Function to update subscription plan prices
async function updateSubscriptionPrices() {
  try {
    await mongoose.connect("mongodb+srv://tailorixin:cKpSHuEqIS2fzcM1@tailorix0.qr3ej9i.mongodb.net/tailorix?retryWrites=true&w=majority&appName=tailorix0")
    console.log("✅ Connected to MongoDB")

    // Get current plans
    const plans = await SubscriptionPlan.find({}).sort({ displayOrder: 1 })
    console.log("📋 Current subscription plans:")

    plans.forEach((plan, index) => {
      console.log(`   ${index + 1}. ${plan.displayName} - ₹${plan.price}/month`)
    })

    // Example: Update prices
    const priceUpdates = [
      { name: "Basic", newPrice: 0 }, // Keep free
      { name: "Silver", newPrice: 399 }, // Increase from 299 to 399
      { name: "Gold", newPrice: 799 }, // Increase from 599 to 799
    ]

    console.log("\n💰 Updating prices...")

    for (const update of priceUpdates) {
      const result = await SubscriptionPlan.findOneAndUpdate(
        { name: update.name },
        { price: update.newPrice },
        { new: true },
      )

      if (result) {
        console.log(`✅ Updated ${result.displayName}: ₹${result.price}${result.price === 0 ? " (FREE)" : "/month"}`)
      } else {
        console.log(`❌ Plan not found: ${update.name}`)
      }
    }

    // You can also update other features
    console.log("\n🔧 Updating features...")

    // Example: Update Silver plan features
    await SubscriptionPlan.findOneAndUpdate(
      { name: "Silver" },
      {
        "features.listingLimit": 15, // Increase from 10 to 15
        description: "Enhanced plan for growing businesses with premium features",
      },
    )
    console.log("✅ Updated Silver plan features")

    // Example: Update Gold plan features
    await SubscriptionPlan.findOneAndUpdate(
      { name: "Gold" },
      {
        "features.listingLimit": 100, // Increase from 50 to 100
        description: "Ultimate plan with unlimited features for enterprise businesses",
      },
    )
    console.log("✅ Updated Gold plan features")

    // Show updated plans
    const updatedPlans = await SubscriptionPlan.find({}).sort({ displayOrder: 1 })
    console.log("\n📋 Updated subscription plans:")

    updatedPlans.forEach((plan, index) => {
      console.log(`   ${index + 1}. ${plan.displayName}`)
      console.log(`      💰 Price: ₹${plan.price}${plan.price === 0 ? " (FREE)" : "/month"}`)
      console.log(`      📋 Listings: ${plan.features.listingLimit}`)
      console.log(`      🌍 Visibility: ${plan.features.visibility}`)
      console.log(`      📊 Analytics: ${plan.features.analytics ? "✅" : "❌"}`)
      console.log("")
    })

    console.log("🎉 Subscription prices updated successfully!")
  } catch (error) {
    console.error("❌ Error updating subscription prices:", error)
  } finally {
    await mongoose.disconnect()
    console.log("🔌 Disconnected from MongoDB")
  }
}

// Run the update
updateSubscriptionPrices()
