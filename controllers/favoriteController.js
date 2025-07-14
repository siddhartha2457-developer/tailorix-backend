const Favorite = require("../models/Favorite")
const User = require("../models/User")

// Add tailor to favorites
const addToFavorites = async (req, res) => {
  try {
    const { tailorId } = req.body
    const userId = req.user._id

    console.log("[FAVORITES] Adding to favorites:", { userId, tailorId })

    if (!tailorId) {
      return res.status(400).json({
        success: false,
        message: "Tailor ID is required",
      })
    }

    // Check if tailor exists and is active
    const tailor = await User.findOne({
      _id: tailorId,
      role: "tailor",
      isActive: true,
    })

    if (!tailor) {
      return res.status(404).json({
        success: false,
        message: "Tailor not found or inactive",
      })
    }

    // Check if already in favorites
    const existingFavorite = await Favorite.findOne({ userId, tailorId })

    if (existingFavorite) {
      return res.status(400).json({
        success: false,
        message: "Tailor is already in your favorites",
      })
    }

    // Add to favorites
    const favorite = new Favorite({ userId, tailorId })
    await favorite.save()

    console.log("[FAVORITES] Added successfully:", favorite._id)

    res.status(201).json({
      success: true,
      message: "Tailor added to favorites successfully",
      data: { favorite },
    })
  } catch (error) {
    console.error("[FAVORITES] Add error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to add tailor to favorites",
      error: error.message,
    })
  }
}

// Remove tailor from favorites
const removeFromFavorites = async (req, res) => {
  try {
    const { tailorId } = req.params
    const userId = req.user._id

    console.log("[FAVORITES] Removing from favorites:", { userId, tailorId })

    const favorite = await Favorite.findOneAndDelete({ userId, tailorId })

    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: "Tailor not found in your favorites",
      })
    }

    console.log("[FAVORITES] Removed successfully:", favorite._id)

    res.json({
      success: true,
      message: "Tailor removed from favorites successfully",
    })
  } catch (error) {
    console.error("[FAVORITES] Remove error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to remove tailor from favorites",
      error: error.message,
    })
  }
}

// Get user's favorite tailors
const getFavorites = async (req, res) => {
  try {
    const userId = req.user._id
    const { page = 1, limit = 10 } = req.query
    const skip = (page - 1) * limit

    console.log("[FAVORITES] Getting favorites for user:", userId)

    const [favorites, total] = await Promise.all([
      Favorite.find({ userId })
        .populate({
          path: "tailorId",
          select: "-password -documents -verificationOTP -resetPasswordToken",
          match: { isActive: true }, // Only get active tailors
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number.parseInt(limit)),
      Favorite.countDocuments({ userId }),
    ])

    // Filter out favorites where tailor was deleted or deactivated
    const validFavorites = favorites.filter((fav) => fav.tailorId !== null)

    console.log("[FAVORITES] Found favorites:", validFavorites.length)

    res.json({
      success: true,
      data: {
        favorites: validFavorites,
        pagination: {
          current: Number.parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    })
  } catch (error) {
    console.error("[FAVORITES] Get error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch favorite tailors",
      error: error.message,
    })
  }
}

// Check if tailor is in user's favorites
const checkFavoriteStatus = async (req, res) => {
  try {
    const { tailorId } = req.params
    const userId = req.user._id

    const favorite = await Favorite.findOne({ userId, tailorId })

    res.json({
      success: true,
      data: {
        isFavorite: !!favorite,
        favoriteId: favorite?._id || null,
      },
    })
  } catch (error) {
    console.error("[FAVORITES] Check status error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to check favorite status",
      error: error.message,
    })
  }
}

// Get favorite tailors with additional filters
const getFavoritesWithFilters = async (req, res) => {
  try {
    const userId = req.user._id
    const { city, service, sortBy = "recent", page = 1, limit = 10 } = req.query
    const skip = (page - 1) * limit

    // Build aggregation pipeline
    const pipeline = [
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

    // Add city filter
    if (city) {
      pipeline.push({
        $match: {
          "tailor.businessAddress.city": new RegExp(city, "i"),
        },
      })
    }

    // Add service filter
    if (service) {
      pipeline.push({
        $match: {
          "tailor.services.name": new RegExp(service, "i"),
        },
      })
    }

    // Add sorting
    let sortStage = {}
    switch (sortBy) {
      case "rating":
        sortStage = { "tailor.rating.average": -1, "tailor.rating.count": -1 }
        break
      case "experience":
        sortStage = { "tailor.experience": -1 }
        break
      case "recent":
      default:
        sortStage = { createdAt: -1 }
    }

    pipeline.push({ $sort: sortStage })

    // Add pagination
    pipeline.push({ $skip: skip }, { $limit: Number.parseInt(limit) })

    // Project fields
    pipeline.push({
      $project: {
        _id: 1,
        addedAt: 1,
        createdAt: 1,
        tailor: {
          $mergeObjects: [
            "$tailor",
            {
              password: "$$REMOVE",
              documents: "$$REMOVE",
              verificationOTP: "$$REMOVE",
              resetPasswordToken: "$$REMOVE",
            },
          ],
        },
      },
    })

    const [favorites, totalCount] = await Promise.all([
      Favorite.aggregate(pipeline),
      Favorite.countDocuments({ userId }),
    ])

    res.json({
      success: true,
      data: {
        favorites,
        pagination: {
          current: Number.parseInt(page),
          pages: Math.ceil(totalCount / limit),
          total: totalCount,
        },
        filters: { city, service, sortBy },
      },
    })
  } catch (error) {
    console.error("[FAVORITES] Get with filters error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch filtered favorites",
      error: error.message,
    })
  }
}

module.exports = {
  addToFavorites,
  removeFromFavorites,
  getFavorites,
  checkFavoriteStatus,
  getFavoritesWithFilters,
}
