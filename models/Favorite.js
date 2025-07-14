const mongoose = require("mongoose")

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tailorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Compound index to prevent duplicate favorites and improve query performance
favoriteSchema.index({ userId: 1, tailorId: 1 }, { unique: true })
favoriteSchema.index({ userId: 1 })
favoriteSchema.index({ tailorId: 1 })

module.exports = mongoose.model("Favorite", favoriteSchema)
