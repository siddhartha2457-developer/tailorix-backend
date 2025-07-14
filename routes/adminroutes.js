// routes/adminRoutes.js
const express = require("express")
const router = express.Router()
const adminController = require("../controllers/adminController")
const { authMiddleware, adminOnly } = require("../middleware/auths")

// Dashboard & Analytics
router.get("/dashboard", authMiddleware, adminOnly, adminController.getDashboard)
router.get("/analytics", authMiddleware, adminOnly, adminController.getAnalytics)
router.get("/reports", authMiddleware, adminOnly, adminController.getReports)

// Users
router.get("/users", authMiddleware, adminOnly, adminController.getUsers)
router.get("/users/:userId", authMiddleware, adminOnly, adminController.getUserDetails)
router.put("/users/:userId/status", authMiddleware, adminOnly, adminController.updateUserStatus)
router.delete("/users/:userId", authMiddleware, adminOnly, adminController.deleteUser)

// Bookings
router.get("/bookings", authMiddleware, adminOnly, adminController.getBookings)
router.get("/bookings/:bookingId", authMiddleware, adminOnly, adminController.getBookingDetails)
router.put("/bookings/:bookingId/status", authMiddleware, adminOnly, adminController.updateBookingStatus)

// Payments
router.get("/payments", authMiddleware, adminOnly, adminController.getPayments)

// Subscription Plans
router.get("/subscription-plans", authMiddleware, adminOnly, adminController.getSubscriptionPlans)
router.post("/subscription-plans", authMiddleware, adminOnly, adminController.createSubscriptionPlan)
router.put("/subscription-plans/:planId", authMiddleware, adminOnly, adminController.updateSubscriptionPlan)
router.delete("/subscription-plans/:planId", authMiddleware, adminOnly, adminController.deleteSubscriptionPlan)

module.exports = router
