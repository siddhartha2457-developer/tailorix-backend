const express = require("express")
const {
  getAllTailors,
  getNewlyJoinedTailors,
  getTailorsWithFavorites,
  getTailorStats,
} = require("../controllers/tailorListController")
const { authMiddleware, optionalAuth } = require("../middleware/auths")

const router = express.Router()

// Public routes (no auth required)
router.get("/", getAllTailors) // GET /api/tailors
router.get("/new", getNewlyJoinedTailors) // GET /api/tailors/new
router.get("/stats", getTailorStats) // GET /api/tailors/stats

// Protected routes (auth required for favorite functionality)
router.get("/with-favorites", authMiddleware, getTailorsWithFavorites) // GET /api/tailors/with-favorites

module.exports = router
