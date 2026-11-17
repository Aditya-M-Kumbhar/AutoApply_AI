import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfModule = require("pdf-parse");

const pdf = async (dataBuffer) => {
  const uint8 = new Uint8Array(dataBuffer);
  const parser = new pdfModule.PDFParse({ data: uint8 });
  try {
    return await parser.getText();
  } finally {
    await parser.destroy();
  }
};
import { protect } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../middlewares/errorMiddleware.js";
import { generateText } from "../services/aiService.js";
import { extractResumeSkills } from "../services/resumeSkills.js";
import User from "../models/User.js";
import logger from "../config/logger.js";
import { trie } from "../utils/trieEngine.js";
import { getLearningPath } from "../utils/skillGraph.js";
import { resumeDirectory } from "../config/paths.js";

const router = express.Router();

const uploadDir = resumeDirectory;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExts = [".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed for resume parsing."));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// POST /api/profile/parse-resume - parses uploaded PDF and auto-populates skills array
router.post(
  "/parse-resume",
  protect,
  upload.single("resume"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ status: "error", message: "No resume file uploaded." });
    }

    logger.info(`Parsing uploaded resume PDF for user: ${req.user.id}`);

    try {
      const dataBuffer = fs.readFileSync(req.file.path);
      const parsedPdf = await pdf(dataBuffer);
      const pdfText = parsedPdf.text || "";

      if (!pdfText.trim()) {
        return res.status(400).json({
          status: "error",
          message: "Unable to extract text from the PDF file.",
        });
      }

      const extraction = await extractResumeSkills(pdfText, {
        useAI: process.env.RESUME_AI_ENRICHMENT === "true",
        generate: generateText,
        onFallback: () => logger.warn("Resume AI enrichment unavailable; using local skill extraction."),
      });
      let skills = extraction.skills;

      // Update user profile in Mongoose
      const user = await User.findById(req.user.id);
      if (!user) {
        return res
          .status(404)
          .json({ status: "error", message: "User not found." });
      }

      // A resume without recognized dictionary skills must not erase manual skills.
      if (!skills.length) skills = user.skills || [];

      // Set root skills and profileVault skills
      user.skills = skills;
      if (!user.profileVault) {
        user.profileVault = {
          skills: [],
          experience: [],
          contactDetails: {},
          resumePath: "",
        };
      }
      user.profileVault.skills = skills;
      user.profileVault.resumePath = req.file.path;

      await user.save();

      logger.info(
        `Successfully parsed resume and saved ${skills.length} skills for user: ${user._id}`,
      );

      res.status(200).json({
        status: "success",
        message: "Resume parsed and skills updated successfully.",
        data: {
          skills,
          resumePath: req.file.path,
          extractionMethod: extraction.method,
        },
      });
    } catch (error) {
      logger.error(`Error parsing resume PDF: ${error.message}`);
      res.status(500).json({
        status: "error",
        message: "Unable to process this resume. Upload a text-based PDF, or add your skills manually and try again later.",
      });
    }
  }),
);

// GET /api/profile/skill-autocomplete?prefix=re
router.get("/skill-autocomplete", protect, (req, res) => {
  const { prefix } = req.query;
  if (!prefix || prefix.length < 1) return res.json([]);
  const suggestions = trie.search(prefix);
  res.json(suggestions);
});

// POST /api/profile/learning-path
// Body: { targetSkills: ['system design', 'kubernetes'], userSkills: ['docker', 'javascript'] }
router.post("/learning-path", protect, (req, res) => {
  const { targetSkills, userSkills } = req.body;
  const path = getLearningPath(targetSkills, userSkills);
  res.json({
    missingSkills: path,
    message: `Learn these ${path.length} skills to qualify`,
  });
});

export default router;
