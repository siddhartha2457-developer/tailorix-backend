const Booking = require("../models/Booking")
const User = require("../models/User")
const { sendEmail } = require("../utils/sendEmail")

// Create booking (shared between customer and tailor controllers)


const createBooking = async (req, res) => {
  try {
    const {
      tailorId,
      customerId,
      services,
      preferredDate,
      preferredTime,
      deliveryAddress,
      pickupRequired,
      pickupAddress,
      customerNotes,
      subtotal,
      tax,
      rushCharges,
      totalAmount,
    } = req.body;

    // Use authenticated user as customer if not provided
    const finalCustomerId = customerId || req.user.id;

    // Validate tailor
    const tailor = await User.findOne({
      _id: tailorId,
      role: "tailor",
      isActive: true,
      "subscription.isActive": true,
    });

    if (!tailor) {
      return res.status(404).json({
        success: false,
        message: "Tailor not found or not available for bookings",
      });
    }

    // Conditional price calculation (from second code)
    let calculatedSubtotal = subtotal || 0;
    let calculatedTotalAmount = totalAmount || 0;

    if (!subtotal || subtotal === 0) {
      calculatedSubtotal = services.reduce((total, service) => {
        return total + service.price * (service.quantity || 1);
      }, 0);
    }

    const finalTax = tax || 0;
    const finalRushCharges = rushCharges || 0;
    calculatedTotalAmount = calculatedSubtotal + finalTax + finalRushCharges;

    // Create booking
    const booking = new Booking({
      customerId: finalCustomerId,
      tailorId,
      services,
      preferredDate: new Date(preferredDate),
      preferredTime,
      deliveryAddress,
      pickupRequired,
      pickupAddress,
      customerNotes,
      subtotal: calculatedSubtotal,
      tax: finalTax,
      rushCharges: finalRushCharges,
      totalAmount: calculatedTotalAmount,
    });

    await booking.save();

    // Populate customer and tailor info
    await booking.populate([
      { path: "customerId", select: "firstName lastName email phone" },
      { path: "tailorId", select: "firstName lastName businessName email phone" },
    ]);

    // Send notification emails
    try {
      const customer = await User.findById(finalCustomerId);

      // Email to customer
      await sendEmail({
        to: customer.email,
        subject: "Booking Request Submitted - Tailorix",
        template: "bookingConfirmation",
        data: {
          customerName: customer.firstName,
          tailorName: tailor.businessName || tailor.firstName,
          bookingId: booking._id,
          services: services.map((s) => s.name).join(", "),
          preferredDate: new Date(preferredDate).toLocaleDateString(),
          preferredTime,
        },
      });

      // Email to tailor
      await sendEmail({
        to: tailor.email,
        subject: "New Booking Request - Tailorix",
        template: "newBookingRequest",
        data: {
          tailorName: tailor.firstName,
          customerName: customer.fullName,
          bookingId: booking._id,
          services: services.map((s) => s.name).join(", "),
          preferredDate: new Date(preferredDate).toLocaleDateString(),
          preferredTime,
          customerPhone: customer.phone,
        },
      });
    } catch (emailError) {
      console.error("Email notification failed:", emailError);
    }

    res.status(201).json({
      success: true,
      message: "Booking request submitted successfully. The tailor will contact you soon.",
      data: { booking },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: error.message,
    });
  }
};


// Get bookings
const getBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query
    const skip = (page - 1) * limit

    // Build filter based on user role
    const filter = {}
    if (req.user.role === "customer") {
      filter.customerId = req.user._id
    } else if (req.user.role === "tailor") {
      filter.tailorId = req.user._id
    }
    // Admin can see all bookings

    if (status) {
      const statuses = status.split(",").map((s) => s.trim().toLowerCase())
      filter.status = { $in: statuses }
    }

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate("customerId", "firstName lastName email phone")
        .populate("tailorId", "firstName lastName businessName email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number.parseInt(limit)),
      Booking.countDocuments(filter),
    ])

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          current: Number.parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message,
    })
  }
}

