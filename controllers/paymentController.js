const Razorpay = require("razorpay")
const crypto = require("crypto")
const Payment = require("../models/Payment")
const User = require("../models/User")
const SubscriptionPlan = require("../models/SubscriptionPlan")

// Initialize Razorpay with your keys
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

// Create subscription payment order (ONLY FOR SUBSCRIPTIONS)
const createSubscriptionOrder = async (req, res) => {
  try {
    const { planId } = req.body

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "Subscription plan ID is required",
      })
    }

    // Only allow tailors to purchase subscriptions
    if (req.user.role !== "tailor") {
      return res.status(403).json({
        success: false,
        message: "Only tailors can purchase subscriptions",
      })
    }

    // Validate subscription plan
    const subscriptionPlan = await SubscriptionPlan.findById(planId)
    if (!subscriptionPlan || !subscriptionPlan.isActive) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found or inactive",
      })
    }

    // Check if it's a free plan
    if (subscriptionPlan.price === 0) {
      return res.status(400).json({
        success: false,
        message: "Free plans don't require payment. Use the direct activation endpoint.",
      })
    }

    // Generate unique order ID
    const orderId = `TLX_SUB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create Razorpay order
    const gatewayOrder = await razorpay.orders.create({
      amount: subscriptionPlan.price * 100, // Convert to paise
      currency: "INR",
      receipt: orderId,
      notes: {
        purpose: "subscription",
        userId: req.user._id.toString(),
        planId: planId,
        planName: subscriptionPlan.name,
        userEmail: req.user.email,
      },
    })

    // Save payment record
    const payment = new Payment({
      userId: req.user._id,
      orderId,
      amount: subscriptionPlan.price,
      currency: "INR",
      gateway: "razorpay",
      gatewayOrderId: gatewayOrder.id,
      purpose: "subscription",
      subscriptionPlan: planId,
      metadata: {
        planName: subscriptionPlan.name,
        planDuration: subscriptionPlan.duration,
        userEmail: req.user.email,
        userName: `${req.user.firstName} ${req.user.lastName}`,
      },
    })

    await payment.save()

    console.log(`Subscription payment order created: ${orderId} for plan: ${subscriptionPlan.name}`)

    res.status(201).json({
      success: true,
      message: "Subscription payment order created successfully",
      data: {
        orderId,
        gatewayOrderId: gatewayOrder.id,
        amount: subscriptionPlan.price,
        currency: "INR",
        gateway: "razorpay",
        key: process.env.RAZORPAY_KEY_ID,
        plan: {
          id: subscriptionPlan._id,
          name: subscriptionPlan.name,
          displayName: subscriptionPlan.displayName,
          price: subscriptionPlan.price,
          duration: subscriptionPlan.duration,
        },
      },
    })
  } catch (error) {
    console.error("Subscription payment order creation error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to create subscription payment order",
      error: error.message,
    })
  }
}

// Verify subscription payment
const verifySubscriptionPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message: "Order ID, Payment ID, and Signature are required",
      })
    }

    const payment = await Payment.findOne({
      orderId,
      userId: req.user._id,
      purpose: "subscription",
    }).populate("subscriptionPlan")

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Subscription payment order not found",
      })
    }

    // Verify Razorpay signature
    const body = payment.gatewayOrderId + "|" + paymentId
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex")

    const isValid = expectedSignature === signature

    if (!isValid) {
      payment.status = "failed"
      payment.failedAt = new Date()
      payment.failureReason = "Invalid signature"
      await payment.save()

      console.log(`Subscription payment verification failed: ${orderId} - Invalid signature`)

      return res.status(400).json({
        success: false,
        message: "Subscription payment verification failed - Invalid signature",
      })
    }

    // Update payment status
    payment.status = "success"
    payment.paymentId = paymentId
    payment.signature = signature
    payment.gatewayPaymentId = paymentId
    payment.paidAt = new Date()

    await payment.save()

    // Activate subscription
    const subscriptionResult = await activateSubscription(req.user._id, payment.subscriptionPlan._id)

    console.log(`Subscription payment verified and activated: ${orderId} for plan: ${payment.subscriptionPlan.name}`)

    res.json({
      success: true,
      message: "Subscription payment verified and activated successfully!",
      data: {
        payment,
        subscription: subscriptionResult,
      },
    })
  } catch (error) {
    console.error("Subscription payment verification error:", error)
    res.status(500).json({
      success: false,
      message: "Subscription payment verification failed",
      error: error.message,
    })
  }
}

// Activate subscription after successful payment
const activateSubscription = async (userId, planId) => {
  try {
    const plan = await SubscriptionPlan.findById(planId)
    if (!plan) {
      throw new Error("Subscription plan not found")
    }

    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + plan.duration)

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        "subscription.planName": plan.name,
        "subscription.startDate": startDate,
        "subscription.endDate": endDate,
        "subscription.isActive": true,
        "subscription.autoRenew": false,
      },
      { new: true },
    )

    console.log(`Subscription activated for user ${userId}: ${plan.name} until ${endDate}`)

    return {
      planName: plan.name,
      startDate,
      endDate,
      isActive: true,
    }
  } catch (error) {
    console.error("Subscription activation error:", error)
    throw error
  }
}

// Activate free subscription (no payment required)
const activateFreeSubscription = async (req, res) => {
  try {
    const { planId } = req.body

    // Only allow tailors to get subscriptions
    if (req.user.role !== "tailor") {
      return res.status(403).json({
        success: false,
        message: "Only tailors can get subscriptions",
      })
    }

    const plan = await SubscriptionPlan.findById(planId)
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found or inactive",
      })
    }

    // Only allow free plans through this endpoint
    if (plan.price > 0) {
      return res.status(400).json({
        success: false,
        message: "This endpoint is only for free plans. Use payment flow for paid plans.",
      })
    }

    const subscriptionResult = await activateSubscription(req.user._id, planId)

    console.log(`Free subscription activated for user ${req.user._id}: ${plan.name}`)

    res.json({
      success: true,
      message: `${plan.displayName} plan activated successfully!`,
      data: { subscription: subscriptionResult },
    })
  } catch (error) {
    console.error("Free subscription activation error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to activate free subscription",
      error: error.message,
    })
  }
}

// Get subscription payment details
const getSubscriptionPaymentDetails = async (req, res) => {
  try {
    const { orderId } = req.params

    const payment = await Payment.findOne({
      orderId,
      userId: req.user._id,
      purpose: "subscription",
    }).populate("subscriptionPlan")

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Subscription payment not found",
      })
    }

    res.json({
      success: true,
      data: { payment },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscription payment details",
      error: error.message,
    })
  }
}

// Get user's subscription payment history
const getSubscriptionPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query
    const skip = (page - 1) * limit

    const [payments, total] = await Promise.all([
      Payment.find({
        userId: req.user._id,
        purpose: "subscription",
      })
        .populate("subscriptionPlan")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number.parseInt(limit)),
      Payment.countDocuments({
        userId: req.user._id,
        purpose: "subscription",
      }),
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
      message: "Failed to fetch subscription payment history",
      error: error.message,
    })
  }
}

// Razorpay webhook for subscription payments
const razorpaySubscriptionWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"]
    const body = JSON.stringify(req.body)

    // Verify webhook signature if webhook secret is configured
    if (process.env.RAZORPAY_WEBHOOK_SECRET) {
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest("hex")

      if (signature !== expectedSignature) {
        return res.status(400).json({ success: false, message: "Invalid signature" })
      }
    }

    const event = req.body.event
    const paymentData = req.body.payload?.payment?.entity

    if (event === "payment.captured" && paymentData) {
      // Handle successful subscription payment
      const payment = await Payment.findOneAndUpdate(
        { gatewayPaymentId: paymentData.id, purpose: "subscription" },
        {
          status: "success",
          paidAt: new Date(),
        },
        { new: true },
      ).populate("subscriptionPlan")

      if (payment && payment.subscriptionPlan) {
        await activateSubscription(payment.userId, payment.subscriptionPlan._id)
        console.log(`Webhook: Subscription activated for payment ${payment.orderId}`)
      }
    } else if (event === "payment.failed" && paymentData) {
      // Handle failed subscription payment
      await Payment.findOneAndUpdate(
        { gatewayPaymentId: paymentData.id, purpose: "subscription" },
        {
          status: "failed",
          failedAt: new Date(),
          failureReason: paymentData.error_description,
        },
      )
      console.log(`Webhook: Subscription payment failed for payment ${paymentData.id}`)
    }

    res.json({ success: true })
  } catch (error) {
    console.error("Razorpay subscription webhook error:", error)
    res.status(500).json({ success: false })
  }
}

module.exports = {
  createSubscriptionOrder,
  verifySubscriptionPayment,
  activateFreeSubscription,
  getSubscriptionPaymentDetails,
  getSubscriptionPaymentHistory,
  razorpaySubscriptionWebhook,
}
