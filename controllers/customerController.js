const User = require("../models/User")
const Booking = require("../models/Booking")
const { sendEmail } = require("../utils/sendEmail")

// Get all active tailors
const getTailors = async (req, res) => {
  try {
    const { page = 1, limit = 10, pincode, city, service, sortBy = "rating" } = req.query
    const skip = (page - 1) * limit

    // Build filter
    const filter = {
      role: "tailor",
      isActive: true,
      "subscription.isActive": true,
    }

    if (pincode) {
      filter["businessAddress.pincode"] = pincode
    }

    if (city) {
      filter["businessAddress.city"] = new RegExp(city, "i")
    }

    if (service) {
      filter["services.name"] = new RegExp(service, "i")
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
      default:
        sort = { createdAt: -1 }
    }

    const [tailors, total] = await Promise.all([
      User.find(filter)
        .select("-password -documents -verificationToken -resetPasswordToken")
        .sort(sort)
        .skip(skip)
        .limit(Number.parseInt(limit)),
      User.countDocuments(filter),
    ])

    res.json({
      success: true,
      data: {
        tailors,
        pagination: {
          current: Number.parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch tailors",
      error: error.message,
    })
  }
}

// Get tailor details
const getTailorDetails = async (req, res) => {
  try {
    const { tailorId } = req.params

    const tailor = await User.findOne({
      _id: tailorId,
      role: "tailor",
      isActive: true,
    }).select("-password -documents -verificationToken -resetPasswordToken")

    if (!tailor) {
      return res.status(404).json({
        success: false,
        message: "Tailor not found",
      })
    }

    // Get recent reviews
    const recentBookings = await Booking.find({
      tailorId,
      "customerRating.rating": { $exists: true },
    })
      .populate("customerId", "firstName lastName")
      .select("customerRating createdAt")
      .sort({ "customerRating.ratedAt": -1 })
      .limit(5)

    res.json({
      success: true,
      data: {
        tailor,
        reviews: recentBookings,
        hasActiveSubscription: tailor.hasActiveSubscription(),
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch tailor details",
      error: error.message,
    })
  }
}

// Create booking (generates query to admin)
const createBooking = async (req, res) => {
  try {
    const {
      tailorId,
      services,
      preferredDate,
      preferredTime,
      deliveryAddress,
      pickupRequired,
      pickupAddress,
      customerNotes,
    } = req.body

    console.log("[DEBUG] createBooking req.body:", req.body)
console.log("[DEBUG] req.user from auth middleware:", req.user)


    // Validate tailor
    const tailor = await User.findOne({
      _id: tailorId,
      role: "tailor",
      isActive: true,
      "subscription.isActive": true,
    })

    if (!tailor) {
      return res.status(404).json({
        success: false,
        message: "Tailor not found or not available for bookings",
      })
    }

    // Create booking as a query (no payment required)
    const booking = new Booking({
      customerId: req.user._id,
      tailorId,
      services,
      preferredDate: new Date(preferredDate),
      preferredTime,
      deliveryAddress,
      pickupRequired,
      pickupAddress,
      customerNotes,
      status: "pending", // This will be a query to admin
    })

    await booking.save()

    // Populate customer and tailor info
    await booking.populate([
      { path: "customerId", select: "firstName lastName email phone" },
      { path: "tailorId", select: "firstName lastName businessName email phone" },
    ])

    // Send notification emails
    try {
      // Email to customer
      await sendEmail({
        to: req.user.email,
        subject: "Booking Request Submitted - Tailorix",
        template: "bookingConfirmation",
        data: {
          customerName: req.user.firstName,
          tailorName: tailor.businessName || tailor.fullName,
          bookingId: booking._id,
          services: services.map((s) => s.name).join(", "),
          preferredDate: new Date(preferredDate).toLocaleDateString(),
          preferredTime,
        },
      })

      // Email to tailor
      await sendEmail({
        to: tailor.email,
        subject: "New Booking Request - Tailorix",
        template: "newBookingRequest",
        data: {
          tailorName: tailor.firstName,
          customerName: req.user.fullName,
          bookingId: booking._id,
          services: services.map((s) => s.name).join(", "),
          preferredDate: new Date(preferredDate).toLocaleDateString(),
          preferredTime,
          customerPhone: req.user.phone,
        },
      })
    } catch (emailError) {
      console.error("Email notification failed:", emailError)
    }

    res.status(201).json({
      success: true,
      message: "Booking request submitted successfully. The tailor will contact you soon.",
      data: { booking },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: error.message,
    })
  }
}

// Get customer bookings
const getBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query
    const skip = (page - 1) * limit

    const filter = { customerId: req.user._id }
    if (status) {
      const statuses = status.split(",").map((s) => s.trim().toLowerCase())
      filter.status = { $in: statuses }
    }

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate("tailorId", "firstName lastName businessName email phone businessAddress")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number.parseInt(limit)),
      Booking.countDocuments(filter),
    ])

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          current: Number.parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message,
    })
  }
}

