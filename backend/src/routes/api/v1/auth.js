import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  register,
  login,
  refresh,
  logout,
} from "../../../controllers/authController.js";
import {
  getProfile,
  updateProfile,
} from "../../../controllers/profileController.js";
import { protect } from "../../../middlewares/authMiddleware.js";
import { resumeDirectory } from "../../../config/paths.js";

const router = express.Router();

// Ensure upload directory exists
const uploadDir = resumeDirectory;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage engine configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

// Configure upload restrictions
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExts = [".pdf", ".doc", ".docx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOC, and DOCX files are allowed."));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);

// Profile Vault routes
router.get("/profile", protect, getProfile);
router.put("/profile", protect, upload.single("resume"), updateProfile);

export default router;
