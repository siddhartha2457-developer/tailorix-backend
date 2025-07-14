const express = require("express")
const {
  createSubscriptionOrder,
  verifySubscriptionPayment,
  activateFreeSubscription,
  getSubscriptionPaymentDetails,
  getSubscriptionPaymentHistory,
  razorpaySubscriptionWebhook,
} = require("../controllers/paymentController")
const { authMiddleware, tailorOnly } = require("../middleware/auths")

const router = express.Router()

// Webhook routes (no auth required)
router.post("/webhook/razorpay/subscription", razorpaySubscriptionWebhook)

// Apply auth middleware to other routes
router.use(authMiddleware)

// SUBSCRIPTION PAYMENT ROUTES ONLY
// (Order payment routes are commented out as orders are paid in cash directly to tailors)

// Subscription payment routes (only for tailors)
router.post("/subscription/create-order", tailorOnly, createSubscriptionOrder)
router.post("/subscription/verify", tailorOnly, verifySubscriptionPayment)
router.post("/subscription/activate-free", tailorOnly, activateFreeSubscription)
router.get("/subscription/orders/:orderId", tailorOnly, getSubscriptionPaymentDetails)
router.get("/subscription/history", tailorOnly, getSubscriptionPaymentHistory)

// COMMENTED OUT: Order payment routes (orders are paid in cash)
// router.post("/order/create", createOrderPayment)
// router.post("/order/verify", verifyOrderPayment)
// router.get("/order/:orderId", getOrderPaymentDetails)
// router.post("/order/refund", initiateOrderRefund)

module.exports = router
