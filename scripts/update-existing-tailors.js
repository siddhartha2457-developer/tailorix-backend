const mongoose = require("mongoose")
const User = require("../models/User")
require("dotenv").config()

// Sample coordinates for different cities in India
const cityCoordinates = {
  Mumbai: [72.8777, 19.076],
  Delhi: [77.1025, 28.7041],
  Bangalore: [77.5946, 12.9716],
  Hyderabad: [78.4867, 17.385],
  Chennai: [80.2707, 13.0827],
  Kolkata: [88.3639, 22.5726],
  Pune: [73.8567, 18.5204],
  Jaipur: [75.7873, 26.9124],
  Lucknow: [80.9462, 26.8467],
  Kanpur: [80.3319, 26.4499],
  Nagpur: [79.0882, 21.1458],
  Indore: [75.8577, 22.7196],
  Thane: [72.9781, 19.2183],
  Bhopal: [77.4126, 23.2599],
  Visakhapatnam: [83.3018, 17.6868],
  Pimpri: [73.8067, 18.6298],
  Patna: [85.1376, 25.5941],
  Vadodara: [73.1812, 22.3072],
  Ghaziabad: [77.4538, 28.6692],
  Ludhiana: [75.8573, 30.901],
  Agra: [78.0081, 27.1767],
  Nashik: [73.7898, 19.9975],
  Faridabad: [77.3178, 28.4089],
  Meerut: [77.7064, 28.9845],
  Rajkot: [70.8022, 22.3039],
  Kalyan: [73.1645, 19.2437],
  Vasai: [72.8397, 19.4911],
  Varanasi: [82.9739, 25.3176],
  Srinagar: [74.7973, 34.0837],
  Aurangabad: [75.3433, 19.8762],
  Dhanbad: [86.4304, 23.7957],
  Amritsar: [74.8723, 31.634],
  "Navi Mumbai": [73.0297, 19.033],
  Allahabad: [81.8463, 25.4358],
  Ranchi: [85.324, 23.3441],
  Howrah: [88.2636, 22.5958],
  Coimbatore: [76.9558, 11.0168],
  Jabalpur: [79.9864, 23.1815],
  Gwalior: [78.1828, 26.2124],
  Vijayawada: [80.648, 16.5062],
  Jodhpur: [73.0243, 26.2389],
  Madurai: [78.1198, 9.9252],
  Raipur: [81.6296, 21.2514],
  Kota: [75.8648, 25.2138],
  Chandigarh: [76.7794, 30.7333],
  Guwahati: [91.7362, 26.1445],
  Solapur: [75.9064, 17.6599],
  Hubli: [75.124, 15.3647],
  Bareilly: [79.4304, 28.367],
  Moradabad: [78.7733, 28.8386],
  Mysore: [76.6394, 12.2958],
  Gurgaon: [77.0266, 28.4595],
  Aligarh: [78.088, 27.8974],
  Jalandhar: [75.5762, 31.326],
  Tiruchirappalli: [78.7047, 10.7905],
  Bhubaneswar: [85.8245, 20.2961],
  Salem: [78.146, 11.6643],
  Mira: [72.87, 19.2952],
  Warangal: [79.5941, 17.9689],
  Thiruvananthapuram: [76.9366, 8.5241],
  Guntur: [80.4365, 16.3067],
  Bhiwandi: [73.0634, 19.2812],
  Saharanpur: [77.546, 29.968],
  Gorakhpur: [83.3732, 26.7606],
  Bikaner: [73.3119, 28.0229],
  Amravati: [77.75, 20.9374],
  Noida: [77.391, 28.5355],
  Jamshedpur: [86.1844, 22.8046],
  Bhilai: [81.3509, 21.1938],
  Cuttack: [85.8781, 20.4625],
  Firozabad: [78.3957, 27.1592],
  Kochi: [76.2673, 9.9312],
  Nellore: [79.9865, 14.4426],
  Bhavnagar: [72.1519, 21.7645],
  Dehradun: [78.0322, 30.3165],
  Durgapur: [87.3119, 23.4841],
  Asansol: [86.9842, 23.6739],
  Rourkela: [84.8536, 22.2604],
  Nanded: [77.2663, 19.1383],
  Kolhapur: [74.2433, 16.705],
  Ajmer: [74.6399, 26.4499],
  Akola: [77.0082, 20.7002],
  Gulbarga: [76.8343, 17.3297],
  Jamnagar: [70.0692, 22.4707],
  Ujjain: [75.7849, 23.1765],
  Loni: [77.2863, 28.7333],
  Siliguri: [88.4279, 26.7271],
  Jhansi: [78.5685, 25.4484],
  Ulhasnagar: [73.15, 19.2215],
  Jammu: [74.857, 32.7266],
  Sangli: [74.5815, 16.8524],
  Mangalore: [74.856, 12.9141],
  Erode: [77.7172, 11.341],
  Belgaum: [74.4977, 15.8497],
  Ambattur: [80.1548, 13.1143],
  Tirunelveli: [77.6933, 8.7139],
  Malegaon: [74.5815, 20.5579],
  Gaya: [85.0002, 24.7914],
  Jalgaon: [75.5626, 21.0077],
  Udaipur: [73.6833, 24.5854],
  Maheshtala: [88.2482, 22.4978],
}

