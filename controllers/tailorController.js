const User = require("../models/User")
const Booking = require("../models/Booking")
const SubscriptionPlan = require("../models/SubscriptionPlan")
const Payment = require("../models/Payment")
const { validationResult } = require("express-validator")

// Get tailor profile
const getProfile = async (req, res) => {
  try {
    const tailor = await User.findById(req.user._id).select("-password")

    res.json({
      success: true,
      data: { tailor },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: error.message,
    })
  }
}

// Update tailor profile
const updateProfile = async (req, res) => {
  try {
    const allowedUpdates = [
      "businessName",
      "businessAddress",
      "services",
      "experience",
      "specializations",
      "workingHours",
      "pickupDelivery",
      "profileImage",
      "workPhotos",
    ]

    const updates = {}
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key]
      }
    })

    const tailor = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true }).select(
      "-password",
    )

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: { tailor },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    })
  }
}

// Upload documents
const uploadDocuments = async (req, res) => {
  try {
    const documents = {}

    if (req.files) {
      if (req.files.aadhaarFront) {
        documents.aadhaarFront = req.files.aadhaarFront[0].path
        console.log("[BACKEND] Aadhaar Front path:", req.files.aadhaarFront[0].path);
      }
      if (req.files.aadhaarBack) {
        documents.aadhaarBack = req.files.aadhaarBack[0].path
        console.log("[BACKEND] Aadhaar Back path:", req.files.aadhaarBack[0].path);
      }
      if (req.files.businessLicense) {
        documents.businessLicense = req.files.businessLicense[0].path
        console.log("[BACKEND] Business License path:", req.files.businessLicense[0].path);
      }
    }

    // Don't update user if not authenticated
    res.json({
      success: true,
      message: "Documents uploaded successfully",
      data: { documents },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to upload documents",
      error: error.message,
    })
  }
}

