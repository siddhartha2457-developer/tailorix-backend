const mongoose = require("mongoose")
const User = require("../models/User")

// Sample tailor data with location coordinates
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
      coordinates: [78.209, 25.4139], // [longitude, latitude] - Jhansi coordinates
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
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      isActive: true,
    },
    rating: {
      average: 4.5,
      count: 25,
    },
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
      coordinates: [78.21, 25.415], // Slightly different coordinates in Jhansi
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
    rating: {
      average: 4.8,
      count: 40,
    },
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
      coordinates: [78.208, 25.413], // Another location in Jhansi
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
    rating: {
      average: 4.2,
      count: 18,
    },
    totalOrders: 120,
    totalEarnings: 60000,
  },
]

async function createSampleTailors() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || "mongodb+srv://tailorixin:cKpSHuEqIS2fzcM1@tailorix0.qr3ej9i.mongodb.net/tailorix?retryWrites=true&w=majority&appName=tailorix0")

    console.log("Connected to MongoDB")

    // Clear existing sample tailors
    await User.deleteMany({ email: { $in: sampleTailors.map((t) => t.email) } })

    console.log("Cleared existing sample tailors")

    // Create new sample tailors
    const createdTailors = await User.insertMany(sampleTailors)

    console.log(`Created ${createdTailors.length} sample tailors:`)
    createdTailors.forEach((tailor) => {
      console.log(`- ${tailor.businessName} (${tailor.email}) at [${tailor.location.coordinates.join(", ")}]`)
    })

    // Verify geospatial index exists
    const indexes = await User.collection.getIndexes()
    console.log("Existing indexes:", Object.keys(indexes))

    if (!indexes.location_2dsphere) {
      console.log("Creating geospatial index...")
      await User.collection.createIndex({ location: "2dsphere" })
      console.log("Geospatial index created")
    } else {
      console.log("Geospatial index already exists")
    }

    console.log("Sample tailors created successfully!")
  } catch (error) {
    console.error("Error creating sample tailors:", error)
  } finally {
    await mongoose.disconnect()
    console.log("Disconnected from MongoDB")
  }
}

// Run the script
createSampleTailors()
