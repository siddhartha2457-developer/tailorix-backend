const jwt = require("jsonwebtoken")
const User = require("../models/User")

// Auth middleware
const authMiddleware = async (req, res, next) => {
  try {
    console.log("[AUTH] Checking authentication...")

    const authHeader = req.header("Authorization")
    console.log("[AUTH] Authorization header:", authHeader ? "Present" : "Missing")

    if (!authHeader) {
      console.log("[AUTH] No authorization header found")
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      })
    }

    if (!authHeader.startsWith("Bearer ")) {
      console.log("[AUTH] Invalid authorization format")
      return res.status(401).json({
        success: false,
        message: "Access denied. Invalid token format.",
      })
    }

    const token = authHeader.substring(7) // Remove "Bearer " prefix
    console.log("[AUTH] Token extracted:", token.substring(0, 20) + "...")

    if (!process.env.JWT_SECRET) {
      console.error("[AUTH] JWT_SECRET not found in environment")
      return res.status(500).json({
        success: false,
        message: "Server configuration error.",
      })
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log("[AUTH] Token decoded successfully:", { userId: decoded.userId })

    // Get user from database
    const user = await User.findById(decoded.userId).select("-password")

    if (!user) {
      console.log("[AUTH] User not found in database:", decoded.userId)
      return res.status(401).json({
        success: false,
        message: "Invalid token. User not found.",
      })
    }

    if (!user.isActive) {
      console.log("[AUTH] User account is inactive:", user.email)
      return res.status(401).json({
        success: false,
        message: "Account is deactivated.",
      })
    }

    // REMOVED: Verification check for existing users
    // Allow unverified users to access protected routes
    // This is common for business applications where email verification is optional
    console.log("[AUTH] Authentication successful:", {
      userId: user._id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified, // Log but don't block
    })

    req.user = user
    next()
  } catch (error) {
    console.error("[AUTH] Authentication error:", error.message)

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      })
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired.",
      })
    }

    res.status(500).json({
      success: false,
      message: "Authentication failed.",
      error: error.message,
    })
  }
}

// Optional authentication middleware
const optionalAuth = async (req, res, next) => {
  const authHeader = req.header("Authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7)
      if (process.env.JWT_SECRET) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await User.findById(decoded.userId).select("-password")
        if (user && user.isActive) {
          req.user = user
        }
      }
    } catch (err) {
      // Ignore token errors for optional auth
    }
  }
  next()
}

// Role-based middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only.",
    })
  }
  next()
}

const tailorOnly = (req, res, next) => {
  if (req.user.role !== "tailor") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Tailors only.",
    })
  }
  next()
}

const customerOnly = (req, res, next) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Customers only.",
    })
  }
  next()
}

const tailorOrAdmin = (req, res, next) => {
  if (req.user.role !== "tailor" && req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Tailors or admin only.",
    })
  }
  next()
}

const customerOrAdmin = (req, res, next) => {
  if (req.user.role !== "customer" && req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Customers or admin only.",
    })
  }
  next()
}

// Subscription guard middleware
const subscriptionGuard = (feature) => {
  return async (req, res, next) => {
    try {
      if (req.user.role !== "tailor") {
        return next() // Non-tailors don't need subscription checks
      }

      const user = req.user
      const subscription = user.subscription

      if (!subscription || !subscription.isActive) {
        return res.status(403).json({
          success: false,
          message: "Active subscription required.",
        })
      }

      // Check if subscription has expired
      if (subscription.endDate && new Date() > subscription.endDate) {
        return res.status(403).json({
          success: false,
          message: "Subscription has expired.",
        })
      }

      // Get subscription features
      const features = await user.getSubscriptionFeatures()

      if (feature && !features[feature]) {
        return res.status(403).json({
          success: false,
          message: `This feature requires a higher subscription plan.`,
        })
      }

      next()
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Subscription check failed.",
        error: error.message,
      })
    }
  }
}

module.exports = {
  authMiddleware,
  optionalAuth,
  adminOnly,
  tailorOnly,
  customerOnly,
  tailorOrAdmin,
  customerOrAdmin,
  subscriptionGuard,
}
