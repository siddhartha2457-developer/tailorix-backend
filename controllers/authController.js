const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const { validationResult } = require("express-validator")
const User = require("../models/User")
const { sendEmail } = require("../utils/sendEmail")
const path = require("path")
const fs = require("fs")

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  })
}

// Register user
const register = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => `${err.param}: ${err.msg}`).join("; ")
      return res.status(400).json({
        success: false,
        message: `Validation failed: ${errorMessages}`,
        errors: errors.array(),
      })
    }

    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      role = "customer",
      gender, // NEW
      tailorType, // NEW
      businessName,
      businessAddress,
      pickupDelivery,
      services,
      location,
      address,
    } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      })
    }

    // Create user data
    const userData = {
      firstName,
      lastName,
      email,
      password,
      phone,
      role,
      gender, // NEW
    }
    if (role === "customer" && address) {
  userData.address = address
}

    // Add tailor-specific fields
    if (role === "tailor") {
      if (businessName) userData.businessName = businessName
      if (businessAddress) userData.businessAddress = businessAddress
      if (typeof pickupDelivery === "boolean") userData.pickupDelivery = pickupDelivery
      if (services && Array.isArray(services)) userData.services = services
      if (tailorType) userData.tailorType = tailorType // NEW
    }

    // Add location if provided
    if (location && location.coordinates && Array.isArray(location.coordinates)) {
      userData.location = location
    }

    // Create user
    const user = new User(userData)

    // Generate OTP
    const otp = user.generateVerificationOTP()
    await user.save()

    console.log(`Generated OTP for ${email}: ${otp}`)

    // Send verification email with OTP
    try {
      await sendEmail({
        to: email,
        template: "emailVerificationOTP",
        data: {
          name: firstName,
          otp: otp,
          email: email,
        },
      })

      console.log("Verification OTP email sent to:", email)
    } catch (emailError) {
      console.error("Email sending failed:", emailError)
      // Continue with registration even if email fails
    }

    // Generate token
    const token = generateToken(user._id)

    res.status(201).json({
      success: true,
      message: "User registered successfully. Please check your email for the verification OTP.",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          gender: user.gender, // NEW
          tailorType: user.tailorType, // NEW
          isVerified: user.isVerified,
        },
        token,
        requiresVerification: true,
      },
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    })
  }
}

// Verify email with OTP
const verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body

    console.log("OTP verification attempt:", { email, otp })

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      })
    }

    const user = await User.findOne({ email })
    if (!user) {
      console.log("No user found with email:", email)
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      })
    }

    // Verify OTP
    const verificationResult = user.verifyOTP(otp)
    if (!verificationResult.success) {
      console.log("OTP verification failed:", verificationResult.message)
      return res.status(400).json({
        success: false,
        message: verificationResult.message,
      })
    }

    // Update user verification status
    user.isVerified = true
    user.verificationOTP = undefined
    user.verificationOTPExpires = undefined
    await user.save()

    console.log("User verified successfully:", user.email)

    res.json({
      success: true,
      message: "Email verified successfully! You can now login to your account.",
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          gender: user.gender, // NEW
          tailorType: user.tailorType, // NEW
          isVerified: user.isVerified,
        },
      },
    })
  } catch (error) {
    console.error("Email verification error:", error)
    res.status(500).json({
      success: false,
      message: "Email verification failed",
      error: error.message,
    })
  }
}

// Resend verification OTP
const resendVerificationOTP = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      })
    }

    // Generate new OTP
    const otp = user.generateVerificationOTP()
    await user.save()

    console.log(`Resent OTP for ${email}: ${otp}`)

    // Send verification email
    await sendEmail({
      to: email,
      template: "emailVerificationOTP",
      data: {
        name: user.firstName,
        otp: otp,
        email: email,
      },
    })

    console.log("Verification OTP resent to:", email)

    res.json({
      success: true,
      message: "Verification OTP sent successfully",
    })
  } catch (error) {
    console.error("Resend verification error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to resend verification OTP",
      error: error.message,
    })
  }
}

