import test from "node:test";
import assert from "node:assert/strict";
import User from "../src/models/User.js";
import { updateProfile } from "../src/controllers/profileController.js";

test("manual profile edits keep match skills and vault skills in sync", async () => {
  const original = User.findById;
  const user = {
    _id: "test-user",
    name: "Alex",
    email: "alex@example.test",
    role: "candidate",
    skills: ["Outdated skill"],
    profileVault: { skills: ["Outdated skill"], contactDetails: {} },
    async save() {},
  };
  User.findById = async () => user;
  const update = (body) =>
    new Promise((resolve, reject) =>
      updateProfile(
        { user: { id: "test-user" }, body },
        {
          status(code) {
            assert.equal(code, 200);
            return this;
          },
          json: resolve,
        },
        reject,
      ),
    );
  try {
    const result = await update({
      skills: JSON.stringify([" React ", "TypeScript", ""]),
    });
    assert.deepEqual(user.skills, ["React", "TypeScript"]);
    assert.deepEqual(result.data.user.skills, user.profileVault.skills);
    await update({ skills: "[]" });
    assert.deepEqual(user.skills, []);
    user.skills = ["React"];
    user.profileVault.skills = ["React"];
    await update({ name: "Alex Morgan" });
    assert.deepEqual(user.skills, ["React"]);
  } finally {
    User.findById = original;
  }
});
