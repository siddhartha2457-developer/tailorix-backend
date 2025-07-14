const User = require("../models/User")
const Favorite = require("../models/Favorite")


const BASE_URL = process.env.BASE_URL || "http://localhost:5000"

// Get all tailors (public route - no auth required)
const getAllTailors = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      city,
      state,
      service,
      sortBy = "newest",
      minRating,
      maxPrice,
      hasPickupDelivery,
    } = req.query

    const skip = (page - 1) * limit

    console.log("[TAILORS] Getting all tailors with filters:", {
      page,
      limit,
      city,
      service,
      sortBy,
    })

    // Build filter
    const filter = {
      role: "tailor",
      isActive: true,
      "subscription.isActive": true,
    }

    // Location filters
    if (city) {
      filter["businessAddress.city"] = new RegExp(city, "i")
    }
    if (state) {
      filter["businessAddress.state"] = new RegExp(state, "i")
    }

    // Service filter
    if (service) {
      filter["services.name"] = new RegExp(service, "i")
    }

    // Rating filter
    if (minRating) {
      filter["rating.average"] = { $gte: Number.parseFloat(minRating) }
    }

    // Pickup delivery filter
    if (hasPickupDelivery === "true") {
      filter.pickupDelivery = true
    }

    // Price filter (check services array)
    if (maxPrice) {
      filter["services.price"] = { $lte: Number.parseInt(maxPrice) }
    }

    // Build sort
    let sort = {}
    switch (sortBy) {
      case "rating":
        sort = { "rating.average": -1, "rating.count": -1 }
        break
      case "experience":
        sort = { experience: -1 }
        break
      case "orders":
        sort = { totalOrders: -1 }
        break
      case "price_low":
        sort = { "services.price": 1 }
        break
      case "price_high":
        sort = { "services.price": -1 }
        break
      case "newest":
      default:
        sort = { createdAt: -1 }
    }

    // Add subscription priority to sort (Gold > Silver > Basic)
    const aggregationPipeline = [
      { $match: filter },
      {
        $addFields: {
          subscriptionPriority: {
            $switch: {
              branches: [
                { case: { $eq: ["$subscription.planName", "Gold"] }, then: 1 },
                { case: { $eq: ["$subscription.planName", "Silver"] }, then: 2 },
                { case: { $eq: ["$subscription.planName", "Basic"] }, then: 3 },
              ],
              default: 4,
            },
          },
        },
      },
      {
        $sort: {
          subscriptionPriority: 1, // Higher priority first
          ...sort,
        },
      },
      {
        $project: {
          password: 0,
          // documents: 0,
          verificationOTP: 0,
          verificationOTPExpires: 0,
          resetPasswordToken: 0,
          resetPasswordExpires: 0,
          subscriptionPriority: 0,
        },
      },
      { $skip: skip },
      { $limit: Number.parseInt(limit) },
    ]

    
    const [tailors, total] = await Promise.all([User.aggregate(aggregationPipeline), User.countDocuments(filter)])
    
    console.log("[TAILORS] Found tailors:", tailors.length)
    const tailorsWithDocumentUrls = tailors.map((tailor) => {
  const doc = tailor.documents || {}

    return {
    ...tailor,
    documents: {
      aadhaarFront: doc.aadhaarFront ? `${BASE_URL}/${doc.aadhaarFront.replace(/\\/g, "/")}` : null,
      aadhaarBack: doc.aadhaarBack ? `${BASE_URL}/${doc.aadhaarBack.replace(/\\/g, "/")}` : null,
      businessLicense: doc.businessLicense ? `${BASE_URL}/${doc.businessLicense.replace(/\\/g, "/")}` : null,
    },
  }
})

    res.json({
      success: true,
      data: {
       tailors: tailorsWithDocumentUrls,
        pagination: {
          current: Number.parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
        filters: {
          city,
          state,
          service,
          sortBy,
          minRating,
          maxPrice,
          hasPickupDelivery,
        },
      },
    })
  } catch (error) {
    console.error("[TAILORS] Get all error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch tailors",
      error: error.message,
    })
  }
}

// Get newly joined tailors (last 30 days)
const getNewlyJoinedTailors = async (req, res) => {
  try {
    const { page = 1, limit = 12, days = 30 } = req.query
    const skip = (page - 1) * limit

    // Calculate date threshold
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - Number.parseInt(days))

    console.log("[TAILORS] Getting newly joined tailors since:", dateThreshold)

    const filter = {
      role: "tailor",
      isActive: true,
      createdAt: { $gte: dateThreshold },
    }

    const [tailors, total] = await Promise.all([
      User.find(filter)
        .select("-password -documents -verificationOTP -resetPasswordToken")
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(Number.parseInt(limit)),
      User.countDocuments(filter),
    ])

    console.log("[TAILORS] Found new tailors:", tailors.length)

    res.json({
      success: true,
      data: {
        tailors,
        pagination: {
          current: Number.parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
        dateThreshold,
        daysFilter: Number.parseInt(days),
      },
    })
  } catch (error) {
    console.error("[TAILORS] Get new tailors error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch newly joined tailors",
      error: error.message,
    })
  }
}

