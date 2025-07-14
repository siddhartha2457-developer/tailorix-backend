const express = require("express")
const SubscriptionPlan = require("../models/SubscriptionPlan")

const router = express.Router()

// Public route to get subscription plans (no auth required)
router.get("/subscription-plans", async (req, res) => {
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
})

module.exports = router
