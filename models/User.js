const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const SubscriptionPlan = require("./SubscriptionPlan")

const addressSchema = new mongoose.Schema(
  {
    street: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{6}$/, "Please enter a valid 6-digit pincode"],
    },
    landmark: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      default: "India",
      trim: true,
    },
  },
  { _id: false },
)

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["customer", "tailor", "admin"],
      default: "customer",
    },

    // NEW: Gender field
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      required: function () {
        return this.role === "tailor" || this.role === "customer"
      },
    },

    // NEW: Tailor Type field (only for tailors)
    tailorType: {
      type: String,
      enum: [
        "Gents Tailor",
        "Ladies Tailor",
        "Kids Tailor",
        "Unisex Tailor",
        "Bridal Specialist",
        "Formal Wear Specialist",
      ],
      required: function () {
        return this.role === "tailor"
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    // OTP-based verification
    verificationOTP: String,
    verificationOTPExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,

    // Customer specific fields
    address: {
      type: addressSchema,
      required: function () {
        return this.role === "customer"
      },
    },

    // Tailor specific fields
    businessName: {
      type: String,
      required: function () {
        return this.role === "tailor"
      },
    },
    businessAddress: {
      type: addressSchema,
      required: function () {
        return this.role === "tailor"
      },
    },

    // Location field for GeoJSON coordinates
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: "2dsphere",
      },
    },

    // Enhanced profile photos system
    profilePhotos: [
      {
        url: {
          type: String,
          required: true,
        },
        filename: String,
        originalName: String,
        size: Number,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        isMain: {
          type: Boolean,
          default: false,
        },
        isPublic: {
          type: Boolean,
          default: true, // Public by default for tailor profiles
        },
      },
    ],

    // Legacy single profile image (for backward compatibility)
    profileImage: String,

    experience: {
      type: Number,
      min: 0,
    },
    specializations: [String],
    services: [
      {
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        description: String,
        category: {
          type: String,
          enum: ["stitching", "alteration", "repair", "custom"],
          default: "stitching",
        },
        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],
    workingHours: {
      monday: { start: String, end: String, isWorking: Boolean },
      tuesday: { start: String, end: String, isWorking: Boolean },
      wednesday: { start: String, end: String, isWorking: Boolean },
      thursday: { start: String, end: String, isWorking: Boolean },
      friday: { start: String, end: String, isWorking: Boolean },
      saturday: { start: String, end: String, isWorking: Boolean },
      sunday: { start: String, end: String, isWorking: Boolean },
    },
    pickupDelivery: {
      type: Boolean,
      default: false,
    },
    documents: {
      aadhaarFront: String,
      aadhaarBack: String,
      businessLicense: String,
    },
    workPhotos: [String],
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
      },
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },

    // Subscription details
    subscription: {
      planName: {
        type: String,
        enum: ["Basic", "Silver", "Gold"],
        default: "Basic",
      },
      startDate: Date,
      endDate: Date,
      isActive: {
        type: Boolean,
        default: true,
      },
      autoRenew: {
        type: Boolean,
        default: false,
      },
    },

    // Metadata
    lastLogin: Date,
    loginCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes
userSchema.index({ email: 1 })
userSchema.index({ role: 1 })
userSchema.index({ gender: 1 })
userSchema.index({ tailorType: 1 })
userSchema.index({ "address.pincode": 1 })
userSchema.index({ "businessAddress.pincode": 1 })
userSchema.index({ "address.city": 1 })
userSchema.index({ "businessAddress.city": 1 })
userSchema.index({ "subscription.isActive": 1 })
userSchema.index({ isActive: 1 })
userSchema.index({ location: "2dsphere" })

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()

  try {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

// Generate OTP method
userSchema.methods.generateVerificationOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  this.verificationOTP = otp
  this.verificationOTPExpires = new Date(Date.now() + 10 * 60 * 1000)
  return otp
}

// Verify OTP method
userSchema.methods.verifyOTP = function (inputOTP) {
  if (!this.verificationOTP || !this.verificationOTPExpires) {
    return { success: false, message: "No OTP found" }
  }

  if (new Date() > this.verificationOTPExpires) {
    return { success: false, message: "OTP has expired" }
  }

  if (this.verificationOTP !== inputOTP.toString()) {
    return { success: false, message: "Invalid OTP" }
  }

  return { success: true, message: "OTP verified successfully" }
}

// Get primary address based on role
userSchema.methods.getPrimaryAddress = function () {
  if (this.role === "tailor") {
    return this.businessAddress
  }
  return this.address
}

// Get formatted address string
userSchema.methods.getFormattedAddress = function () {
  const addr = this.getPrimaryAddress()
  if (!addr) return null

  const parts = []
  if (addr.street) parts.push(addr.street)
  if (addr.landmark) parts.push(addr.landmark)
  if (addr.city) parts.push(addr.city)
  if (addr.state) parts.push(addr.state)
  if (addr.pincode) parts.push(addr.pincode)

  return parts.join(", ")
}

// Get main profile photo
userSchema.methods.getMainProfilePhoto = function () {
  const mainPhoto = this.profilePhotos.find((photo) => photo.isMain && photo.isPublic)
  return mainPhoto ? mainPhoto.url : this.profileImage || null
}

// Get all public profile photos
userSchema.methods.getPublicProfilePhotos = function () {
  return this.profilePhotos.filter((photo) => photo.isPublic)
}

// Set main profile photo
userSchema.methods.setMainProfilePhoto = function (photoId) {
  // Remove main flag from all photos
  this.profilePhotos.forEach((photo) => {
    photo.isMain = false
  })

  // Set the specified photo as main
  const photo = this.profilePhotos.id(photoId)
  if (photo) {
    photo.isMain = true
    return true
  }
  return false
}

// Check if subscription is active
userSchema.methods.hasActiveSubscription = function () {
  if (!this.subscription.isActive) return false
  if (!this.subscription.endDate) return false
  return new Date() < this.subscription.endDate
}

// Get subscription features
userSchema.methods.getSubscriptionFeatures = async function () {
  const plan = await SubscriptionPlan.findOne({ name: this.subscription.planName })
  return plan ? plan.features : { listingLimit: 2, visibility: "city", analytics: false }
}

// Get subscription priority for sorting
userSchema.methods.getSubscriptionPriority = function () {
  const priorities = {
    Gold: 1,
    Silver: 2,
    Basic: 3,
  }
  return priorities[this.subscription.planName] || 3
}

// Get full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`
})

// Transform output
userSchema.methods.toJSON = function () {
  const user = this.toObject()
  delete user.password
  delete user.verificationOTP
  delete user.verificationOTPExpires
  delete user.resetPasswordToken
  delete user.resetPasswordExpires
  return user
}

module.exports = mongoose.model("User", userSchema)