// Get booking details
const getBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params

    // Build filter based on user role
    const filter = { _id: bookingId }
    if (req.user.role === "customer") {
      filter.customerId = req.user._id
    } else if (req.user.role === "tailor") {
      filter.tailorId = req.user._id
    }
    // Admin can see any booking

    const booking = await Booking.findOne(filter)
      .populate("customerId", "firstName lastName email phone address")
      .populate("tailorId", "firstName lastName businessName email phone businessAddress")

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      })
    }

    res.json({
      success: true,
      data: { booking },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking details",
      error: error.message,
    })
  }
}

// Update booking status
const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params
    const { status, notes } = req.body

    const validStatuses = ["accepted", "rejected", "in_progress", "completed", "cancelled", "Delivered"]

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      })
    }

    // Build filter based on user role
    const filter = { _id: bookingId }
    if (req.user.role === "tailor") {
      filter.tailorId = req.user._id
    }
    // Admin can update any booking

    const booking = await Booking.findOne(filter)

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      })
    }

    // Update booking
    booking.status = status

    if (req.user.role === "tailor") {
      booking.tailorNotes = notes
    } else if (req.user.role === "admin") {
      booking.adminNotes = notes
    }

    // Set dates based on status
    if (status === "accepted") {
      booking.actualStartDate = new Date()
    } else if (status === "completed") {
      booking.deliveryDate = new Date()

      // Update tailor's stats
      if (req.user.role === "tailor") {
        await User.findByIdAndUpdate(req.user._id, {
          $inc: {
            totalOrders: 1,
            totalEarnings: booking.totalAmount,
          },
        })
      }
    }

    await booking.save()

    // Populate for response
    await booking.populate([
      { path: "customerId", select: "firstName lastName email phone" },
      { path: "tailorId", select: "firstName lastName businessName email phone" },
    ])

    // Send notification emails
    try {
      if (status === "accepted") {
        await sendEmail({
          to: booking.customerId.email,
          subject: "Booking Accepted - Tailorix",
          template: "bookingAccepted",
          data: {
            customerName: booking.customerId.firstName,
            tailorName: booking.tailorId.businessName || booking.tailorId.firstName,
            bookingId: booking._id,
          },
        })
      } else if (status === "completed") {
        await sendEmail({
          to: booking.customerId.email,
          subject: "Order Completed - Tailorix",
          template: "orderCompleted",
          data: {
            customerName: booking.customerId.firstName,
            tailorName: booking.tailorId.businessName || booking.tailorId.firstName,
            bookingId: booking._id,
          },
        })
      }
    } catch (emailError) {
      console.error("Email notification failed:", emailError)
    }

    res.json({
      success: true,
      message: "Booking status updated successfully",
      data: { booking },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update booking status",
      error: error.message,
    })
  }
}

// Cancel booking
const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params
    const { reason } = req.body

    // Build filter based on user role
    const filter = { _id: bookingId }
    if (req.user.role === "customer") {
      filter.customerId = req.user._id
    } else if (req.user.role === "tailor") {
      filter.tailorId = req.user._id
    }
    // Admin can cancel any booking

    const booking = await Booking.findOne({
      ...filter,
      status: { $in: ["pending", "accepted"] },
    })

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or cannot be cancelled",
      })
    }

    booking.status = "cancelled"
    booking.cancellationReason = reason
    booking.cancelledBy = req.user._id
    booking.cancelledAt = new Date()

    await booking.save()

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      data: { booking },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to cancel booking",
      error: error.message,
    })
  }
}

// Upload progress images
const uploadProgressImages = async (req, res) => {
  try {
    const { bookingId } = req.params

    const booking = await Booking.findOne({
      _id: bookingId,
      tailorId: req.user._id,
    })

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      })
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No images uploaded",
      })
    }

    // Add image paths to booking
    const imagePaths = req.files.map((file) => file.path)
    booking.progressImages = [...(booking.progressImages || []), ...imagePaths]

    await booking.save()

    res.json({
      success: true,
      message: "Progress images uploaded successfully",
      data: {
        booking,
        uploadedImages: imagePaths,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to upload progress images",
      error: error.message,
    })
  }
}

// Update booking (not implemented)
const updateBooking = (req, res) => {
  res.status(501).json({ success: false, message: "Not implemented" })
}

module.exports = {
  createBooking,
  getBookings,
  getBookingDetails,
  updateBookingStatus,
  cancelBooking,
  uploadProgressImages,
  updateBooking,
}
