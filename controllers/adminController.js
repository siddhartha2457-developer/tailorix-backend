const User = require("../models/User")
const Booking = require("../models/Booking")
const Payment = require("../models/Payment")
const SubscriptionPlan = require("../models/SubscriptionPlan")

// Get admin dashboard data
const getDashboard = async (req, res) => {
  try {
    // Get current month stats
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)

    const nextMonth = new Date(currentMonth)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    // Aggregate dashboard data
    const [
      totalUsers,
      totalTailors,
      totalCustomers,
      activeTailors,
      totalBookings,
      monthlyBookings,
      pendingBookings,
      completedBookings,
      totalRevenue,
      monthlyRevenue,
      recentBookings,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: "tailor", isActive: true }),
      User.countDocuments({ role: "customer", isActive: true }),
      User.countDocuments({ role: "tailor", isActive: true, "subscription.isActive": true }),
      Booking.countDocuments(),
      Booking.countDocuments({
        createdAt: { $gte: currentMonth, $lt: nextMonth },
      }),
      Booking.countDocuments({ status: "pending" }),
      Booking.countDocuments({ status: "completed" }),
      Payment.aggregate([{ $match: { status: "success" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Payment.aggregate([
        {
          $match: {
            status: "success",
            createdAt: { $gte: currentMonth, $lt: nextMonth },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Booking.find()
        .populate("customerId", "firstName lastName email")
        .populate("tailorId", "firstName lastName businessName email")
        .sort({ createdAt: -1 })
        .limit(5),
      User.find({ isActive: true }).select("firstName lastName email role createdAt").sort({ createdAt: -1 }).limit(5),
    ])

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalTailors,
          totalCustomers,
          activeTailors,
          totalBookings,
          monthlyBookings,
          pendingBookings,
          completedBookings,
          totalRevenue: totalRevenue[0]?.total || 0,
          monthlyRevenue: monthlyRevenue[0]?.total || 0,
        },
        recentBookings,
        recentUsers,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
      error: error.message,
    })
  }
}

// Get all users
const getUsers = async (req, res) => {
  try {
    const { role, status, page = 1, limit = 10, search } = req.query
    const skip = (page - 1) * limit

    // Build filter
    const filter = {}
    if (role) {
      filter.role = role
    }
    if (status === "active") {
      filter.isActive = true
    } else if (status === "inactive") {
      filter.isActive = false
    }

    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { businessName: new RegExp(search, "i") },
      ]
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password -verificationToken -resetPasswordToken")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number.parseInt(limit)),
      User.countDocuments(filter),
    ])

    res.json({
      success: true,
      data: {
        users,
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
      message: "Failed to fetch users",
      error: error.message,
    })
  }
}

// Get user details
const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params

    const user = await User.findById(userId).select("-password -verificationToken -resetPasswordToken")

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Get user's bookings if tailor or customer
    let bookings = []
    if (user.role === "tailor") {
      bookings = await Booking.find({ tailorId: userId })
        .populate("customerId", "firstName lastName email")
        .sort({ createdAt: -1 })
        .limit(10)
    } else if (user.role === "customer") {
      bookings = await Booking.find({ customerId: userId })
        .populate("tailorId", "firstName lastName businessName email")
        .sort({ createdAt: -1 })
        .limit(10)
    }

    // Get user's payments
    const payments = await Payment.find({ userId })
      .populate("subscriptionPlan", "name displayName")
      .sort({ createdAt: -1 })
      .limit(5)

    res.json({
      success: true,
      data: {
        user,
        bookings,
        payments,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch user details",
      error: error.message,
    })
  }
}

// Update user status
const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params
    const { isActive } = req.body

    const user = await User.findByIdAndUpdate(userId, { isActive }, { new: true }).select(
      "-password -verificationToken -resetPasswordToken",
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: { user },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update user status",
      error: error.message,
    })
  }
}

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Check if user has active bookings
    const activeBookings = await Booking.countDocuments({
      $or: [{ customerId: userId }, { tailorId: userId }],
      status: { $in: ["pending", "accepted", "in_progress"] },
    })

    if (activeBookings > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete user with active bookings",
      })
    }

    await User.findByIdAndDelete(userId)

    res.json({
      success: true,
      message: "User deleted successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    })
  }
}

// Get all bookings
const getBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query
    const skip = (page - 1) * limit

    // Build filter
    const filter = {}
    // if (status) {
    //   filter.status = status
    // }

    if (status) {
  const statuses = status.split(",").map((s) => s.trim().toLowerCase())
  filter.status = { $in: statuses }
}


    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate("customerId", "firstName lastName email phone")
        .populate("tailorId", "firstName lastName businessName email phone")
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

    const booking = await Booking.findById(bookingId)
      .populate("customerId", "firstName lastName email phone address")
      .populate("tailorId", "firstName lastName businessName email phone businessAddress")

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

