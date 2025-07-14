const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const helmet = require("helmet")
const compression = require("compression")
const rateLimit = require("express-rate-limit")
require("dotenv").config()

// Import routes
const authRoutes = require("./routes/auth")
const tailorRoutes = require("./routes/tailor")
const customerRoutes = require("./routes/customer")
const adminRoutes = require("./routes/admin")
const adminControllerRoutes = require("./routes/adminroutes") 
const paymentRoutes = require("./routes/payment")
const publicRoutes = require("./routes/public")
// const paymentRoutes = require("./routes/payment")
const bookingRoutes = require("./routes/booking")
const favoriteRoutes = require("./routes/favorites") // Add favorites routes
const tailorListRoutes = require("./routes/tailors") // Add tailor list routes

// Import middleware
const errorHandler = require("./middleware/errorHandler")

// Import utils
const { createAdminUser } = require("./utils/createAdmin")
const { startCronJobs } = require("./utils/cronJobs")

const app = express()

// Security middleware
app.use(helmet())
app.use(compression())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})
app.use("/api/", limiter)

// CORS configuration
// app.use(
//   cors({
//     origin: process.env.FRONTEND_URL || "http://localhost:3000",
//     credentials: true,
//   }),
// )

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173','http://localhost:5000'], // Add your frontend URLs
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// 👉 Serve uploads folder
// app.use("/uploads", express.static("uploads"))
// Serve static files with proper headers
app.use('/uploads', express.static('uploads', {
  setHeaders: (res, path) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}));

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/tailor", tailorRoutes)
app.use("/api/customer", customerRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/admin", adminControllerRoutes) 
app.use("/api/payment", paymentRoutes)
app.use("/api/bookings", bookingRoutes)
// app.use("/api/payment", paymentRoutes)
app.use("/api/public", publicRoutes)
app.use("/api/favorites", favoriteRoutes) // Add favorites routes
app.use("/api/tailors", tailorListRoutes) // Add tailor list routes

// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Tailorix API is running",
    timestamp: new Date().toISOString(),
  })
})

// Error handling middleware
app.use(errorHandler)

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  })
})

// Database connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("Connected to MongoDB")

    // Create admin user if it doesn't exist
    await createAdminUser()

    // Start cron jobs
    startCronJobs()
  })
  .catch((error) => {
    console.error("Database connection error:", error)
    process.exit(1)
  })

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV}`)
})

module.exports = app