// Get dashboard data
const getDashboard = async (req, res) => {
  try {
    const tailorId = req.user._id

    // Get current month stats
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)

    const nextMonth = new Date(currentMonth)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    // Aggregate dashboard data
    const [totalOrders, monthlyOrders, totalEarnings, monthlyEarnings, pendingOrders, completedOrders, recentOrders] =
      await Promise.all([
        Booking.countDocuments({ tailorId }),
        Booking.countDocuments({
          tailorId,
          createdAt: { $gte: currentMonth, $lt: nextMonth },
        }),
        Booking.aggregate([
          { $match: { tailorId: tailorId, status: "completed" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        Booking.aggregate([
          {
            $match: {
              tailorId: tailorId,
              status: "completed",
              createdAt: { $gte: currentMonth, $lt: nextMonth },
            },
          },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        Booking.countDocuments({ tailorId, status: "pending" }),
        Booking.countDocuments({ tailorId, status: "completed" }),
        Booking.find({ tailorId })
          .populate("customerId", "firstName lastName email phone")
          .sort({ createdAt: -1 })
          .limit(5),
      ])

    // Get subscription info
    const subscription = req.user.subscription
    const subscriptionPlan = await SubscriptionPlan.findOne({ name: subscription.planName })

    res.json({
      success: true,
      data: {
        stats: {
          totalOrders,
          monthlyOrders,
          totalEarnings: totalEarnings[0]?.total || 0,
          monthlyEarnings: monthlyEarnings[0]?.total || 0,
          pendingOrders,
          completedOrders,
        },
        recentOrders,
        subscription: {
          ...subscription,
          planDetails: subscriptionPlan,
        },
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

// Get analytics (premium feature)
const getAnalytics = async (req, res) => {
  try {
    const tailorId = req.user._id
    const { period = "30" } = req.query // days

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - Number.parseInt(period))

    // Revenue analytics
    const revenueData = await Booking.aggregate([
      {
        $match: {
          tailorId: tailorId,
          status: "completed",
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
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ])

    // Service popularity
    const serviceAnalytics = await Booking.aggregate([
      {
        $match: {
          tailorId: tailorId,
          createdAt: { $gte: startDate },
        },
      },
      { $unwind: "$services" },
      {
        $group: {
          _id: "$services.name",
          count: { $sum: 1 },
          revenue: { $sum: "$services.price" },
        },
      },
      { $sort: { count: -1 } },
    ])

    res.json({
      success: true,
      data: {
        revenueData,
        serviceAnalytics,
        period: Number.parseInt(period),
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

// Get orders
const getOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query
    const skip = (page - 1) * limit

    const filter = { tailorId: req.user._id }
    // if (status) {
    //   filter.status = status
    // }

    //     if (status) {
    //   const statusArray = status.split(",")
    //   filter.status = statusArray.length > 1 ? { $in: statusArray } : statusArray[0]
    // }

    if (status) {
  const statuses = status.split(",").map((s) => s.trim().toLowerCase())
  filter.status = { $in: statuses }
}


    const [orders, total] = await Promise.all([
      Booking.find(filter)
        .populate("customerId", "firstName lastName email phone address")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number.parseInt(limit)),
      Booking.countDocuments(filter),
    ])

    res.json({
      success: true,
      data: {
        orders,
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
      message: "Failed to fetch orders",
      error: error.message,
    })
  }
}

// Get order details
const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params

    const order = await Booking.findOne({
      _id: orderId,
      tailorId: req.user._id,
    }).populate("customerId", "firstName lastName email phone address")

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }

    res.json({
      success: true,
      data: { order },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
      error: error.message,
    })
  }
}

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params
    const { status, notes } = req.body

    const validStatuses = ["accepted", "in_progress", "completed", "rejected", "cancelled", "delivered"]

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      })
    }

    const order = await Booking.findOne({
      _id: orderId,
      tailorId: req.user._id,
    })

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }

    // Update order
    order.status = status
    order._updatedBy = req.user._id // For status history

    if (notes) {
      order.tailorNotes = notes
    }

    // Set completion date if completed
    if (status === "completed") {
      order.deliveryDate = new Date()

      // Update tailor's total orders and earnings
      await User.findByIdAndUpdate(req.user._id, {
        $inc: {
          totalOrders: 1,
          totalEarnings: order.totalAmount,
        },
      })
    }

    await order.save()

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: { order },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    })
  }
}

// Add order notes
const addOrderNotes = async (req, res) => {
  try {
    const { orderId } = req.params
    const { notes } = req.body

    const order = await Booking.findOneAndUpdate(
      { _id: orderId, tailorId: req.user._id },
      { tailorNotes: notes },
      { new: true },
    )

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }

    res.json({
      success: true,
      message: "Notes added successfully",
      data: { order },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to add notes",
      error: error.message,
    })
  }
}

// Get subscription info
const getSubscription = async (req, res) => {
  try {
    const subscription = req.user.subscription
    const plan = await SubscriptionPlan.findOne({ name: subscription.planName })

    res.json({
      success: true,
      data: {
        subscription,
        planDetails: plan,
        isActive: req.user.hasActiveSubscription(),
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscription info",
      error: error.message,
    })
  }
}

// Get subscription plans
const getSubscriptionPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ displayOrder: 1, price: 1 })

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

// Initiate subscription
const initiateSubscription = async (req, res) => {
  try {
    const { planName } = req.body

    const plan = await SubscriptionPlan.findOne({ name: planName, isActive: true })

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found",
      })
    }

    // For free plan, activate immediately
    if (plan.price === 0) {
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + plan.duration)

      await User.findByIdAndUpdate(req.user._id, {
        "subscription.planName": plan.name,
        "subscription.startDate": new Date(),
        "subscription.endDate": endDate,
        "subscription.isActive": true,
      })

      return res.json({
        success: true,
        message: "Free plan activated successfully",
        data: { planName: plan.name },
      })
    }

    // For paid plans, redirect to payment
    res.json({
      success: true,
      message: "Proceed to payment",
      data: {
        plan,
        redirectToPayment: true,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to initiate subscription",
      error: error.message,
    })
  }
}

// Get services
const getServices = async (req, res) => {
  try {
    const tailor = await User.findById(req.user._id).select("services")

    res.json({
      success: true,
      data: { services: tailor.services || [] },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch services",
      error: error.message,
    })
  }
}

