const mongoose = require("mongoose")

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ["Basic", "Silver", "Gold"],
    },
    displayName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    duration: {
      type: Number, // Duration in days
      required: true,
      min: 1,
    },
    features: {
      listingLimit: {
        type: Number,
        default: 2,
      },
      visibility: {
        type: String,
        enum: ["city", "state", "national"],
        default: "city",
      },
      analytics: {
        type: Boolean,
        default: false,
      },
      prioritySupport: {
        type: Boolean,
        default: false,
      },
      customBranding: {
        type: Boolean,
        default: false,
      },
      bulkOrders: {
        type: Boolean,
        default: false,
      },
      advancedReports: {
        type: Boolean,
        default: false,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    popularPlan: {
      type: Boolean,
      default: false,
    },
    color: {
      type: String,
      default: "#3B82F6",
    },
  },
  {
    timestamps: true,
  },
)

// Index for efficient queries
subscriptionPlanSchema.index({ name: 1 })
subscriptionPlanSchema.index({ isActive: 1 })
subscriptionPlanSchema.index({ displayOrder: 1 })

module.exports = mongoose.model("SubscriptionPlan", subscriptionPlanSchema)
