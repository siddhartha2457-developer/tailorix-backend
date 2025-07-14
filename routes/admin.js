const express = require("express")
const User = require("../models/User")
const { authMiddleware, adminOnly } = require("../middleware/auths")

const router = express.Router()

// Admin route to update existing tailors with location data
router.post("/update-tailors-location", authMiddleware, adminOnly, async (req, res) => {
  try {
    // Sample coordinates for different cities
    const cityCoordinates = {
      Mumbai: [72.8777, 19.076],
      Delhi: [77.1025, 28.7041],
      Bangalore: [77.5946, 12.9716],
      Jhansi: [78.5685, 25.4484],
      Pune: [73.8567, 18.5204],
      Chennai: [80.2707, 13.0827],
      Kolkata: [88.3639, 22.5726],
      Hyderabad: [78.4867, 17.385],
    }

    function getRandomCoordinatesNearCity(cityCoords, radiusKm = 5) {
      const [lng, lat] = cityCoords
      const radiusDeg = radiusKm / 111.32
      const offsetLat = (Math.random() - 0.5) * 2 * radiusDeg
      const offsetLng = (Math.random() - 0.5) * 2 * radiusDeg
      return [lng + offsetLng, lat + offsetLat]
    }

    function findClosestCity(cityName) {
      if (!cityName) return cityCoordinates["Mumbai"]

      const normalizedCityName = cityName.toLowerCase().trim()

      for (const [city, coords] of Object.entries(cityCoordinates)) {
        if (city.toLowerCase().includes(normalizedCityName) || normalizedCityName.includes(city.toLowerCase())) {
          return coords
        }
      }

      return cityCoordinates["Mumbai"]
    }

    // Find tailors without location data
    const tailorsWithoutLocation = await User.find({
      role: "tailor",
      $or: [
        { location: { $exists: false } },
        { "location.coordinates": { $exists: false } },
        { "location.coordinates": [] },
        { "location.coordinates": null },
      ],
    })

    let updatedCount = 0
    const updatedTailors = []

    for (const tailor of tailorsWithoutLocation) {
      let coordinates = null

      if (tailor.businessAddress && tailor.businessAddress.city) {
        const cityCoords = findClosestCity(tailor.businessAddress.city)
        coordinates = getRandomCoordinatesNearCity(cityCoords)
      } else {
        coordinates = getRandomCoordinatesNearCity(cityCoordinates["Mumbai"])
      }

      await User.findByIdAndUpdate(tailor._id, {
        location: {
          type: "Point",
          coordinates: coordinates,
        },
      })

      updatedTailors.push({
        id: tailor._id,
        name: tailor.businessName || `${tailor.firstName} ${tailor.lastName}`,
        city: tailor.businessAddress?.city || "Unknown",
        coordinates: coordinates,
      })

      updatedCount++
    }

    // Ensure geospatial index exists
    const indexes = await User.collection.getIndexes()
    if (!indexes.location_2dsphere) {
      await User.collection.createIndex({ location: "2dsphere" })
    }

    res.json({
      success: true,
      message: `Updated ${updatedCount} tailors with location data`,
      data: {
        updatedCount,
        updatedTailors: updatedTailors.slice(0, 10), // Show first 10
        totalTailors: await User.countDocuments({ role: "tailor" }),
        tailorsWithLocation: await User.countDocuments({
          role: "tailor",
          location: { $exists: true },
          "location.coordinates": { $exists: true, $ne: [] },
        }),
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update tailors location",
      error: error.message,
    })
  }
})

// Admin route to check database stats
router.get("/db-stats", authMiddleware, adminOnly, async (req, res) => {
  try {
    const stats = {
      totalUsers: await User.countDocuments(),
      totalTailors: await User.countDocuments({ role: "tailor" }),
      activeTailors: await User.countDocuments({ role: "tailor", isActive: true }),
      tailorsWithSubscription: await User.countDocuments({
        role: "tailor",
        "subscription.isActive": true,
      }),
      tailorsWithLocation: await User.countDocuments({
        role: "tailor",
        location: { $exists: true },
        "location.coordinates": { $exists: true, $ne: [] },
      }),
    }

    // Get sample of tailors with location
    const sampleTailors = await User.find({
      role: "tailor",
      location: { $exists: true },
    })
      .select("businessName email location subscription businessAddress")
      .limit(10)

    // Test nearby query
    const testCoords = [78.209, 25.4139] // Jhansi
    const nearbyTailors = await User.countDocuments({
      role: "tailor",
      isActive: true,
      "subscription.isActive": true,
      location: {
        $geoWithin: {
          $centerSphere: [testCoords, 10 / 6378137], // 10km radius
        },
      },
    })

    res.json({
      success: true,
      data: {
        stats,
        sampleTailors,
        testQuery: {
          coordinates: testCoords,
          nearbyTailors,
          radius: "10km",
        },
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch database stats",
      error: error.message,
    })
  }
})

// Admin route to create sample tailors (for testing)
router.post("/create-sample-tailors", authMiddleware, adminOnly, async (req, res) => {
  try {
    // Sample tailor data (same as in the script)
    const sampleTailors = [
      {
        firstName: "Rajesh",
        lastName: "Kumar",
        email: "rajesh.tailor@example.com",
        password: "password123",
        phone: "+919876543210",
        role: "tailor",
        isActive: true,
        isVerified: true,
        businessName: "Kumar Tailoring Services",
        businessAddress: {
          street: "123 Main Street",
          city: "Jhansi",
          state: "Uttar Pradesh",
          pincode: "284001",
          landmark: "Near City Mall",
        },
        location: {
          type: "Point",
          coordinates: [78.209, 25.4139],
        },
        experience: 10,
        specializations: ["Men's Suits", "Traditional Wear", "Alterations"],
        services: [
          { name: "Shirt Stitching", price: 500, description: "Custom shirt stitching", category: "stitching" },
          { name: "Pant Stitching", price: 600, description: "Custom pant stitching", category: "stitching" },
          { name: "Suit Stitching", price: 2500, description: "Complete suit stitching", category: "stitching" },
        ],
        pickupDelivery: true,
        subscription: {
          planName: "Gold",
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
        rating: { average: 4.5, count: 25 },
        totalOrders: 150,
        totalEarnings: 75000,
      },
      {
        firstName: "Priya",
        lastName: "Sharma",
        email: "priya.tailor@example.com",
        password: "password123",
        phone: "+919876543211",
        role: "tailor",
        isActive: true,
        isVerified: true,
        businessName: "Priya Fashion House",
        businessAddress: {
          street: "456 Fashion Street",
          city: "Jhansi",
          state: "Uttar Pradesh",
          pincode: "284002",
          landmark: "Near Railway Station",
        },
        location: {
          type: "Point",
          coordinates: [78.21, 25.415],
        },
        experience: 8,
        specializations: ["Women's Wear", "Saree Blouses", "Lehenga"],
        services: [
          { name: "Blouse Stitching", price: 400, description: "Saree blouse stitching", category: "stitching" },
          { name: "Lehenga Stitching", price: 3000, description: "Custom lehenga stitching", category: "stitching" },
          { name: "Kurti Stitching", price: 600, description: "Designer kurti stitching", category: "stitching" },
        ],
        pickupDelivery: true,
        subscription: {
          planName: "Silver",
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
        rating: { average: 4.8, count: 40 },
        totalOrders: 200,
        totalEarnings: 95000,
      },
      {
        firstName: "Mohammed",
        lastName: "Ali",
        email: "mohammed.tailor@example.com",
        password: "password123",
        phone: "+919876543212",
        role: "tailor",
        isActive: true,
        isVerified: true,
        businessName: "Ali Master Tailors",
        businessAddress: {
          street: "789 Craft Lane",
          city: "Jhansi",
          state: "Uttar Pradesh",
          pincode: "284003",
          landmark: "Near Bus Stand",
        },
        location: {
          type: "Point",
          coordinates: [78.208, 25.413],
        },
        experience: 15,
        specializations: ["Formal Wear", "Casual Wear", "Repairs"],
        services: [
          { name: "Formal Shirt", price: 550, description: "Office formal shirts", category: "stitching" },
          { name: "Casual Shirt", price: 450, description: "Casual wear shirts", category: "stitching" },
          { name: "Trouser Hemming", price: 100, description: "Trouser length adjustment", category: "alteration" },
        ],
        pickupDelivery: false,
        subscription: {
          planName: "Basic",
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
        rating: { average: 4.2, count: 18 },
        totalOrders: 120,
        totalEarnings: 60000,
      },
    ]

    // Clear existing sample tailors
    await User.deleteMany({ email: { $in: sampleTailors.map((t) => t.email) } })

    // Create new sample tailors
    const createdTailors = await User.insertMany(sampleTailors)

    // Ensure geospatial index exists
    const indexes = await User.collection.getIndexes()
    if (!indexes.location_2dsphere) {
      await User.collection.createIndex({ location: "2dsphere" })
    }

    res.json({
      success: true,
      message: `Created ${createdTailors.length} sample tailors successfully`,
      data: {
        tailors: createdTailors.map((t) => ({
          id: t._id,
          businessName: t.businessName,
          email: t.email,
          location: t.location.coordinates,
          subscription: t.subscription.planName,
        })),
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create sample tailors",
      error: error.message,
    })
  }
})

module.exports = router
