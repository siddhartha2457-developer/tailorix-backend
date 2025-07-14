const express = require("express")
const {
  getTailors,
  getTailorDetails,
  createBooking,
  getBookings,
  getBookingDetails,
  cancelBooking,
  rateBooking,
  searchTailors,
  getNearbyTailors,
} = require("../controllers/customerController")
const { authMiddleware, customerOnly, optionalAuth } = require("../middleware/auths")

const router = express.Router()

// Public routes (no authentication required)
router.get("/tailors/nearby", getNearbyTailors) // No auth required for nearby search
router.get("/tailors/search", optionalAuth, searchTailors) // Optional auth for search
router.get("/tailors/:tailorId", optionalAuth, getTailorDetails) // Optional auth for tailor details

// Protected routes (authentication required)
router.use(authMiddleware)
router.use(customerOnly)

// Authenticated tailor discovery routes
router.get("/tailors", getTailors)

// Booking routes
router.post("/bookings", createBooking)
router.get("/bookings", getBookings)
router.get("/bookings/:bookingId", getBookingDetails)
router.put("/bookings/:bookingId/cancel", cancelBooking)
router.post("/bookings/:bookingId/rate", rateBooking)

module.exports = router
