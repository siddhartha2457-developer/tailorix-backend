const User = require("../models/User")

const createAdminUser = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: "admin" })

    if (existingAdmin) {
      console.log("Admin user already exists")
      return
    }

    // Create admin user
    const adminUser = new User({
      firstName: "Admin",
      lastName: "User",
      email: process.env.ADMIN_EMAIL || "admin@tailorix.com",
      password: process.env.ADMIN_PASSWORD || "Admin@123",
      phone: "9999999999",
      role: "admin",
      isActive: true,
      isVerified: true,
    })

    await adminUser.save()
    console.log("Admin user created successfully")
    console.log(`Email: ${adminUser.email}`)
    console.log(`Password: ${process.env.ADMIN_PASSWORD || "Admin@123"}`)
  } catch (error) {
    console.error("Error creating admin user:", error)
  }
}

module.exports = { createAdminUser }
