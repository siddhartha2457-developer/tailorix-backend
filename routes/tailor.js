const express = require("express")
const { body } = require("express-validator")
const {
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
} = require("../controllers/tailorController")
const { authMiddleware, tailorOnly, subscriptionGuard } = require("../middleware/auths")
const { upload } = require("../middleware/upload")
const tailorController = require("../controllers/tailorController")

const router = express.Router()

// Apply auth middleware to all routes
router.use(authMiddleware)
router.use(tailorOnly)

// Profile routes
router.get("/profile", getProfile)
router.put("/profile", updateProfile)

router.post(
  "/documents",
  upload.fields([
    { name: "aadhaarFront", maxCount: 1 },
    { name: "aadhaarBack", maxCount: 1 },
    { name: "businessLicense", maxCount: 1 },
  ]),
  tailorController.uploadDocuments,
)

// Dashboard routes
router.get("/dashboard", getDashboard)
router.get("/analytics", subscriptionGuard("analytics"), getAnalytics)

// Order routes
router.get("/orders", getOrders)
router.get("/orders/:orderId", getOrderDetails)
router.put("/orders/:orderId/status", updateOrderStatus)
router.put("/orders/:orderId/notes", addOrderNotes)

// Subscription routes
router.get("/subscription", getSubscription)
// Make subscription plans public (no auth required for basic plan info)
router.get("/subscription/plans", getSubscriptionPlans)
router.post("/subscription/subscribe", initiateSubscription)

// Service routes
router.get("/services", getServices)
router.post("/services", addService)
router.put("/services/:serviceId", updateService)
router.delete("/services/:serviceId", deleteService)

// Earnings routes
router.get("/earnings", getEarnings)
router.get("/earnings/summary", getEarningsSummary)

module.exports = router
