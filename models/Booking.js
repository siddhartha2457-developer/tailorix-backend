const mongoose = require("mongoose")

const bookingSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tailorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    services: [
      {
        name: {
          type: String,
          required: true,
        },
        description: String,
        price: Number,
        quantity: {
          type: Number,
          default: 1,
        },
        measurements: {
          chest: Number,
          waist: Number,
          hip: Number,
          shoulder: Number,
          length: Number,
          sleeve: Number,
          // Add more measurements as needed
        },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "in_progress", "completed", "cancelled", "delivered"],
      default: "pending",
    },
    preferredDate: Date,
    preferredTime: String,
    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String,
    },
    pickupRequired: {
      type: Boolean,
      default: false,
    },
    pickupAddress: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String,
    },
    customerNotes: String,
    tailorNotes: String,

    // Pricing details
    subtotal: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    rushCharges: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },

    // Status tracking
    acceptedAt: Date,
    rejectedAt: Date,
    startedAt: Date,
    completedAt: Date,
    deliveredAt: Date,

    // Cancellation details
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancelledAt: Date,
    cancellationReason: String,

    // Customer rating and review
    customerRating: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      review: String,
      ratedAt: Date,
    },

    // Tailor rating for customer (optional)
    tailorRating: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      review: String,
      ratedAt: Date,
    },

    // Images
    referenceImages: [String], // Customer provided reference images
    beforeImages: [String], // Tailor's before work images
    afterImages: [String], // Tailor's after work images

    // Communication
    messages: [
      {
        senderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        message: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        isRead: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // Metadata
    urgentOrder: {
      type: Boolean,
      default: false,
    },
    estimatedDelivery: Date,
    actualDelivery: Date,
  },
  {
    timestamps: true,
  },
)

// Indexes for efficient queries
bookingSchema.index({ customerId: 1, createdAt: -1 })
bookingSchema.index({ tailorId: 1, createdAt: -1 })
bookingSchema.index({ status: 1 })
bookingSchema.index({ preferredDate: 1 })
bookingSchema.index({ "customerRating.rating": 1 })

// Virtual for booking duration
bookingSchema.virtual("duration").get(function () {
  if (this.completedAt && this.acceptedAt) {
    return Math.ceil((this.completedAt - this.acceptedAt) / (1000 * 60 * 60 * 24)) // Days
  }
  return null
})

// Method to check if booking can be cancelled
bookingSchema.methods.canBeCancelled = function () {
  return ["pending", "accepted"].includes(this.status)
}

// Method to check if booking can be rated
bookingSchema.methods.canBeRated = function () {
  return this.status === "completed" && !this.customerRating.rating
}

module.exports = mongoose.model("Booking", bookingSchema)