// Add service
const addService = async (req, res) => {
  try {
    const { name, price, description } = req.body

    // Check listing limit based on subscription
    const features = await req.user.getSubscriptionFeatures()
    const currentServices = req.user.services || []

    if (currentServices.length >= features.listingLimit) {
      return res.status(403).json({
        success: false,
        message: `Your current plan allows only ${features.listingLimit} service listings`,
        code: "LISTING_LIMIT_EXCEEDED",
      })
    }

    const newService = { name, price, description }

    const tailor = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { services: newService } },
      { new: true },
    ).select("services")

    res.json({
      success: true,
      message: "Service added successfully",
      data: { services: tailor.services },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to add service",
      error: error.message,
    })
  }
}

// Update service
const updateService = async (req, res) => {
  try {
    const { serviceId } = req.params
    const { name, price, description } = req.body

    const tailor = await User.findOneAndUpdate(
      { _id: req.user._id, "services._id": serviceId },
      {
        $set: {
          "services.$.name": name,
          "services.$.price": price,
          "services.$.description": description,
        },
      },
      { new: true },
    ).select("services")

    if (!tailor) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      })
    }

    res.json({
      success: true,
      message: "Service updated successfully",
      data: { services: tailor.services },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update service",
      error: error.message,
    })
  }
}

// Delete service
const deleteService = async (req, res) => {
  try {
    const { serviceId } = req.params

    const tailor = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { services: { _id: serviceId } } },
      { new: true },
    ).select("services")

    res.json({
      success: true,
      message: "Service deleted successfully",
      data: { services: tailor.services },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete service",
      error: error.message,
    })
  }
}

// Get earnings
const getEarnings = async (req, res) => {
  try {
    const { period = "30" } = req.query
    const tailorId = req.user._id

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - Number.parseInt(period))

    const earnings = await Booking.aggregate([
      {
        $match: {
          tailorId: tailorId,
          status: "completed",
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
          dailyEarnings: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ])

    const totalEarnings = earnings.reduce((sum, day) => sum + day.dailyEarnings, 0)

    res.json({
      success: true,
      data: {
        earnings,
        totalEarnings,
        period: Number.parseInt(period),
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch earnings",
      error: error.message,
    })
  }
}

// Get earnings summary
const getEarningsSummary = async (req, res) => {
  try {
    const tailorId = req.user._id

    // Current month
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)

    const nextMonth = new Date(currentMonth)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    // Previous month
    const previousMonth = new Date(currentMonth)
    previousMonth.setMonth(previousMonth.getMonth() - 1)

    const [totalEarnings, currentMonthEarnings, previousMonthEarnings, todayEarnings] = await Promise.all([
      Booking.aggregate([
        { $match: { tailorId: tailorId, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            tailorId: tailorId,
            status: "completed",
            createdAt: { $gte: currentMonth, $lt: nextMonth },
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            tailorId: tailorId,
            status: "completed",
            createdAt: { $gte: previousMonth, $lt: currentMonth },
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            tailorId: tailorId,
            status: "completed",
            createdAt: {
              $gte: new Date(new Date().setHours(0, 0, 0, 0)),
              $lt: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
    ])

    const currentTotal = currentMonthEarnings[0]?.total || 0
    const previousTotal = previousMonthEarnings[0]?.total || 0
    const growthPercentage = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0

    res.json({
      success: true,
      data: {
        totalEarnings: totalEarnings[0]?.total || 0,
        currentMonthEarnings: currentTotal,
        previousMonthEarnings: previousTotal,
        todayEarnings: todayEarnings[0]?.total || 0,
        growthPercentage: Math.round(growthPercentage * 100) / 100,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch earnings summary",
      error: error.message,
    })
  }
}

module.exports = {
  getProfile,
  updateProfile,
  uploadDocuments,
  getDashboard,
  getAnalytics,
  getOrders,
  getOrderDetails,
  updateOrderStatus,
  addOrderNotes,
  getSubscription,
  getSubscriptionPlans,
  initiateSubscription,
  getServices,
  addService,
  updateService,
  deleteService,
  getEarnings,
  getEarningsSummary,
}