// Get tailors with favorite status (requires auth)
const getTailorsWithFavorites = async (req, res) => {
  try {
    const userId = req.user._id
    const { page = 1, limit = 12, city, service, sortBy = "newest", showFavoritesOnly = false } = req.query

    const skip = (page - 1) * limit

    console.log("[TAILORS] Getting tailors with favorites for user:", userId)

    let pipeline = []

    if (showFavoritesOnly === "true") {
      // Show only favorite tailors
      pipeline = [
        { $match: { userId: userId } },
        {
          $lookup: {
            from: "users",
            localField: "tailorId",
            foreignField: "_id",
            as: "tailor",
          },
        },
        { $unwind: "$tailor" },
        {
          $match: {
            "tailor.role": "tailor",
            "tailor.isActive": true,
          },
        },
      ]

      // Add filters
      if (city) {
        pipeline.push({
          $match: { "tailor.businessAddress.city": new RegExp(city, "i") },
        })
      }

      if (service) {
        pipeline.push({
          $match: { "tailor.services.name": new RegExp(service, "i") },
        })
      }

      // Add sorting
      let sortStage = {}
      switch (sortBy) {
        case "rating":
          sortStage = { "tailor.rating.average": -1 }
          break
        case "experience":
          sortStage = { "tailor.experience": -1 }
          break
        default:
          sortStage = { createdAt: -1 }
      }

      pipeline.push(
        { $sort: sortStage },
        { $skip: skip },
        { $limit: Number.parseInt(limit) },
        {
          $project: {
            _id: 1,
            addedAt: 1,
            tailor: {
              $mergeObjects: [
                "$tailor",
                {
                  isFavorite: true,
                  password: "$$REMOVE",
                  documents: "$$REMOVE",
                },
              ],
            },
          },
        },
      )

      const favorites = await Favorite.aggregate(pipeline)
      const total = await Favorite.countDocuments({ userId })

      return res.json({
        success: true,
        data: {
          tailors: favorites.map((fav) => fav.tailor),
          pagination: {
            current: Number.parseInt(page),
            pages: Math.ceil(total / limit),
            total,
          },
          showFavoritesOnly: true,
        },
      })
    } else {
      // Show all tailors with favorite status
      const filter = {
        role: "tailor",
        isActive: true,
        "subscription.isActive": true,
      }

      if (city) {
        filter["businessAddress.city"] = new RegExp(city, "i")
      }

      if (service) {
        filter["services.name"] = new RegExp(service, "i")
      }

      let sort = {}
      switch (sortBy) {
        case "rating":
          sort = { "rating.average": -1, "rating.count": -1 }
          break
        case "experience":
          sort = { experience: -1 }
          break
        default:
          sort = { createdAt: -1 }
      }

      const [tailors, total, userFavorites] = await Promise.all([
        User.find(filter)
          .select("-password -documents -verificationOTP -resetPasswordToken")
          .sort(sort)
          .skip(skip)
          .limit(Number.parseInt(limit)),
        User.countDocuments(filter),
        Favorite.find({ userId }).select("tailorId"),
      ])

      // Add favorite status to each tailor
      const favoriteIds = new Set(userFavorites.map((fav) => fav.tailorId.toString()))

      const tailorsWithFavorites = tailors.map((tailor) => ({
        ...tailor.toObject(),
        isFavorite: favoriteIds.has(tailor._id.toString()),
      }))

      return res.json({
        success: true,
        data: {
          tailors: tailorsWithFavorites,
          pagination: {
            current: Number.parseInt(page),
            pages: Math.ceil(total / limit),
            total,
          },
          showFavoritesOnly: false,
        },
      })
    }
  } catch (error) {
    console.error("[TAILORS] Get with favorites error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch tailors with favorite status",
      error: error.message,
    })
  }
}

// Get tailor statistics
const getTailorStats = async (req, res) => {
  try {
    const stats = await Promise.all([
      User.countDocuments({ role: "tailor", isActive: true }),
      User.countDocuments({
        role: "tailor",
        isActive: true,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
      User.countDocuments({
        role: "tailor",
        isActive: true,
        "subscription.planName": "Gold",
      }),
      User.countDocuments({
        role: "tailor",
        isActive: true,
        "subscription.planName": "Silver",
      }),
      User.countDocuments({
        role: "tailor",
        isActive: true,
        "subscription.planName": "Basic",
      }),
    ])

    const [totalTailors, newTailors, goldTailors, silverTailors, basicTailors] = stats

    // Get city distribution
    const cityStats = await User.aggregate([
      {
        $match: {
          role: "tailor",
          isActive: true,
          "businessAddress.city": { $exists: true, $ne: "" },
        },
      },
      {
        $group: {
          _id: "$businessAddress.city",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ])

    res.json({
      success: true,
      data: {
        totalTailors,
        newTailors,
        subscriptionBreakdown: {
          gold: goldTailors,
          silver: silverTailors,
          basic: basicTailors,
        },
        topCities: cityStats,
      },
    })
  } catch (error) {
    console.error("[TAILORS] Get stats error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch tailor statistics",
      error: error.message,
    })
  }
}

module.exports = {
  getAllTailors,
  getNewlyJoinedTailors,
  getTailorsWithFavorites,
  getTailorStats,
}
