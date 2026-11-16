import "../config/environment.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import { mongoConnection } from "../config/connections.js";

// Grant access to an existing account. Never delete a user or reset a password.
const emailFlag = process.argv.find((argument) =>
  argument.startsWith("--email="),
);
const email = emailFlag?.slice("--email=".length).trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(
    "Usage: npm run admin:grant -- --email=your-existing-account@example.com",
  );
  process.exitCode = 1;
} else {
  try {
    await mongoose.connect(mongoConnection().value, {
      serverSelectionTimeoutMS: 10000,
    });
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { role: "admin" } },
      { new: true },
    ).select("name email role");
    if (!user) {
      console.error(
        "No registered account found for that email. Register first, then run this command.",
      );
      process.exitCode = 1;
    } else
      console.log(
        JSON.stringify({
          email: user.email,
          role: user.role,
          password: "unchanged",
          nextStep: "Sign out, then sign in with your existing password.",
        }),
      );
  } catch (error) {
    console.error(
      `Admin access could not be updated (${error.code || error.name}). Run npm run diagnose -- --auth.`,
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
