// Script to update existing users with new gender and tailorType fields
const mongoose = require("mongoose")
require("dotenv").config()

const User = require("../models/User")

const updateExistingUsersWithNewFields = async () => {
  try {
    console.log("Connecting to MongoDB...")
    await mongoose.connect(process.env.MONGO_URI)
    console.log("Connected to MongoDB")

    // Find users without gender field
    const usersWithoutGender = await User.find({
      gender: { $exists: false },
    })

    console.log(`Found ${usersWithoutGender.length} users without gender field`)

    for (const user of usersWithoutGender) {
      const updates = {}

      // Set default gender based on name patterns or set as "Other"
      // You can customize this logic based on your needs
      updates.gender = "Other" // Default value

      // For tailors without tailorType, set a default
      if (user.role === "tailor" && !user.tailorType) {
        updates.tailorType = "Unisex Tailor" // Default value
      }

      if (Object.keys(updates).length > 0) {
        await User.findByIdAndUpdate(user._id, updates)
        console.log(
          `Updated user: ${user.email} with gender: ${updates.gender}${updates.tailorType ? `, tailorType: ${updates.tailorType}` : ""}`,
        )
      }
    }

    console.log("User update completed successfully")
    process.exit(0)
  } catch (error) {
    console.error("Error updating users:", error)
    process.exit(1)
  }
}

// Run the update
updateExistingUsersWithNewFields()
