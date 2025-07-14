const cron = require("node-cron")
const User = require("../models/User")
const { sendEmail } = require("./sendEmail")

// Check and deactivate expired subscriptions
const checkExpiredSubscriptions = async () => {
  try {
    const now = new Date()

    // Find users with expired subscriptions
    const expiredUsers = await User.find({
      role: "tailor",
      "subscription.isActive": true,
      "subscription.endDate": { $lt: now },
    })

    for (const user of expiredUsers) {
      // Deactivate subscription
      user.subscription.isActive = false
      await user.save()

      // Send notification email
      try {
        await sendEmail({
          to: user.email,
          subject: "Subscription Expired - Tailorix",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc3545;">Subscription Expired</h2>
              <p>Hi ${user.firstName},</p>
              <p>Your Tailorix subscription has expired. To continue receiving bookings, please renew your subscription.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL}/subscription" 
                   style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Renew Subscription
                </a>
              </div>
              <p>Best regards,<br>The Tailorix Team</p>
            </div>
          `,
        })
      } catch (emailError) {
        console.error("Failed to send expiration email:", emailError)
      }
    }

    if (expiredUsers.length > 0) {
      console.log(`Deactivated ${expiredUsers.length} expired subscriptions`)
    }
  } catch (error) {
    console.error("Error checking expired subscriptions:", error)
  }
}

// Send subscription renewal reminders
const sendRenewalReminders = async () => {
  try {
    const reminderDate = new Date()
    reminderDate.setDate(reminderDate.getDate() + 3) // 3 days before expiry

    const usersToRemind = await User.find({
      role: "tailor",
      "subscription.isActive": true,
      "subscription.endDate": {
        $gte: new Date(),
        $lte: reminderDate,
      },
    })

    for (const user of usersToRemind) {
      try {
        await sendEmail({
          to: user.email,
          subject: "Subscription Expiring Soon - Tailorix",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ffc107;">Subscription Expiring Soon</h2>
              <p>Hi ${user.firstName},</p>
              <p>Your Tailorix subscription will expire on ${user.subscription.endDate.toLocaleDateString()}.</p>
              <p>Renew now to continue receiving bookings without interruption.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL}/subscription" 
                   style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Renew Now
                </a>
              </div>
              <p>Best regards,<br>The Tailorix Team</p>
            </div>
          `,
        })
      } catch (emailError) {
        console.error("Failed to send renewal reminder:", emailError)
      }
    }

    if (usersToRemind.length > 0) {
      console.log(`Sent renewal reminders to ${usersToRemind.length} users`)
    }
  } catch (error) {
    console.error("Error sending renewal reminders:", error)
  }
}

// Start cron jobs
const startCronJobs = () => {
  // Check expired subscriptions every day at 2 AM
  cron.schedule("0 2 * * *", checkExpiredSubscriptions)

  // Send renewal reminders every day at 10 AM
  cron.schedule("0 10 * * *", sendRenewalReminders)

  console.log("Cron jobs started successfully")
}

module.exports = {
  startCronJobs,
  checkExpiredSubscriptions,
  sendRenewalReminders,
}