// Upload work photos (public route for registration)
const uploadWorkPhotos = async (req, res) => {
  try {
    console.log("[BACKEND] uploadWorkPhotos called")
    console.log("[BACKEND] req.body:", req.body)
    console.log("[BACKEND] req.files:", req.files)

    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required to associate work photos",
      })
    }

    const user = await User.findOne({ email, role: "tailor" })
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Tailor not found with this email",
      })
    }

    const workPhotos = []

    // Handle referenceImages field (from bookingImages middleware)
    if (req.files && req.files.referenceImages && req.files.referenceImages.length > 0) {
      console.log("[BACKEND] Processing", req.files.referenceImages.length, "reference images as work photos")
      req.files.referenceImages.forEach((file, index) => {
        console.log(`[BACKEND] File ${index + 1}:`, {
          fieldname: file.fieldname,
          originalname: file.originalname,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
        })
        workPhotos.push(file.path)
      })
    } else {
      console.log("[BACKEND] No reference images found in req.files")
      console.log("[BACKEND] req.files structure:", req.files)

      return res.status(400).json({
        success: false,
        message: "No work photos were uploaded. Please select files to upload.",
      })
    }

    // Update user work photos (append to existing ones if any)
    const existingPhotos = user.workPhotos || []
    user.workPhotos = [...existingPhotos, ...workPhotos]
    await user.save()

    console.log("[BACKEND] Work photos saved successfully:", user.workPhotos)

    res.json({
      success: true,
      message: `${workPhotos.length} work photos uploaded successfully`,
      data: {
        workPhotos: user.workPhotos,
        uploadedCount: workPhotos.length,
        totalCount: user.workPhotos.length,
      },
    })
  } catch (error) {
    console.error("[BACKEND] Upload work photos error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to upload work photos",
      error: error.message,
    })
  }
}

// Upload tailor documents (public route for registration)
const uploadTailorDocuments = async (req, res) => {
  try {
    console.log("[BACKEND] uploadTailorDocuments called")
    console.log("[BACKEND] req.body:", req.body)
    console.log("[BACKEND] req.files:", req.files)

    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required to associate documents",
      })
    }

    const user = await User.findOne({ email, role: "tailor" })
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Tailor not found with this email",
      })
    }

    const documents = {}
    if (req.files) {
      if (req.files.aadhaarFront) {
        documents.aadhaarFront = req.files.aadhaarFront[0].path
        console.log("[BACKEND] Aadhaar Front uploaded:", documents.aadhaarFront)
      }
      if (req.files.aadhaarBack) {
        documents.aadhaarBack = req.files.aadhaarBack[0].path
        console.log("[BACKEND] Aadhaar Back uploaded:", documents.aadhaarBack)
      }
      if (req.files.businessLicense) {
        documents.businessLicense = req.files.businessLicense[0].path
        console.log("[BACKEND] Business License uploaded:", documents.businessLicense)
      }
    }

    // Update user documents
    user.documents = { ...user.documents, ...documents }
    await user.save()

    console.log("[BACKEND] Documents saved successfully:", user.documents)

    res.json({
      success: true,
      message: "Documents uploaded successfully",
      data: { documents: user.documents },
    })
  } catch (error) {
    console.error("[BACKEND] Upload documents error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to upload documents",
      error: error.message,
    })
  }
}

// Upload profile photos
const uploadProfilePhotos = async (req, res) => {
  try {
    console.log("[BACKEND] uploadProfilePhotos called")
    console.log("[BACKEND] req.body:", req.body)
    console.log("[BACKEND] req.files:", req.files)

    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required to associate profile photos",
      })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this email",
      })
    }

    const profilePhotos = []

    // Handle profilePhotos field
    if (req.files && req.files.length > 0) {
      console.log("[BACKEND] Processing", req.files.length, "profile photos")
      req.files.forEach((file, index) => {
        console.log(`[BACKEND] File ${index + 1}:`, {
          fieldname: file.fieldname,
          originalname: file.originalname,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
        })

        profilePhotos.push({
          url: file.path,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          uploadedAt: new Date(),
          isMain: user.profilePhotos.length === 0 && index === 0, // First photo is main if no existing photos
          isPublic: true,
        })
      })
    } else {
      console.log("[BACKEND] No profile photos found in req.files")
      return res.status(400).json({
        success: false,
        message: "No profile photos were uploaded. Please select files to upload.",
      })
    }

    // Add new photos to user's profile photos array
    user.profilePhotos.push(...profilePhotos)
    await user.save()

    console.log("[BACKEND] Profile photos saved successfully:", user.profilePhotos.length)

    res.json({
      success: true,
      message: `${profilePhotos.length} profile photos uploaded successfully`,
      data: {
        profilePhotos: user.getPublicProfilePhotos(),
        mainProfilePhoto: user.getMainProfilePhoto(),
        uploadedCount: profilePhotos.length,
        totalCount: user.profilePhotos.length,
      },
    })
  } catch (error) {
    console.error("[BACKEND] Upload profile photos error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to upload profile photos",
      error: error.message,
    })
  }
}

// Set main profile photo
const setMainProfilePhoto = async (req, res) => {
  try {
    const { photoId } = req.params

    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    const success = user.setMainProfilePhoto(photoId)
    if (!success) {
      return res.status(404).json({
        success: false,
        message: "Photo not found",
      })
    }

    await user.save()

    res.json({
      success: true,
      message: "Main profile photo updated successfully",
      data: {
        mainProfilePhoto: user.getMainProfilePhoto(),
        profilePhotos: user.getPublicProfilePhotos(),
      },
    })
  } catch (error) {
    console.error("Set main profile photo error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to set main profile photo",
      error: error.message,
    })
  }
}

