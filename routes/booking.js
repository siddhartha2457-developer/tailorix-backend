const express = require("express")
const {
  createBooking,
  getBookings,
  getBookingDetails,
  updateBookingStatus,
  cancelBooking,
  uploadProgressImages,
} = require("../controllers/bookingController")
const { authMiddleware, tailorOrAdmin, customerOrAdmin } = require("../middleware/auths")
const { upload } = require("../middleware/upload")

const router = express.Router()

// Apply auth middleware to all routes
router.use(authMiddleware)

// Booking routes (NO PAYMENT REQUIRED - Cash payments directly to tailors)
router.post("/", createBooking)
router.get("/", getBookings)
router.get("/:bookingId", getBookingDetails)
router.put("/:bookingId/status", tailorOrAdmin, updateBookingStatus)
router.put("/:bookingId/cancel", cancelBooking)
router.post("/:bookingId/progress-images", upload.array("progressImages", 5), uploadProgressImages)

// COMMENTED OUT: Payment-related booking routes
// router.post("/:bookingId/payment", createBookingPayment)
// router.post("/:bookingId/payment/verify", verifyBookingPayment)
// router.get("/:bookingId/payment", getBookingPaymentStatus)

module.exports = router
