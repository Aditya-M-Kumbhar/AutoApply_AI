import User from "../models/User.js";
import logger from "../config/logger.js";
import { asyncHandler } from "../middlewares/errorMiddleware.js";

export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) {
    return res.status(404).json({
      status: "error",
      code: "USER_NOT_FOUND",
      message: "User session invalid or user not found.",
    });
  }

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({
      status: "error",
      code: "USER_NOT_FOUND",
      message: "User session invalid or user not found.",
    });
  }

  const { name, email, phone, linkedin, github, website, skills } = req.body;

  if (name) user.name = name;
  if (email) user.email = email;

  // Initialize profileVault if not exist
  if (!user.profileVault) {
    user.profileVault = {
      skills: [],
      experience: [],
      contactDetails: {},
      resumePath: "",
    };
  }

  // Parse skills: can be string array or comma-separated string
  if (skills !== undefined) {
    if (Array.isArray(skills)) {
      user.profileVault.skills = skills.map((s) => s.trim()).filter(Boolean);
    } else if (typeof skills === "string") {
      try {
        const parsed = JSON.parse(skills);
        user.profileVault.skills = Array.isArray(parsed)
          ? parsed.map((s) => s.trim()).filter(Boolean)
          : parsed
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
      } catch {
        user.profileVault.skills = skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
  }

  // Keep matching and email generation consistent with manually edited skills.
  if (skills !== undefined) user.skills = [...user.profileVault.skills];

  // Set contactDetails
  if (!user.profileVault.contactDetails) {
    user.profileVault.contactDetails = {};
  }

  if (phone !== undefined)
    user.profileVault.contactDetails.phone = phone.trim();
  if (linkedin !== undefined)
    user.profileVault.contactDetails.linkedin = linkedin.trim();
  if (github !== undefined)
    user.profileVault.contactDetails.github = github.trim();
  if (website !== undefined)
    user.profileVault.contactDetails.website = website.trim();

  // If a file was uploaded, save its local path
  if (req.file) {
    user.profileVault.resumePath = req.file.path;
    logger.info(
      `Saved uploaded resume path: ${req.file.path} for user: ${user._id}`,
    );
  }

  await user.save();

  res.status(200).json({
    status: "success",
    message: "Profile configuration vault updated successfully.",
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills,
        profileVault: user.profileVault,
      },
    },
  });
});
