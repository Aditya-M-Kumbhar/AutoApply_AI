export const jobs = [
  {
    _id: "react-remote",
    title: "Frontend Engineer",
    company: "Northstar",
    location: "Remote",
    description:
      "Build accessible user interfaces with React and TypeScript. Collaborate with designers on a shared design system. Salary: GBP 70000 to 85000.",
    skillsRequired: ["React", "TypeScript", "Accessibility"],
    salaryRange: "GBP 70000 to 85000",
    applyLink: "https://example.com/react",
    postedAt: "2026-10-01",
  },
  {
    _id: "python-data",
    title: "Data Engineer",
    company: "River",
    location: "Bengaluru",
    description:
      "Develop Python data pipelines and PostgreSQL transformations. Maintain AWS infrastructure and SQL data quality checks.",
    skillsRequired: ["Python", "PostgreSQL", "AWS", "SQL"],
    applyLink: "https://example.com/data",
    postedAt: "2026-10-01",
  },
  {
    _id: "product-design",
    title: "Product Designer",
    company: "Fieldwork",
    location: "Remote",
    description:
      "Lead user research and prototype product experiences in Figma. Work with design systems and accessibility standards.",
    skillsRequired: ["Figma", "User research", "Design systems"],
    applyLink: "https://example.com/design",
    postedAt: "2026-10-01",
  },
  {
    _id: "java-backend",
    title: "Java Backend Engineer",
    company: "Cedar",
    location: "London",
    description:
      "Develop Java services using Spring Boot and PostgreSQL. This is a hybrid role in London.",
    skillsRequired: ["Java", "Spring Boot", "PostgreSQL"],
    applyLink: "https://example.com/java",
    postedAt: "2026-10-01",
  },
  {
    _id: "cpp-systems",
    title: "C++ Systems Engineer",
    company: "Vector",
    location: "Berlin",
    description:
      "Write C++ software for Linux systems. Optimize memory safety and network performance.",
    skillsRequired: ["C++", "Linux"],
    applyLink: "https://example.com/cpp",
    postedAt: "2026-10-01",
  },
  {
    _id: "dotnet",
    title: "C# Developer",
    company: "Birch",
    location: "Toronto",
    description: "Build C# services with .NET and Microsoft SQL Server.",
    skillsRequired: ["C#", ".NET"],
    applyLink: "https://example.com/csharp",
    postedAt: "2026-10-01",
  },
  {
    _id: "node-backend",
    title: "Node.js Backend Engineer",
    company: "Oak",
    location: "Remote",
    description:
      "Build Node.js APIs in JavaScript and TypeScript. Work with PostgreSQL and Redis.",
    skillsRequired: ["Node.js", "TypeScript", "Redis"],
    applyLink: "https://example.com/node",
    postedAt: "2026-10-01",
  },
];
export const cases = [
  {
    id: "react",
    question: "React frontend roles",
    relevance: { "react-remote": 2 },
  },
  {
    id: "data",
    question: "Python data pipelines",
    relevance: { "python-data": 2 },
  },
  {
    id: "design",
    question: "Figma user research",
    relevance: { "product-design": 2 },
  },
  {
    id: "java-not-javascript",
    question: "Java Spring Boot",
    relevance: { "java-backend": 2 },
  },
  { id: "cpp", question: "C++ Linux", relevance: { "cpp-systems": 2 } },
  { id: "csharp", question: "C# .NET", relevance: { dotnet: 2 } },
  {
    id: "node-alias",
    question: "nodejs Redis backend",
    relevance: { "node-backend": 2, "java-backend": 1 },
  },
  {
    id: "typescript",
    question: "TypeScript",
    relevance: { "react-remote": 2, "node-backend": 2 },
  },
  {
    id: "multiword",
    question: "design systems accessibility",
    relevance: { "product-design": 2, "react-remote": 2 },
  },
  {
    id: "no-evidence",
    question: "Kubernetes aerospace quantum",
    relevance: {},
  },
];