// Get booking details
const getBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params

    const booking = await Booking.findOne({
      _id: bookingId,
      customerId: req.user._id,
    }).populate("tailorId", "firstName lastName businessName email phone businessAddress")

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      })
    }

    res.json({
      success: true,
      data: { booking },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking details",
      error: error.message,
    })
  }
}

// Cancel booking
const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params
    const { reason } = req.body

    const booking = await Booking.findOne({
      _id: bookingId,
      customerId: req.user._id,
      status: { $in: ["pending", "accepted"] },
    })

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or cannot be cancelled",
      })
    }

    booking.status = "cancelled"
    booking.cancellationReason = reason
    booking.cancelledBy = req.user._id
    booking.cancelledAt = new Date()

    await booking.save()

    // Send notification to tailor
    const tailor = await User.findById(booking.tailorId)
    if (tailor) {
      try {
        await sendEmail({
          to: tailor.email,
          subject: "Booking Cancelled - Tailorix",
          template: "bookingCancelled",
          data: {
            tailorName: tailor.firstName,
            customerName: req.user.fullName,
            bookingId: booking._id,
            reason: reason || "No reason provided",
          },
        })
      } catch (emailError) {
        console.error("Email notification failed:", emailError)
      }
    }

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      data: { booking },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to cancel booking",
      error: error.message,
    })
  }
}

// Rate booking
const rateBooking = async (req, res) => {
  try {
    const { bookingId } = req.params
    const { rating, review } = req.body

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      })
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      customerId: req.user._id,
      status: "completed",
    })

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or not completed",
      })
    }

    if (booking.customerRating.rating) {
      return res.status(400).json({
        success: false,
        message: "Booking already rated",
      })
    }

    // Update booking rating
    booking.customerRating = {
      rating,
      review,
      ratedAt: new Date(),
    }

    await booking.save()

    // Update tailor's overall rating
    const tailor = await User.findById(booking.tailorId)
    const allRatings = await Booking.find({
      tailorId: booking.tailorId,
      "customerRating.rating": { $exists: true },
    }).select("customerRating.rating")

    const totalRatings = allRatings.length
    const averageRating = allRatings.reduce((sum, b) => sum + b.customerRating.rating, 0) / totalRatings

    tailor.rating.average = Math.round(averageRating * 10) / 10
    tailor.rating.count = totalRatings
    await tailor.save()

    res.json({
      success: true,
      message: "Rating submitted successfully",
      data: { booking },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to submit rating",
      error: error.message,
    })
  }
}

// Search tailors
const searchTailors = async (req, res) => {
  try {
    const { q, pincode, city, page = 1, limit = 10 } = req.query
    const skip = (page - 1) * limit

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      })
    }

    const filter = {
      role: "tailor",
      isActive: true,
      "subscription.isActive": true,
      $or: [
        { businessName: new RegExp(q, "i") },
        { firstName: new RegExp(q, "i") },
        { lastName: new RegExp(q, "i") },
        { specializations: new RegExp(q, "i") },
        { "services.name": new RegExp(q, "i") },
      ],
    }

    if (pincode) {
      filter["businessAddress.pincode"] = pincode
    }

    if (city) {
      filter["businessAddress.city"] = new RegExp(city, "i")
    }

    const [tailors, total] = await Promise.all([
      User.find(filter)
        .select("-password -documents -verificationToken -resetPasswordToken")
        .sort({ "rating.average": -1, totalOrders: -1 })
        .skip(skip)
        .limit(Number.parseInt(limit)),
      User.countDocuments(filter),
    ])

    res.json({
      success: true,
      data: {
        tailors,
        pagination: {
          current: Number.parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
        query: q,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Search failed",
      error: error.message,
    })
  }
}