// Update booking status
const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params
    const { status, adminNotes } = req.body

    const validStatuses = ["pending", "accepted", "rejected", "in_progress", "completed", "cancelled", "delivered"]

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      })
    }

    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        status,
        adminNotes,
        ...(status === "completed" && { deliveryDate: new Date() }),
      },
      { new: true },
    ).populate([
      { path: "customerId", select: "firstName lastName email" },
      { path: "tailorId", select: "firstName lastName businessName email" },
    ])

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      })
    }

    res.json({
      success: true,
      message: "Booking status updated successfully",
      data: { booking },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update booking status",
      error: error.message,
    })
  }
}

// Get all payments
const getPayments = async (req, res) => {
  try {
    const { status, purpose, page = 1, limit = 10 } = req.query
    const skip = (page - 1) * limit

    // Build filter
    const filter = {}
    // if (status) {
    //   filter.status = status
    // }

       if (status) {
  const statuses = status.split(",").map((s) => s.trim().toLowerCase())
  filter.status = { $in: statuses }
}

    if (purpose) {
      filter.purpose = purpose
    }

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate("userId", "firstName lastName email")
        .populate("subscriptionPlan", "name displayName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number.parseInt(limit)),
      Payment.countDocuments(filter),
    ])

    res.json({
      success: true,
      data: {
        payments,
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
      message: "Failed to fetch payments",
      error: error.message,
    })
  }
}

// Get subscription plans
const getSubscriptionPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ displayOrder: 1, price: 1 })

    res.json({
      success: true,
      data: { plans },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscription plans",
      error: error.message,
    })
  }
}

// Create subscription plan
const createSubscriptionPlan = async (req, res) => {
  try {
    const plan = new SubscriptionPlan(req.body)
    await plan.save()

    res.status(201).json({
      success: true,
      message: "Subscription plan created successfully",
      data: { plan },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create subscription plan",
      error: error.message,
    })
  }
}

// Update subscription plan
const updateSubscriptionPlan = async (req, res) => {
  try {
    const { planId } = req.params

    const plan = await SubscriptionPlan.findByIdAndUpdate(planId, req.body, {
      new: true,
      runValidators: true,
    })

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found",
      })
    }

    res.json({
      success: true,
      message: "Subscription plan updated successfully",
      data: { plan },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update subscription plan",
      error: error.message,
    })
  }
}

// Delete subscription plan
const deleteSubscriptionPlan = async (req, res) => {
  try {
    const { planId } = req.params

    // Check if any users are using this plan
    const usersWithPlan = await User.countDocuments({ "subscription.planName": planId })

    if (usersWithPlan > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete plan that is currently in use",
      })
    }

    const plan = await SubscriptionPlan.findByIdAndDelete(planId)

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found",
      })
    }

    res.json({
      success: true,
      message: "Subscription plan deleted successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete subscription plan",
      error: error.message,
    })
  }
}

// Get analytics
const getAnalytics = async (req, res) => {
  try {
    const { period = "30" } = req.query
    const days = Number.parseInt(period)

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // User registration analytics
    const userRegistrations = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
          tailors: {
            $sum: { $cond: [{ $eq: ["$role", "tailor"] }, 1, 0] },
          },
          customers: {
            $sum: { $cond: [{ $eq: ["$role", "customer"] }, 1, 0] },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ])

    // Booking analytics
    const bookingAnalytics = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ])

    // Revenue analytics
    const revenueAnalytics = await Payment.aggregate([
      {
        $match: {
          status: "success",
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ])

    res.json({
      success: true,
      data: {
        userRegistrations,
        bookingAnalytics,
        revenueAnalytics,
        period: days,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics",
      error: error.message,
    })
  }
}

// Get reports
const getReports = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query

    const dateFilter = {}
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      }
    }

    let reportData = {}

    switch (type) {
      case "users":
        reportData = await User.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: "$role",
              count: { $sum: 1 },
              active: { $sum: { $cond: ["$isActive", 1, 0] } },
            },
          },
        ])
        break

      case "bookings":
        reportData = await Booking.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
              totalAmount: { $sum: "$totalAmount" },
            },
          },
        ])
        break

      case "revenue":
        reportData = await Payment.aggregate([
          { $match: { ...dateFilter, status: "success" } },
          {
            $group: {
              _id: "$purpose",
              count: { $sum: 1 },
              totalAmount: { $sum: "$amount" },
            },
          },
        ])
        break

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid report type",
        })
    }

    res.json({
      success: true,
      data: {
        reportData,
        type,
        dateRange: { startDate, endDate },
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate report",
      error: error.message,
    })
  }
}

module.exports = {
  getDashboard,
  getUsers,
  getUserDetails,
  updateUserStatus,
  deleteUser,
  getBookings,
  getBookingDetails,
  updateBookingStatus,
  getPayments,
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  getAnalytics,
  getReports,
}