// Function to get random coordinates near a city
function getRandomCoordinatesNearCity(cityCoords, radiusKm = 5) {
  const [lng, lat] = cityCoords

  // Convert radius from kilometers to degrees (rough approximation)
  const radiusDeg = radiusKm / 111.32 // 1 degree ≈ 111.32 km

  // Generate random offset
  const offsetLat = (Math.random() - 0.5) * 2 * radiusDeg
  const offsetLng = (Math.random() - 0.5) * 2 * radiusDeg

  return [lng + offsetLng, lat + offsetLat]
}

// Function to find closest city coordinates
function findClosestCity(cityName) {
  if (!cityName) return null

  const normalizedCityName = cityName.toLowerCase().trim()

  // Direct match
  for (const [city, coords] of Object.entries(cityCoordinates)) {
    if (city.toLowerCase() === normalizedCityName) {
      return coords
    }
  }

  // Partial match
  for (const [city, coords] of Object.entries(cityCoordinates)) {
    if (city.toLowerCase().includes(normalizedCityName) || normalizedCityName.includes(city.toLowerCase())) {
      return coords
    }
  }

  // Default to Mumbai if no match found
  return cityCoordinates["Mumbai"]
}

async function updateExistingTailors() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb+srv://tailorixin:cKpSHuEqIS2fzcM1@tailorix0.qr3ej9i.mongodb.net/tailorix?retryWrites=true&w=majority&appName=tailorix0")
    console.log("✅ Connected to MongoDB")

    // Find all tailors without location data
    const tailorsWithoutLocation = await User.find({
      role: "tailor",
      $or: [
        { location: { $exists: false } },
        { "location.coordinates": { $exists: false } },
        { "location.coordinates": [] },
        { "location.coordinates": null },
      ],
    })

    console.log(`📊 Found ${tailorsWithoutLocation.length} tailors without location data`)

    if (tailorsWithoutLocation.length === 0) {
      console.log("✅ All tailors already have location data!")
      return
    }

    let updatedCount = 0

    for (const tailor of tailorsWithoutLocation) {
      try {
        let coordinates = null

        // Try to get coordinates from business address city
        if (tailor.businessAddress && tailor.businessAddress.city) {
          const cityCoords = findClosestCity(tailor.businessAddress.city)
          if (cityCoords) {
            coordinates = getRandomCoordinatesNearCity(cityCoords)
          }
        }

        // Fallback: use a random city
        if (!coordinates) {
          const cities = Object.keys(cityCoordinates)
          const randomCity = cities[Math.floor(Math.random() * cities.length)]
          coordinates = getRandomCoordinatesNearCity(cityCoordinates[randomCity])
        }

        // Update tailor with location data
        await User.findByIdAndUpdate(tailor._id, {
          location: {
            type: "Point",
            coordinates: coordinates,
          },
        })

        console.log(
          `✅ Updated ${tailor.businessName || tailor.firstName} - City: ${tailor.businessAddress?.city || "Unknown"} - Coords: [${coordinates[0].toFixed(4)}, ${coordinates[1].toFixed(4)}]`,
        )
        updatedCount++
      } catch (error) {
        console.error(`❌ Failed to update tailor ${tailor._id}:`, error.message)
      }
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} tailors with location data`)

    // Ensure geospatial index exists
    console.log("🔍 Checking geospatial index...")
    const indexes = await User.collection.getIndexes()

    if (!indexes.location_2dsphere) {
      console.log("📍 Creating geospatial index...")
      await User.collection.createIndex({ location: "2dsphere" })
      console.log("✅ Geospatial index created")
    } else {
      console.log("✅ Geospatial index already exists")
    }

    // Test the nearby query
    console.log("\n🧪 Testing nearby query...")
    const testCoords = [78.209, 25.4139] // Jhansi coordinates
    const nearbyTailors = await User.find({
      role: "tailor",
      isActive: true,
      "subscription.isActive": true,
      location: {
        $geoWithin: {
          $centerSphere: [testCoords, 50 / 6378137], // 50km radius
        },
      },
    }).select("businessName location businessAddress")

    console.log(`🎯 Found ${nearbyTailors.length} tailors within 50km of test coordinates`)
    nearbyTailors.slice(0, 5).forEach((tailor, index) => {
      console.log(
        `   ${index + 1}. ${tailor.businessName || tailor.firstName} - ${tailor.businessAddress?.city || "Unknown city"}`,
      )
    })

    console.log("\n✅ Update completed successfully!")
    console.log("🚀 You can now test the API:")
    console.log("   GET http://localhost:5000/api/customer/tailors/nearby?lat=25.4139&lng=78.2090")
  } catch (error) {
    console.error("❌ Error updating tailors:", error)
  } finally {
    await mongoose.disconnect()
    console.log("🔌 Disconnected from MongoDB")
  }
}

// Run the update
updateExistingTailors()
