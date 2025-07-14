const express = require("express")
const {
  addToFavorites,
  removeFromFavorites,
  getFavorites,
  checkFavoriteStatus,
  getFavoritesWithFilters,
} = require("../controllers/favoriteController")
const { authMiddleware } = require("../middleware/auths")

const router = express.Router()

// Apply auth middleware to all routes (both customers and tailors can have favorites)
router.use(authMiddleware)

// Favorite routes
router.post("/add", addToFavorites) // POST /api/favorites/add
router.delete("/remove/:tailorId", removeFromFavorites) // DELETE /api/favorites/remove/:tailorId
router.get("/", getFavorites) // GET /api/favorites
router.get("/check/:tailorId", checkFavoriteStatus) // GET /api/favorites/check/:tailorId
router.get("/filtered", getFavoritesWithFilters) // GET /api/favorites/filtered

module.exports = router
