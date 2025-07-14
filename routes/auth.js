const express = require("express")
const { body } = require("express-validator")
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmailOTP,
  resendVerificationOTP,
  refreshToken,
  logout,
  uploadTailorDocuments,
  uploadWorkPhotos,
  uploadProfilePhotos,
  setMainProfilePhoto,
  deleteProfilePhoto,
} = require("../controllers/authController")
const { authMiddleware } = require("../middleware/auths")
const { uploadMiddleware, handleUploadError } = require("../middleware/upload")

const router = express.Router()

// Validation rules
const registerValidation = [
  body("firstName").trim().isLength({ min: 2 }).withMessage("First name must be at least 2 characters"),
  body("lastName").trim().isLength({ min: 2 }).withMessage("Last name must be at least 2 characters"),
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("phone").isMobilePhone("en-IN").withMessage("Please provide a valid phone number"),
  body("role").optional().isIn(["customer", "tailor"]).withMessage("Invalid role"),

    // NEW: Gender validation
  body("gender")
    .isIn(["Male", "Female", "Other"])
    .withMessage("Gender must be Male, Female, or Other"),

  // NEW: Tailor Type validation (only for tailors)
  body("tailorType")
    .if(body("role").equals("tailor"))
    .isIn([
      "Gents Tailor",
      "Ladies Tailor",
      "Kids Tailor",
      "Unisex Tailor",
      "Bridal Specialist",
      "Formal Wear Specialist",
    ])
    .withMessage("Invalid tailor type"),


    // Address validation
  // body("city")
  //   .optional()
  //   .trim()
  //   .isLength({ min: 2 })
  //   .withMessage("City must be at least 2 characters"),
  // body("state").optional().trim().isLength({ min: 2 }).withMessage("State must be at least 2 characters"),
  // body("pincode")
  //   .optional()
  //   .matches(/^\d{6}$/)
  //   .withMessage("Pincode must be 6 digits"),
  // body("street").optional().trim(),
  // body("landmark").optional().trim(),
  // body("country").optional().trim(),

  // Tailor specific validation
  // body("businessName")
  //   .if(body("role").equals("tailor"))
  //   .notEmpty()
  //   .withMessage("Business name is required for tailors"),

]


const loginValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
]

const changePasswordValidation = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword").isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),
]

const otpVerificationValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email"),
  body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
]

// Public routes
router.post("/register", registerValidation, register)
router.post("/login", loginValidation, login)
router.post("/forgot-password", body("email").isEmail().normalizeEmail(), forgotPassword)
router.post("/reset-password", body("token").notEmpty(), body("password").isLength({ min: 6 }), resetPassword)

// OTP-based verification routes
router.post("/verify-otp", otpVerificationValidation, verifyEmailOTP)
router.post("/resend-otp", body("email").isEmail().normalizeEmail(), resendVerificationOTP)

// Public upload routes for registration (no auth required)
router.post("/upload-documents", uploadMiddleware.documents, handleUploadError, uploadTailorDocuments)
router.post(
  "/upload-work-photos",
  (req, res, next) => {
    console.log("[ROUTE] upload-work-photos endpoint hit")
    console.log("[ROUTE] Request method:", req.method)
    console.log("[ROUTE] Content-Type:", req.get("Content-Type"))
    next()
  },
  uploadMiddleware.bookingImages,
  handleUploadError,
  uploadWorkPhotos,
)

// NEW: Public profile photo upload route
router.post(
  "/upload-profile-photos",
  (req, res, next) => {
    console.log("[ROUTE] upload-profile-photos endpoint hit")
    console.log("[ROUTE] Request method:", req.method)
    console.log("[ROUTE] Content-Type:", req.get("Content-Type"))
    next()
  },
  uploadMiddleware.profilePhotos,
  handleUploadError,
  uploadProfilePhotos,
)

// Protected routes
router.use(authMiddleware)
router.get("/profile", getProfile)
router.put("/profile", updateProfile)
router.post("/change-password", changePasswordValidation, changePassword)
router.post("/refresh-token", refreshToken)
router.post("/logout", logout)

// Protected profile photo management routes
router.put("/profile-photos/:photoId/main", setMainProfilePhoto)
router.delete("/profile-photos/:photoId", deleteProfilePhoto)

module.exports = router