// Delete profile photo
const deleteProfilePhoto = async (req, res) => {
  try {
    const { photoId } = req.params

    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    const photo = user.profilePhotos.id(photoId)
    if (!photo) {
      return res.status(404).json({
        success: false,
        message: "Photo not found",
      })
    }

    // Delete file from filesystem
    try {
      if (fs.existsSync(photo.url)) {
        fs.unlinkSync(photo.url)
      }
    } catch (fileError) {
      console.error("Error deleting file:", fileError)
    }

    // Remove photo from array
    user.profilePhotos.pull(photoId)

    // If deleted photo was main, set first photo as main
    if (photo.isMain && user.profilePhotos.length > 0) {
      user.profilePhotos[0].isMain = true
    }

    await user.save()

    res.json({
      success: true,
      message: "Profile photo deleted successfully",
      data: {
        profilePhotos: user.getPublicProfilePhotos(),
        mainProfilePhoto: user.getMainProfilePhoto(),
      },
    })
  } catch (error) {
    console.error("Delete profile photo error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete profile photo",
      error: error.message,
    })
  }
}

// Get user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    res.json({
      success: true,
      data: { user },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: error.message,
    })
  }
}

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const allowedUpdates = [
      "firstName",
      "lastName",
      "phone",
      "gender", // NEW
      "tailorType", // NEW
      "address",
      "businessName",
      "businessAddress",
      "experience",
      "specializations",
      "workingHours",
      "pickupDelivery",
      "services",
      "workPhotos",
    ]

    const updates = {}
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key]
      }
    })

    // Handle location update
    if (req.body.lat && req.body.lng) {
      const latitude = Number.parseFloat(req.body.lat)
      const longitude = Number.parseFloat(req.body.lng)

      if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
        updates.location = {
          type: "Point",
          coordinates: [longitude, latitude],
        }
      }
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    })

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: { user },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    })
  }
}

// Change password
const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => `${err.param}: ${err.msg}`).join("; ")
      return res.status(400).json({
        success: false,
        message: `Validation failed: ${errorMessages}`,
        errors: errors.array(),
      })
    }

    const { currentPassword, newPassword } = req.body

    // Get user with password
    const user = await User.findById(req.user._id).select("+password")

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword)
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      })
    }

    // Update password
    user.password = newPassword
    await user.save()

    res.json({
      success: true,
      message: "Password changed successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to change password",
      error: error.message,
    })
  }
}

// Forgot password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this email",
      })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex")
    user.resetPasswordToken = resetToken
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000 // 10 minutes

    await user.save()

    // Send reset email
    try {
      await sendEmail({
        to: email,
        template: "passwordReset",
        data: {
          name: user.firstName,
          resetLink: `${process.env.FRONTEND_URL}/reset-password/${resetToken}`,
        },
      })

      res.json({
        success: true,
        message: "Password reset link sent to your email",
      })
    } catch (emailError) {
      user.resetPasswordToken = undefined
      user.resetPasswordExpires = undefined
      await user.save()

      res.status(500).json({
        success: false,
        message: "Failed to send reset email",
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to process forgot password request",
      error: error.message,
    })
  }
}

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      })
    }

    // Update password
    user.password = password
    user.resetPasswordToken = undefined
    user.resetPasswordExpires = undefined

    await user.save()

    res.json({
      success: true,
      message: "Password reset successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
      error: error.message,
    })
  }
}

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const token = generateToken(req.user._id)

    res.json({
      success: true,
      message: "Token refreshed successfully",
      data: { token },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to refresh token",
      error: error.message,
    })
  }
}

// Logout
const logout = async (req, res) => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // Here we can add token to blacklist if needed
    res.json({
      success: true,
      message: "Logged out successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Logout failed",
      error: error.message,
    })
  }
}

// Login
const login = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => `${err.param}: ${err.msg}`).join("; ")
      return res.status(400).json({
        success: false,
        message: `Validation failed: ${errorMessages}`,
        errors: errors.array(),
      })
    }

    const { email, password } = req.body

    const user = await User.findOne({ email }).select("+password")
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      })
    }

    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      })
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated. Please contact support.",
      })
    }

    user.lastLogin = new Date()
    user.loginCount += 1
    await user.save()

    const token = generateToken(user._id)

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          gender: user.gender, // NEW
          tailorType: user.tailorType, // NEW
          isVerified: user.isVerified,
          subscription: user.subscription,
        },
        token,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    })
  }
}

module.exports = {
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
}
