const mongoose = require("mongoose")

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    gateway: {
      type: String,
      enum: ["razorpay", "stripe", "paytm"],
      default: "razorpay",
    },
    gatewayOrderId: {
      type: String,
      required: true,
    },
    gatewayPaymentId: String,
    paymentId: String,
    signature: String,
    status: {
      type: String,
      enum: ["pending", "success", "failed", "refunded"],
      default: "pending",
    },
    purpose: {
      type: String,
      enum: ["subscription", "booking", "service"],
      required: true,
    },
    subscriptionPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },

    // Payment timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },
    paidAt: Date,
    failedAt: Date,
    refundedAt: Date,

    // Failure details
    failureReason: String,
    failureCode: String,

    // Refund details
    refundAmount: Number,
    refundReason: String,
    refundId: String,

    // Metadata
    metadata: {
      planName: String,
      planDuration: Number,
      userEmail: String,
      userName: String,
      ipAddress: String,
      userAgent: String,
    },

    // Webhook data
    webhookData: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
  },
)

// Indexes for efficient queries
paymentSchema.index({ userId: 1, createdAt: -1 })
paymentSchema.index({ orderId: 1 })
paymentSchema.index({ gatewayOrderId: 1 })
paymentSchema.index({ gatewayPaymentId: 1 })
paymentSchema.index({ status: 1 })
paymentSchema.index({ purpose: 1 })

// Virtual for payment age
paymentSchema.virtual("age").get(function () {
  return Date.now() - this.createdAt
})

// Method to check if payment is successful
paymentSchema.methods.isSuccessful = function () {
  return this.status === "success"
}

// Method to check if payment can be refunded
paymentSchema.methods.canBeRefunded = function () {
  return this.status === "success" && !this.refundedAt
}

module.exports = mongoose.model("Payment", paymentSchema)
