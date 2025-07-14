const multer = require("multer")
const path = require("path")
const fs = require("fs")

// Ensure upload directories exist
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = "uploads/"

    // Determine upload path based on file field name
    switch (file.fieldname) {
      case "profileImage":
        uploadPath += "profiles/"
        break
      case "aadhaarFront":
      case "aadhaarBack":
      case "businessLicense":
        uploadPath += "documents/"
        break
      case "workPhotos":
        uploadPath += "work-photos/"
        break
      case "beforeImages":
      case "afterImages":
      case "referenceImages":
        uploadPath += "bookings/"
        break
      default:
        uploadPath += "misc/"
    }

    ensureDirectoryExists(uploadPath)
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const extension = path.extname(file.originalname)
    const baseName = path.basename(file.originalname, extension)
    cb(null, `${baseName}-${uniqueSuffix}${extension}`)
  },
})

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = {
    image: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
    document: ["application/pdf", "image/jpeg", "image/jpg", "image/png"],
  }

  let isAllowed = false

  // Check based on field name
  if (["profileImage", "workPhotos", "beforeImages", "afterImages", "referenceImages"].includes(file.fieldname)) {
    isAllowed = allowedTypes.image.includes(file.mimetype)
  } else if (["aadhaarFront", "aadhaarBack", "businessLicense"].includes(file.fieldname)) {
    isAllowed = allowedTypes.document.includes(file.mimetype)
  }

  if (isAllowed) {
    cb(null, true)
  } else {
    cb(
      new Error(
        `Invalid file type for ${file.fieldname}. Allowed types: ${
          file.fieldname.includes("Image") || file.fieldname === "workPhotos"
            ? "JPEG, PNG, GIF, WebP"
            : "PDF, JPEG, PNG"
        }`,
      ),
      false,
    )
  }
}

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10, // Maximum 10 files per request
  },
})

// Middleware for different upload scenarios
const uploadMiddleware = {
  // Single profile image
  profileImage: upload.single("profileImage"),
    // Add this line 👇
  profilePhotos: upload.array("photos", 5),

  // Document uploads for tailors
  documents: upload.fields([
    { name: "aadhaarFront", maxCount: 1 },
    { name: "aadhaarBack", maxCount: 1 },
    { name: "businessLicense", maxCount: 1 },
  ]),

  // Work photos for tailors (max 3) - This is the key fix
  workPhotos: upload.array("workPhotos", 3),

  // Booking related images
  bookingImages: upload.fields([
    { name: "beforeImages", maxCount: 5 },
    { name: "afterImages", maxCount: 5 },
    { name: "referenceImages", maxCount: 5 },
  ]),

  // Multiple images for any purpose
  multipleImages: upload.array("images", 10),

  // Any single file
  singleFile: upload.single("file"),
}

// Error handling middleware
const handleUploadError = (error, req, res, next) => {
  console.log("[UPLOAD MIDDLEWARE] Error occurred:", error.message)
  console.log("[UPLOAD MIDDLEWARE] Error code:", error.code)

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size allowed is 5MB.",
      })
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files. Maximum allowed files exceeded.",
      })
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: `Unexpected file field: ${error.field}. Please use field name: workPhotos`,
      })
    }
  }

  if (error.message.includes("Invalid file type")) {
    return res.status(400).json({
      success: false,
      message: error.message,
    })
  }

  next(error)
}

module.exports = {
  upload,
  uploadMiddleware,
  handleUploadError,
}
