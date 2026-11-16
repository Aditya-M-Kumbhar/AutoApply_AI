const { chromium } = require("../../backend/node_modules/playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:5173";
const work = path.resolve(__dirname, "../../work");
const output = path.join(work, "screenshots");
fs.mkdirSync(output, { recursive: true });
const user = {
  _id: "test-user",
  name: "Alex Morgan",
  email: "alex@example.test",
  role: "candidate",
  skills: ["React", "JavaScript"],
  profileVault: { skills: ["React", "JavaScript"], contactDetails: {} },
};
const jobs = [
  {
    _id: "job-one",
    title: "Senior Product Designer",
    company: "Linear",
    location: "Remote · Europe",
    fitScore: 92,
    description:
      "Help thoughtful teams do their best work. Design intuitive experiences that bring clarity to complex projects, with a small team that cares about the details.",
    skillsRequired: ["Product design", "Figma", "Design systems"],
    sourcePlatform: "Remotive",
    applyLink: "https://example.test/careers",
    postedAt: "2026-11-15",
  },
  {
    _id: "job-two",
    title: "Frontend Engineer",
    company: "Notion",
    location: "Bengaluru, India",
    fitScore: 86,
    description:
      "Build flexible tools that make everyday work feel simpler. Bring a strong eye for design and a love for fast, accessible web experiences.",
    skillsRequired: ["React", "TypeScript", "Accessibility"],
    sourcePlatform: "The Muse",
    applyLink: "https://example.test/careers",
    postedAt: "2026-11-14",
  },
  {
    _id: "job-three",
    title: "Design Engineer",
    company: "Vercel",
    location: "Remote",
    fitScore: 78,
    description:
      "Bridge design and engineering to make the web a little more expressive. Prototype, refine, and ship polished interfaces for developers.",
    skillsRequired: ["React", "CSS", "Prototyping"],
    sourcePlatform: "Adzuna",
    applyLink: "javascript:alert(1)",
    postedAt: "2026-11-13",
  },
  {
    _id: "job-four",
    title: "UX Researcher",
    company: "Figma",
    location: "London, United Kingdom",
    fitScore: 65,
    description:
      "Bring the voice of the customer into product decisions. Work closely with designers and engineers to uncover better ways to create together.",
    skillsRequired: ["Research", "Interviews"],
    sourcePlatform: "Remotive",
    applyLink: "https://example.test/careers",
    postedAt: "2026-11-12",
  },
];
jobs[1].matchExplanation = {
  hasProfile: true,
  matchedSkills: ["react"],
  missingSkills: ["typescript", "accessibility"],
  basis: "listed-requirements",
};
let apps = [
  {
    _id: "app-one",
    jobId: jobs[0],
    status: "Applied",
    createdAt: "2026-11-15",
    updatedAt: "2026-11-15",
  },
];
let authed = false;
let failJobs = false;
let lastJobsUrl;
let savedProfile = "";
let lastEmail;
let unauthorized = false;
let adminConnects = 0;
const errors = [];
const checks = [];
const check = (name) => {
  checks.push(name);
  console.log("PASS", name);
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/v1/**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const endpoint = url.pathname.replace("/api/v1", "");
      const reply = (data, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (endpoint === "/auth/profile" && req.method() === "GET")
        return reply(
          authed ? { data: { user } } : { message: "Please sign in." },
          authed ? 200 : 401,
        );
      if (endpoint === "/auth/login" || endpoint === "/auth/register") {
        authed = true;
        return reply({ data: { user } });
      }
      if (endpoint === "/auth/logout") {
        authed = false;
        return reply({ status: "success" });
      }
      if (endpoint === "/auth/profile" && req.method() === "PUT") {
        savedProfile = req.postData();
        user.skills = ["React", "JavaScript", "TypeScript"];
        return reply({ data: { user } });
      }
      if (endpoint === "/profile/skill-autocomplete")
        return reply(["TypeScript", "TypeScript advanced"]);
      if (endpoint === "/assistant/ask") {
        const body = req.postDataJSON();
        return reply({
          data: {
            mode: body.useAI ? "generated" : "retrieval",
            abstained: body.question.includes("quantum"),
            answer: body.question.includes("quantum")
              ? "I couldn’t find supporting information in the current job catalog."
              : body.useAI
                ? "The Frontend Engineer role lists React. [S1]"
                : "Here are the closest source excerpts.",
            sources: body.question.includes("quantum")
              ? []
              : [
                  {
                    id: "S1",
                    title: "Frontend Engineer",
                    company: "Notion",
                    location: "Bengaluru, India",
                    excerpt:
                      "Build accessible interfaces with React and TypeScript.",
                    url: "https://example.test/careers",
                  },
                ],
            scope: { truncated: false },
          },
        });
      }
      if (endpoint === "/jobs") {
        lastJobsUrl = url;
        return reply(
          failJobs
            ? { message: "The job service is temporarily unavailable." }
            : {
                data: {
                  jobs: url.searchParams.get("search") === "empty" ? [] : jobs,
                  pagination: {
                    page: Number(url.searchParams.get("page") || 1),
                    pages: 3,
                    total: 48,
                  },
                },
              },
          failJobs ? 503 : 200,
        );
      }
      if (endpoint.startsWith("/applications") && unauthorized)
        return reply({ message: "Session expired." }, 401);
      if (endpoint === "/applications/test-user") return reply({ data: apps });
      if (endpoint === "/applications" && req.method() === "POST") {
        const body = req.postDataJSON();
        apps.push({
          _id: `app-${apps.length + 1}`,
          jobId: jobs.find((job) => job._id === body.jobId),
          status: body.status,
          createdAt: "2026-11-16",
          updatedAt: "2026-11-16",
        });
        return reply({ data: apps.at(-1) });
      }
      if (endpoint.endsWith("/status")) {
        const app = apps.find((app) => app._id === endpoint.split("/")[2]);
        app.status = req.postDataJSON().status;
        return reply({ data: app });
      }
      if (endpoint.startsWith("/applications/") && req.method() === "DELETE") {
        apps = apps.filter((app) => app._id !== endpoint.split("/")[2]);
        return reply({ status: "success" });
      }
      if (endpoint === "/market/trending-skills")
        return reply({
          data: [
            { _id: "React", count: 32 },
            { _id: "TypeScript", count: 27 },
            { _id: "Design systems", count: 21 },
            { _id: "Figma", count: 16 },
          ],
        });
      if (endpoint === "/market/trending-roles")
        return reply({
          data: [
            { _id: "Frontend Engineer", count: 18 },
            { _id: "Product Designer", count: 14 },
            { _id: "Design Engineer", count: 9 },
          ],
        });
      if (endpoint === "/market/source-breakdown")
        return reply({
          data: [
            { _id: "Remotive", count: 23 },
            { _id: "Adzuna", count: 16 },
            { _id: "The Muse", count: 9 },
          ],
        });
      if (endpoint === "/profile/learning-path")
        return reply({ missingSkills: ["Figma", "Design systems"] });
      if (endpoint === "/profile/parse-resume")
        return reply(
          {
            message:
              "The resume service is unavailable. Add skills manually for now.",
          },
          503,
        );
      if (endpoint === "/email/generate") {
        lastEmail = req.postDataJSON();
        return reply({
          data: {
            subject: "A thoughtful introduction",
            body: "Hello team,\n\nI’m Alex, a frontend engineer who cares about simple, useful products. I’d love to talk about your open role.\n\nBest,\nAlex",
          },
        });
      }
      if (endpoint === "/email/personalize")
        return reply(
          {
            message: "AI refinement is unavailable. Your draft is still here.",
          },
          503,
        );
      if (endpoint === "/admin/connect-real-browser") {
        adminConnects++;
        return reply({ status: "success" });
      }
      if (endpoint === "/admin/jobs")
        return reply({ data: { jobs, pagination: { pages: 1 } } });
      return reply({ message: `Unhandled fixture: ${endpoint}` }, 404);
    });
    await page.goto(base);
    await page.getByRole("heading", { name: "Welcome back." }).waitFor();
    const nightMode = page.getByRole("switch", {
      name: "Night mode",
      exact: true,
    });
    assert.equal(await nightMode.getAttribute("aria-checked"), "false");
    await nightMode.click();
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    await page.screenshot({
      path: path.join(output, "10-sign-in-night.png"),
      fullPage: true,
    });
    await page.reload();
    await page.getByRole("heading", { name: "Welcome back." }).waitFor();
    assert.equal(await nightMode.getAttribute("aria-checked"), "true");
    await nightMode.focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    check(
      "Day/night switch supports keyboard input and persists across reloads",
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(output, "01-sign-in-desktop.png"),
      fullPage: true,
    });
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
        `Auth overflow ${width}`,
      );
    }
    check("Sign-in layout fits 375 / 768 / 1024 / 1440 px");
    assert.equal(
      (await page.locator(".brand").innerText()).replace(/\s+/g, " ").trim(),
      "Auto Apply AI",
    );
    assert.match(await page.title(), /Auto Apply AI/);
    await page.getByLabel("Email address").fill("alex@example.test");
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page
      .getByRole("button", { name: "Sign in to your workspace" })
      .click();
    await page.getByRole("dialog").waitFor();
    assert.match(
      await page.getByRole("dialog").innerText(),
      /Start with your story/,
    );
    await page.getByRole("button", { name: "Next step", exact: true }).click();
    await page
      .getByRole("heading", { name: "Find a role worth exploring" })
      .waitFor();
    await page.getByRole("button", { name: "Go to step 6" }).click();
    await page
      .getByRole("heading", { name: "Make the introduction yours" })
      .waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, "02-walkthrough.png") });
    await page.getByRole("button", { name: "Close walkthrough" }).click();
    check("Login, normalized MongoDB user ID, tour next/jump/close");
    await page
      .getByRole("heading", { name: "Find your next good fit." })
      .waitFor();
    await page
      .getByRole("heading", { name: "Senior Product Designer", exact: true })
      .waitFor();
    assert.equal(await page.locator('a[href^="javascript:"]').count(), 0);
    await page.getByLabel("Sort results").selectOption("newest");
    await page
      .getByRole("heading", { name: "Frontend Engineer", exact: true })
      .waitFor();
    assert.equal(lastJobsUrl.searchParams.get("sort"), "newest");
    const explained = page.getByRole("article").filter({
      has: page.getByRole("heading", {
        name: "Frontend Engineer",
        exact: true,
      }),
    });
    await explained.locator("summary").click();
    await explained
      .getByText("typescript, accessibility", { exact: false })
      .waitFor();
    check(
      "Newest sort reaches the API and match explanations show missing skills",
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(output, "03-discover-desktop.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByText("Page 2 of 3").waitFor();
    await page.getByLabel("Role or company").fill("React");
    await page.getByLabel("Location", { exact: true }).fill("Remote");
    await page.getByRole("button", { name: "Find jobs", exact: true }).click();
    await page.getByText("Page 1 of 3").waitFor();
    assert.equal(lastJobsUrl.searchParams.get("page"), "1");
    assert.equal(lastJobsUrl.searchParams.get("search"), "React");
    assert.equal(lastJobsUrl.searchParams.get("location"), "Remote");
    check(
      "Search applies filters together, resets page 2 to page 1, blocks unsafe apply links",
    );
    await page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", {
          name: "Frontend Engineer",
          exact: true,
        }),
      })
      .getByRole("button", { name: "Track application" })
      .click();
    await page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", {
          name: "Frontend Engineer",
          exact: true,
        }),
      })
      .getByRole("button", { name: "Tracked", exact: true })
      .waitFor();
    assert.equal(apps.length, 2);
    await page.getByRole("link", { name: "Applications", exact: true }).click();
    await page.getByRole("heading", { name: "Keep things moving." }).waitFor();
    const appCard = page.getByRole("article").filter({
      has: page.getByRole("heading", {
        name: "Frontend Engineer",
        exact: true,
      }),
    });
    await appCard.getByLabel("Application status").selectOption("Interviewing");
    await page
      .locator(".stage-2")
      .getByRole("heading", { name: "Frontend Engineer", exact: true })
      .waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(output, "04-applications.png"),
      fullPage: true,
    });
    check("Track job and update application status");
    await page.getByRole("link", { name: "Outreach", exact: true }).click();
    await page
      .getByRole("button", { name: "Create draft", exact: true })
      .click();
    await page.getByLabel("Subject", { exact: true }).waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector(".email-editor input")?.value ===
        "A thoughtful introduction",
    );
    assert.ok(lastEmail.jobId);
    await page.getByRole("button", { name: "Refine with AI" }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "AI refinement is unavailable" })
      .waitFor();
    assert.ok(
      (await page.getByLabel("Message", { exact: true }).inputValue()).includes(
        "Hello team",
      ),
    );
    await page.getByRole("button", { name: "Copy draft" }).click();
    await page.getByRole("button", { name: "Copied to clipboard" }).waitFor();
    check(
      "Generate/edit draft, failed AI refinement preserves text, clipboard succeeds",
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(output, "05-outreach.png"),
      fullPage: true,
    });
    await page.getByRole("link", { name: "My profile", exact: true }).click();
    await page.getByLabel("Add a skill", { exact: true }).fill("Type");
    await page.getByRole("button", { name: "TypeScript", exact: true }).click();
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Your profile is saved" })
      .waitFor();
    assert.match(savedProfile, /TypeScript/);
    await page.getByRole("button", { name: "Explore learning paths" }).click();
    await page.getByText("Figma", { exact: true }).first().waitFor();
    await page.locator("#resume-file").setInputFiles({
      name: "resume.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Not a PDF"),
    });
    await page
      .getByRole("alert")
      .filter({ hasText: "Please choose a PDF" })
      .waitFor();
    await page.locator("#resume-file").setInputFiles({
      name: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-test"),
    });
    await page
      .getByRole("alert")
      .filter({ hasText: "resume service is unavailable" })
      .waitFor();
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .waitFor();
    check(
      "Skill autocomplete, profile save, learning paths, PDF validation/upload failure recovery",
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(output, "06-profile.png"),
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "Market insights", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Skills in demand", exact: true })
      .waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(output, "07-insights.png"),
      fullPage: true,
    });
    check("Market counts and accessible charts");
    await page
      .getByRole("link", { name: "Ask the catalog", exact: true })
      .click();
    await page
      .getByLabel("What would you like to know?")
      .fill("React frontend roles");
    await page
      .getByRole("button", { name: "Find an answer", exact: true })
      .click();
    await page.getByRole("region", { name: "Catalog answer" }).waitFor();
    await page
      .getByText("Build accessible interfaces with React and TypeScript.", {
        exact: true,
      })
      .waitFor();
    await page.getByLabel("Add an AI summary").check();
    await page
      .getByRole("button", { name: "Find an answer", exact: true })
      .click();
    await page
      .getByText("The Frontend Engineer role lists React. [S1]", {
        exact: true,
      })
      .waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(output, "09-catalog-assistant.png"),
      fullPage: true,
    });
    await page
      .getByLabel("What would you like to know?")
      .fill("quantum aerospace");
    await page
      .getByRole("button", { name: "Find an answer", exact: true })
      .click();
    await page
      .getByText(
        "I couldn’t find supporting information in the current job catalog.",
        { exact: true },
      )
      .waitFor();
    check(
      "Catalog assistant shows source excerpts, optional summaries, and insufficient-evidence responses",
    );
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const tab of [
        "job-feed",
        "applications",
        "market-intel",
        "cold-email",
        "catalog-assistant",
        "profile",
      ]) {
        await page.evaluate((tab) => {
          window.location.hash = tab;
        }, tab);
        await page.waitForTimeout(160);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          true,
          `Overflow: ${tab} at ${width}`,
        );
      }
    }
    check(
      "All six pages fit 375 / 768 / 1024 / 1440 px without horizontal overflow",
    );
    await page.setViewportSize({ width: 375, height: 900 });
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    await page
      .getByRole("link", { name: "Discover jobs", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Find your next good fit." })
      .waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(output, "08-discover-mobile.png"),
      fullPage: true,
    });
    check("Mobile menu opens, navigates, closes");
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page.evaluate(() =>
        Boolean(document.activeElement.closest(".sidebar")),
      ),
      true,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .getAttribute("aria-expanded"),
      "false",
    );
    check("Mobile navigation contains keyboard focus and closes on Escape");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.reload();
    assert.equal(await page.getByRole("dialog").count(), 0);
    await page.getByRole("button", { name: "Getting started" }).click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    check("Walkthrough remembers dismissal, replays, supports Escape");
    failJobs = true;
    await page.getByRole("button", { name: "Find jobs", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "temporarily unavailable" })
      .waitFor();
    failJobs = false;
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page
      .getByRole("heading", { name: "Senior Product Designer", exact: true })
      .waitFor();
    check("Network failure has visible error and working retry");
    await page.getByLabel("Role or company").fill("empty");
    await page.getByRole("button", { name: "Find jobs", exact: true }).click();
    await page
      .getByRole("heading", { name: "A fresh search might help." })
      .waitFor();
    await page
      .locator(".empty-state")
      .getByRole("button", { name: "Clear filters" })
      .click();
    await page
      .getByRole("heading", { name: "Senior Product Designer", exact: true })
      .waitFor();
    check("Empty search explains next steps and clears back to results");
    user.role = "admin";
    await page.reload();
    await page
      .getByRole("link", { name: "Admin console", exact: true })
      .click();
    await page.getByText("Senior Product Designer", { exact: true }).waitFor();
    assert.equal(adminConnects, 0);
    if (process.env.PRODUCTION_PREVIEW === "1") {
      await page.getByText("Cloud headless imports", { exact: true }).waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Connect to browser" }).count(),
        0,
      );
    } else {
      await page.getByRole("button", { name: "Connect to browser" }).click();
      assert.equal(adminConnects, 1);
    }
    check(
      "Admin catalog loads; browser connection only happens on explicit click",
    );
    await page.getByRole("switch", { name: "Night mode" }).click();
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    for (const tab of [
      "job-feed",
      "applications",
      "market-intel",
      "cold-email",
      "catalog-assistant",
      "profile",
      "admin",
    ]) {
      await page.evaluate((tab) => window.location.assign(`#${tab}`), tab);
      await page.waitForTimeout(180);
      assert.equal(
        await page
          .getByRole("switch", { name: "Night mode" })
          .getAttribute("aria-checked"),
        "true",
      );
      const lightSurfaces = await page
        .locator(
          ".panel,.job-card,.board-column,.stats-row,.profile-checklist,.admin-page .bg-white",
        )
        .evaluateAll(
          (elements) =>
            elements.filter((element) => {
              const color = getComputedStyle(element)
                .backgroundColor.match(/[\d.]+/g)
                ?.map(Number);
              return (
                color && color[0] > 180 && color[1] > 180 && color[2] > 180
              );
            }).length,
        );
      assert.equal(
        lightSurfaces,
        0,
        `Light surface left in night mode on ${tab}`,
      );
      for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `Night overflow ${tab} ${width}`,
        );
      }
    }
    await page.evaluate(() => window.location.assign("#job-feed"));
    await page
      .getByRole("heading", { name: "Senior Product Designer", exact: true })
      .waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(output, "11-discover-night.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Getting started" }).click();
    await page.getByRole("dialog").waitFor();
    await page.screenshot({
      path: path.join(output, "12-walkthrough-night.png"),
    });
    await page.keyboard.press("Escape");
    check(
      "Night mode covers all seven pages, admin surfaces, and the walkthrough without mobile overflow",
    );
    await page.getByRole("switch", { name: "Night mode" }).click();
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    unauthorized = true;
    await page.getByRole("link", { name: "Applications", exact: true }).click();
    await page.getByRole("heading", { name: "Welcome back." }).waitFor();
    await page
      .getByRole("alert")
      .filter({ hasText: "session has expired" })
      .waitFor();
    check("Expired sessions return to sign-in with explanation");
    assert.deepEqual(errors, []);
    check("No browser runtime errors");
    fs.writeFileSync(
      path.join(work, "ui-smoke-results.json"),
      JSON.stringify({ checks, errors, fixtureBacked: true }, null, 2),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