// Get nearby tailors with location-based search
const getNearbyTailors = async (req, res) => {
  try {
    const { lat, lng, radiusInKm = 2, city, service, page = 1, limit = 10 } = req.query
    console.log("[DEBUG] getNearbyTailors called with params:", { lat, lng, radiusInKm, city, service, page, limit })
    const skip = (page - 1) * limit

    // Base filter for active tailors with subscriptions
    const baseFilter = {
      role: "tailor",
      isActive: true,
      "subscription.isActive": true,
    }

    // Add service filter if provided
    if (service) {
      baseFilter["services.name"] = new RegExp(service, "i")
    }

    console.log("[DEBUG] Base filter:", baseFilter)

    // First, let's check how many tailors exist in total
    const totalTailors = await User.countDocuments(baseFilter)
    console.log("[DEBUG] Total tailors matching base filter:", totalTailors)

    // Check how many tailors have location data
    const tailorsWithLocation = await User.countDocuments({
      ...baseFilter,
      location: { $exists: true },
      "location.coordinates": { $exists: true, $ne: [] },
    })
    console.log("[DEBUG] Tailors with location data:", tailorsWithLocation)

    let tailors = []
    let total = 0

    // If lat & lng are available, use geospatial query
    if (lat && lng) {
      const latitude = Number.parseFloat(lat)
      const longitude = Number.parseFloat(lng)
      const radiusInMeters = Number.parseFloat(radiusInKm) * 1000 // Convert km to meters

      console.log("[DEBUG] Coordinates:", { latitude, longitude, radiusInMeters })

      // Validate coordinates
      if (
        isNaN(latitude) ||
        isNaN(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid latitude or longitude values",
        })
      }

      try {
        // Use $geoNear aggregation for geospatial query
        const nearbyTailors = await User.aggregate([
          {
            $geoNear: {
              near: {
                type: "Point",
                coordinates: [longitude, latitude],
              },
              distanceField: "distance",
              maxDistance: radiusInMeters,
              spherical: true,
              query: baseFilter,
            },
          },
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
              subscriptionPriority: 1,
              "rating.average": -1,
            },
          },
          { $skip: skip },
          { $limit: Number(limit) },
          {
            $project: {
              password: 0,
              documents: 0,
              verificationToken: 0,
              resetPasswordToken: 0,
              subscriptionPriority: 0,
            },
          },
        ])

        console.log("[DEBUG] Nearby tailors found:", nearbyTailors.length)

        // Count total nearby tailors
        const nearbyTotal = await User.countDocuments({
          ...baseFilter,
          location: {
            $geoWithin: {
              $centerSphere: [[longitude, latitude], radiusInMeters / 6378137], // Earth's radius in meters
            },
          },
        })

        console.log("[DEBUG] Total nearby tailors:", nearbyTotal)

        tailors = nearbyTailors
        total = nearbyTotal
      } catch (geoError) {
        console.error("[DEBUG] Geospatial query error:", geoError)
        // Fallback: return all tailors if geospatial query fails
        const [fallbackTailors, fallbackTotal] = await Promise.all([
          User.find(baseFilter)
            .select("-password -documents -verificationToken -resetPasswordToken")
            .sort({ "subscription.planName": 1, "rating.average": -1 })
            .skip(skip)
            .limit(Number.parseInt(limit)),
          User.countDocuments(baseFilter),
        ])
        console.log("[DEBUG] Fallback tailors:", fallbackTailors.length)
        tailors = fallbackTailors
        total = fallbackTotal
      }
    } else if (city) {
      // Fallback to city-based search if coordinates not provided
      const cityFilter = {
        ...baseFilter,
        "businessAddress.city": new RegExp(city, "i"),
      }
      console.log("[DEBUG] City filter:", cityFilter)

      const [cityTailors, cityTotal] = await Promise.all([
        User.aggregate([
          { $match: cityFilter },
          {
            $addFields: {
              subscriptionPriority: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$subscription.planName", "Gold"] }, then: 1 },
                    { case: { $eq: ["$subscription.planName", "Silver"] }, then: 2 },
                    { case: { $eq: ["$subscription.planName", "Basic"] }, then: 3 },
                  ],
                  default: 3,
                },
              },
            },
          },
          {
            $sort: {
              subscriptionPriority: 1, // Lower number = higher priority
              "rating.average": -1, // Higher rating first
            },
          },
          {
            $project: {
              password: 0,
              documents: 0,
              verificationToken: 0,
              resetPasswordToken: 0,
              subscriptionPriority: 0,
            },
          },
          { $skip: skip },
          { $limit: Number.parseInt(limit) },
        ]),
        User.countDocuments(cityFilter),
      ])

      console.log("[DEBUG] City tailors found:", cityTailors.length)
      tailors = cityTailors
      total = cityTotal
    } else {
      return res.status(400).json({
        success: false,
        message: "Either coordinates (lat, lng) or city must be provided",
      })
    }

    console.log("[DEBUG] Final response:", { tailorsCount: tailors.length, total })

    res.json({
      success: true,
      data: {
        tailors,
        pagination: {
          current: Number.parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
        searchParams: {
          lat: lat || null,
          lng: lng || null,
          radiusInKm: Number.parseFloat(radiusInKm),
          city: city || null,
          service: service || null,
        },
        debug: {
          totalTailorsInDb: totalTailors,
          tailorsWithLocation: tailorsWithLocation,
        },
      },
    })
  } catch (error) {
    console.error("[DEBUG] getNearbyTailors error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch nearby tailors",
      error: error.message,
    })
  }
}

// Export all functions
module.exports = {
  getTailors,
  getTailorDetails,
  createBooking,
  getBookings,
  getBookingDetails,
  cancelBooking,
  rateBooking,
  searchTailors,
  getNearbyTailors,
}
