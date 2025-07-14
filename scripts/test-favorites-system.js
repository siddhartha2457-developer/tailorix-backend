const mongoose = require("mongoose")
const User = require("../models/User")
const Favorite = require("../models/Favorite")
require("dotenv").config()

async function testFavoritesSystem() {
  try {
    console.log("🧪 Testing Favorites System")
    console.log("===========================")

    // Connect to database
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI
    await mongoose.connect(mongoUri)
    console.log("✅ Database connected")

    // Find a customer and some tailors
    const customer = await User.findOne({ role: "customer", isActive: true })
    const tailors = await User.find({ role: "tailor", isActive: true }).limit(3)

    if (!customer) {
      console.log("❌ No customer found. Creating test customer...")
      const testCustomer = new User({
        firstName: "Test",
        lastName: "Customer",
        email: "test.customer@example.com",
        password: "password123",
        phone: "+919876543210",
        role: "customer",
        isVerified: true,
        isActive: true,
      })
      await testCustomer.save()
      console.log("✅ Test customer created")
    }

    if (tailors.length === 0) {
      console.log("❌ No tailors found. Please run the tailor seeding script first.")
      return
    }

    console.log(`\n👤 Test Customer: ${customer.email}`)
    console.log(`👥 Available Tailors: ${tailors.length}`)

    // Test adding favorites
    console.log("\n🔧 Testing Add to Favorites...")
    for (const tailor of tailors.slice(0, 2)) {
      try {
        const favorite = new Favorite({
          userId: customer._id,
          tailorId: tailor._id,
        })
        await favorite.save()
        console.log(`✅ Added ${tailor.businessName || tailor.firstName} to favorites`)
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⚠️  ${tailor.businessName || tailor.firstName} already in favorites`)
        } else {
          console.log(`❌ Error adding favorite: ${error.message}`)
        }
      }
    }

    // Test getting favorites
    console.log("\n📋 Testing Get Favorites...")
    const favorites = await Favorite.find({ userId: customer._id }).populate("tailorId", "businessName firstName")
    console.log(`✅ Found ${favorites.length} favorites:`)
    favorites.forEach((fav, index) => {
      console.log(`   ${index + 1}. ${fav.tailorId.businessName || fav.tailorId.firstName}`)
    })

    // Test API endpoints
    console.log("\n🌐 API Endpoints to Test:")
    console.log("POST /api/favorites/add")
    console.log(`Body: { "tailorId": "${tailors[0]._id}" }`)
    console.log(`Headers: { "Authorization": "Bearer <token>" }`)

    console.log("\nGET /api/favorites")
    console.log(`Headers: { "Authorization": "Bearer <token>" }`)

    console.log(`\nGET /api/favorites/check/${tailors[0]._id}`)
    console.log(`Headers: { "Authorization": "Bearer <token>" }`)

    console.log(`\nDELETE /api/favorites/remove/${tailors[0]._id}`)
    console.log(`Headers: { "Authorization": "Bearer <token>" }`)

    console.log("\nGET /api/tailors (public - no auth)")
    console.log("GET /api/tailors/new (newly joined tailors)")
    console.log("GET /api/tailors/with-favorites (with auth)")

    console.log("\n🎯 Frontend Integration:")
    console.log("1. Import FavoriteButton component")
    console.log("2. Use TailorCard component with favorite functionality")
    console.log("3. Create TailorListPage for browsing")
    console.log("4. Create FavoritesPage for saved tailors")

    console.log("\n✅ Favorites system test completed!")
  } catch (error) {
    console.error("❌ Test failed:", error.message)
  } finally {
    await mongoose.disconnect()
    console.log("🔌 Disconnected from MongoDB")
  }
}

testFavoritesSystem()
