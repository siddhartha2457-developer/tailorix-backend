const nodemailer = require("nodemailer")
const fs = require("fs")
const path = require("path")

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })
}

// Email templates
const emailTemplates = {
  emailVerificationOTP: {
    subject: "Verify Your Email - Tailorix",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin-bottom: 10px;">Welcome to Tailorix!</h1>
          <p style="color: #666; font-size: 16px;">Verify your email address with OTP</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h2 style="color: #333; margin-bottom: 15px;">Hi ${data.name},</h2>
          <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
            Thank you for registering with Tailorix! To complete your registration and start using our platform, 
            please verify your email address using the OTP below.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; display: inline-block; margin: 20px 0;">
              <h1 style="margin: 0; font-size: 36px; letter-spacing: 8px; font-weight: bold;">${data.otp}</h1>
            </div>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 20px; text-align: center;">
            <strong>This OTP is valid for 10 minutes only.</strong>
          </p>
          
          <p style="color: #666; font-size: 14px; text-align: center;">
            Enter this OTP in the verification form to complete your registration.
          </p>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; text-align: center;">
          <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
            If you didn't create an account with Tailorix, please ignore this email.
          </p>
          <p style="color: #666; font-size: 14px;">
            For security reasons, do not share this OTP with anyone.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            Best regards,<br>
            <strong>The Tailorix Team</strong>
          </p>
        </div>
      </div>
    `,
  },
  passwordReset: {
    subject: "Password Reset - Tailorix",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hi ${data.name},</p>
        <p>You requested to reset your password. Click the button below to reset it:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.resetLink}" 
             style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>This link will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>The Tailorix Team</p>
      </div>
    `,
  },
  bookingConfirmation: {
    subject: "Booking Request Submitted - Tailorix",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Booking Request Submitted</h2>
        <p>Hi ${data.customerName},</p>
        <p>Your booking request has been submitted successfully!</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Booking Details:</h3>
          <p><strong>Booking ID:</strong> ${data.bookingId}</p>
          <p><strong>Tailor:</strong> ${data.tailorName}</p>
          <p><strong>Services:</strong> ${data.services}</p>
          <p><strong>Preferred Date:</strong> ${data.preferredDate}</p>
          <p><strong>Preferred Time:</strong> ${data.preferredTime}</p>
        </div>
        <p>The tailor will contact you soon to confirm the booking.</p>
        <p>Best regards,<br>The Tailorix Team</p>
      </div>
    `,
  },
  newBookingRequest: {
    subject: "New Booking Request - Tailorix",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Booking Request</h2>
        <p>Hi ${data.tailorName},</p>
        <p>You have received a new booking request!</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Booking Details:</h3>
          <p><strong>Booking ID:</strong> ${data.bookingId}</p>
          <p><strong>Customer:</strong> ${data.customerName}</p>
          <p><strong>Phone:</strong> ${data.customerPhone}</p>
          <p><strong>Services:</strong> ${data.services}</p>
          <p><strong>Preferred Date:</strong> ${data.preferredDate}</p>
          <p><strong>Preferred Time:</strong> ${data.preferredTime}</p>
        </div>
        <p>Please log in to your dashboard to accept or reject this booking.</p>
        <p>Best regards,<br>The Tailorix Team</p>
      </div>
    `,
  },
  bookingAccepted: {
    subject: "Booking Accepted - Tailorix",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">Booking Accepted!</h2>
        <p>Hi ${data.customerName},</p>
        <p>Great news! Your booking has been accepted by ${data.tailorName}.</p>
        <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Booking ID:</strong> ${data.bookingId}</p>
          <p>The tailor will contact you soon to discuss further details.</p>
        </div>
        <p>Best regards,<br>The Tailorix Team</p>
      </div>
    `,
  },
  orderCompleted: {
    subject: "Order Completed - Tailorix",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">Order Completed!</h2>
        <p>Hi ${data.customerName},</p>
        <p>Your order has been completed by ${data.tailorName}.</p>
        <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Booking ID:</strong> ${data.bookingId}</p>
          <p>Please rate your experience to help other customers.</p>
        </div>
        <p>Thank you for using Tailorix!</p>
        <p>Best regards,<br>The Tailorix Team</p>
      </div>
    `,
  },
  bookingCancelled: {
    subject: "Booking Cancelled - Tailorix",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">Booking Cancelled</h2>
        <p>Hi ${data.tailorName},</p>
        <p>A booking has been cancelled by ${data.customerName}.</p>
        <div style="background-color: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Booking ID:</strong> ${data.bookingId}</p>
          <p><strong>Reason:</strong> ${data.reason}</p>
        </div>
        <p>Best regards,<br>The Tailorix Team</p>
      </div>
    `,
  },
}

// Send email function
const sendEmail = async ({ to, subject, template, data, html, text }) => {
  try {
    const transporter = createTransporter()

    let emailContent = {}

    if (template && emailTemplates[template]) {
      emailContent = {
        subject: emailTemplates[template].subject,
        html: emailTemplates[template].html(data),
      }
    } else if (html || text) {
      emailContent = { subject, html, text }
    } else {
      throw new Error("No email content provided")
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    }

    const result = await transporter.sendMail(mailOptions)
    console.log("Email sent successfully:", result.messageId)
    return result
  } catch (error) {
    console.error("Email sending failed:", error)
    throw error
  }
}

// Send bulk emails
const sendBulkEmails = async (emails) => {
  const results = []

  for (const email of emails) {
    try {
      const result = await sendEmail(email)
      results.push({ success: true, to: email.to, messageId: result.messageId })
    } catch (error) {
      results.push({ success: false, to: email.to, error: error.message })
    }
  }

  return results
}

module.exports = {
  sendEmail,
  sendBulkEmails,
}
