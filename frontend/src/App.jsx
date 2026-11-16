import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Compass,
  HelpCircle,
  LogOut,
  Mail,
  Menu,
  Shield,
  BookOpen,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import { apiFetch, json, normalizeUser, request } from "./lib/api";
import { Loading, Notice } from "./components/UI";
import PageBoundary from "./components/PageBoundary";
import ThemeToggle from "./components/ThemeToggle";
const JobFeed = lazy(() => import("./components/JobFeed"));
const MarketDashboard = lazy(() => import("./components/MarketDashboard"));
const ApplicationTracker = lazy(
  () => import("./components/ApplicationTracker"),
);
const ColdEmailGenerator = lazy(
  () => import("./components/ColdEmailGenerator"),
);
const UserProfile = lazy(() => import("./components/UserProfile"));
const AdminPanel = lazy(() => import("./components/AdminPanel"));
const CatalogAssistant = lazy(() => import("./components/CatalogAssistant"));
const tabs = [
  {
    id: "job-feed",
    label: "Discover jobs",
    icon: Compass,
    title: "Find your next good fit.",
    description: "A focused space to find opportunities worth your time.",
  },
  {
    id: "applications",
    label: "Applications",
    icon: BriefcaseBusiness,
    title: "Keep things moving.",
    description:
      "Every opportunity, from your first application to your next offer.",
  },
  {
    id: "market-intel",
    label: "Market insights",
    icon: TrendingUp,
    title: "See the bigger picture.",
    description: "Explore the skills and roles appearing in your job catalog.",
  },
  {
    id: "cold-email",
    label: "Outreach",
    icon: Mail,
    title: "Start a real conversation.",
    description: "Write a thoughtful introduction. Make it sound like you.",
  },
  {
    id: "catalog-assistant",
    label: "Ask the catalog",
    icon: BookOpen,
    title: "A better question. A clearer next step.",
    description:
      "Explore your job listings with source-based answers and optional AI summaries.",
  },
  {
    id: "profile",
    label: "My profile",
    icon: UserRound,
    title: "Your experience, in focus.",
    description:
      "Add your skills and resume to make your job matches more useful.",
  },
];
const adminTab = {
  id: "admin",
  label: "Admin console",
  icon: Shield,
  title: "Behind the scenes.",
  description: "Manage job sources, your catalog, and crawler activity.",
};
const tourSteps = [
  {
    tab: "profile",
    title: "Start with your story",
    text: "Add your skills and upload a resume in My profile. Your skills help calculate how well each role fits you.",
    action: "Open my profile",
  },
  {
    tab: "job-feed",
    title: "Find a role worth exploring",
    text: "Search by role, company, or location. Use the match filter to narrow your results. Apply opens the employer’s website.",
    action: "Explore jobs",
  },
  {
    tab: "applications",
    title: "Keep your progress together",
    text: "After you apply, choose Track on the job card. Update its status here as you move from application to interview and offer.",
    action: "See applications",
  },
  {
    tab: "market-intel",
    title: "Learn what’s in demand",
    text: "See which skills and roles appear most often in your catalog. Use these insights to decide what to learn next.",
    action: "See market insights",
  },
  {
    tab: "catalog-assistant",
    title: "Ask, then check the sources",
    text: "Ask about skills, roles, or locations. Source search shows the listing excerpts behind each result. You can choose an optional AI summary and review its sources.",
    action: "Ask the catalog",
  },
  {
    tab: "cold-email",
    title: "Make the introduction yours",
    text: "Choose a tracked job, create an outreach draft, then edit and copy it. You decide when and where to send it.",
    action: "Try outreach",
  },
];
const readStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage is optional. */
  }
};
const currentRoute = () => window.location.hash.slice(1) || "job-feed";
function Brand() {
  return (
    <span className="brand">
      <span className="brand-symbol">
        <Compass size={23} strokeWidth={1.7} />
      </span>
      <span>Auto Apply AI</span>
    </span>
  );
}
function Tour({ step, setStep, onClose, onVisit }) {
  const dialog = useRef(null);
  const previousFocus = useRef(document.activeElement);
  const item = tourSteps[step];
  useEffect(() => {
    const node = dialog.current;
    const focused = previousFocus.current;
    node.showModal();
    return () => {
      node.close();
      focused?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="tour-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="tour-title"
      aria-describedby="tour-description"
    >
      <div className="tour-top">
        <span className="eyebrow">A little orientation</span>
        <button
          className="icon-btn"
          aria-label="Close walkthrough"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="tour-visual" aria-hidden="true">
        <span className="tour-tile">
          <Compass size={42} strokeWidth={1.2} />
        </span>
        <span className="tour-orbit orbit-one" />
        <span className="tour-orbit orbit-two" />
      </div>
      <span className="eyebrow">
        Step {step + 1} of {tourSteps.length}
      </span>
      <h2 id="tour-title">{item.title}</h2>
      <p id="tour-description">{item.text}</p>
      <button className="tour-visit" onClick={() => onVisit(item.tab)}>
        {item.action}
        <ArrowRight size={16} />
      </button>
      <div
        className="tour-progress"
        aria-label={`Step ${step + 1} of ${tourSteps.length}`}
      >
        {tourSteps.map((_, index) => (
          <button
            key={index}
            aria-label={`Go to step ${index + 1}`}
            aria-current={index === step ? "step" : undefined}
            className={index === step ? "active" : ""}
            onClick={() => setStep(index)}
          />
        ))}
      </div>
      <div className="tour-footer">
        <button
          className="text-btn"
          onClick={step ? () => setStep(step - 1) : onClose}
        >
          {step ? "Back" : "Skip for now"}
        </button>
        <button
          className="btn btn-primary"
          onClick={() =>
            step === tourSteps.length - 1
              ? onVisit("profile")
              : setStep(step + 1)
          }
        >
          {step === tourSteps.length - 1 ? "Let’s get started" : "Next step"}
          <ArrowRight size={16} />
        </button>
      </div>
    </dialog>
  );
}
export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [activeTab, setActiveTab] = useState(currentRoute);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [shellError, setShellError] = useState("");
  const heading = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const sidebar = document.getElementById("workspace-navigation");
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar?.querySelector("button")?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key !== "Tab" || !sidebar) return;
      const controls = [
        ...sidebar.querySelectorAll("a, button:not(:disabled)"),
      ].filter((node) => node.getClientRects().length);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      if (document.activeElement?.closest(".sidebar")) previousFocus?.focus();
    };
  }, [menuOpen]);
  const welcomeUser = useCallback((data) => {
    const next = normalizeUser(data);
    setUser(next);
    if (!readStorage(`talentradar:tour:${next.id}`)) {
      setTourStep(0);
      setTourOpen(true);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await apiFetch("/auth/profile", {
          signal: controller.signal,
        });
        if (response.ok) welcomeUser((await response.json()).data.user);
        else if (response.status !== 401)
          setAuthError(
            "Your session couldn’t be restored. Please sign in again.",
          );
      } catch (error) {
        if (error.name !== "AbortError") setAuthError(error.message);
      } finally {
        if (!controller.signal.aborted) setBooting(false);
      }
    })();
    return () => controller.abort();
  }, [welcomeUser]);
  useEffect(() => {
    const onHash = () => {
      setActiveTab(currentRoute());
      setMenuOpen(false);
    };
    const onExpired = () => {
      setUser(null);
      setTourOpen(false);
      setAuthError("Your session has expired. Please sign in again.");
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("session-expired", onExpired);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("session-expired", onExpired);
    };
  }, []);
  const navTabs = user?.role === "admin" ? [...tabs, adminTab] : tabs;
  const currentTab = navTabs.find((tab) => tab.id === activeTab) || tabs[0];
  useEffect(() => {
    document.title = `${user ? currentTab.label : "Welcome"} · Auto Apply AI`;
  }, [currentTab.label, user]);
  const navigate = (id) => {
    window.location.assign(`#${id}`);
    setActiveTab(id);
    setMenuOpen(false);
    requestAnimationFrame(() => heading.current?.focus());
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const closeTour = () => {
    writeStorage(`talentradar:tour:${user.id}`, "seen");
    setTourOpen(false);
  };
  const visit = (id) => {
    closeTour();
    navigate(id);
  };
  const authenticate = async (event) => {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      email: form.get("email").trim(),
      password: form.get("password"),
    };
    if (authMode === "register") payload.name = form.get("name").trim();
    try {
      await request(`/auth/${authMode}`, json("POST", payload));
      welcomeUser((await request("/auth/profile")).data.user);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  };
  const logout = async () => {
    setSigningOut(true);
    setShellError("");
    try {
      await request("/auth/logout", { method: "POST" });
      setUser(null);
      setTourOpen(false);
      navigate("job-feed");
    } catch (error) {
      setShellError(error.message);
    } finally {
      setSigningOut(false);
    }
  };
  if (booting)
    return (
      <div className="boot-screen">
        <Brand />
        <Loading label="Opening your workspace…" />
      </div>
    );
  if (!user)
    return (
      <div className="auth-layout">
        <section className="auth-story">
          <Brand />
          <div className="auth-story-copy">
            <span className="eyebrow">
              A little clarity for your next chapter
            </span>
            <h1>
              Good work.
              <br />
              Great possibilities.
            </h1>
            <p>
              Find the right opportunities, stay organized, and take your next
              step with a little more confidence.
            </p>
          </div>
          <div className="career-scene" aria-hidden="true">
            <div className="scene-grid" />
            <div className="scene-card scene-card-back">
              <span className="scene-label">YOUR NEXT CHAPTER</span>
              <span className="scene-line" />
              <span className="scene-line short" />
            </div>
            <div className="scene-card scene-card-front">
              <div className="scene-card-icon">
                <BriefcaseBusiness size={28} strokeWidth={1.5} />
              </div>
              <span className="scene-label">ROOM TO GROW</span>
              <strong>A role that fits you.</strong>
              <div className="scene-card-bottom">
                <span>Skills. Ambition. Possibility.</span>
                <ArrowRight size={20} />
              </div>
            </div>
            <span className="scene-check">
              <Check size={24} />
            </span>
          </div>
          <div className="auth-story-footer">
            <span>Discover.</span>
            <span>Connect.</span>
            <span>Move forward.</span>
            <ArrowDown size={16} />
          </div>
        </section>
        <main className="auth-main">
          <div className="auth-theme-control">
            <ThemeToggle />
          </div>
          <div className="auth-form-wrap">
            <span className="eyebrow">YOUR CAREER WORKSPACE</span>
            <h2>
              {authMode === "login" ? "Welcome back." : "Make your next move."}
            </h2>
            <p>
              {authMode === "login"
                ? "A fresh start to your job search, every day."
                : "One place for your search, applications, and outreach."}
            </p>
            <form onSubmit={authenticate} className="auth-form">
              {authMode === "register" && (
                <label>
                  Full name
                  <input
                    name="name"
                    autoComplete="name"
                    placeholder="Your name"
                    required
                    maxLength={100}
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    authMode === "login" ? "current-password" : "new-password"
                  }
                  placeholder={
                    authMode === "register"
                      ? "At least 6 characters"
                      : "Enter your password"
                  }
                  minLength={authMode === "register" ? 6 : 1}
                  required
                />
              </label>
              <Notice>{authError}</Notice>
              <button className="btn btn-primary" disabled={authBusy}>
                {authBusy
                  ? "Just a moment…"
                  : authMode === "login"
                    ? "Sign in to your workspace"
                    : "Create your account"}
                <ArrowRight size={18} />
              </button>
            </form>
            <div className="auth-switch">
              {authMode === "login" ? "New here?" : "Already have an account?"}{" "}
              <button
                className="text-btn"
                disabled={authBusy}
                onClick={() => {
                  setAuthMode(authMode === "login" ? "register" : "login");
                  setAuthError("");
                }}
              >
                {authMode === "login" ? "Create an account" : "Sign in"}
              </button>
            </div>
            <div className="auth-note">
              <Shield size={16} />
              <span>Your search is personal. Your workspace is, too.</span>
            </div>
          </div>
          <span className="auth-copyright">
            Auto Apply AI · A more thoughtful job search.
          </span>
        </main>
      </div>
    );
  const renderPage = () => {
    switch (currentTab.id) {
      case "applications":
        return <ApplicationTracker currentUser={user} onNavigate={navigate} />;
      case "market-intel":
        return <MarketDashboard />;
      case "cold-email":
        return <ColdEmailGenerator currentUser={user} onNavigate={navigate} />;
      case "profile":
        return (
          <UserProfile
            currentUser={user}
            onProfileUpdated={(updated) =>
              setUser((previous) => normalizeUser({ ...previous, ...updated }))
            }
          />
        );
      case "admin":
        return <AdminPanel />;
      case "catalog-assistant":
        return <CatalogAssistant />;
      default:
        return <JobFeed currentUser={user} onNavigate={navigate} />;
    }
  };
  const PageIcon = currentTab.icon;
  return (
    <div className="app-layout">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          heading.current?.focus();
        }}
      >
        Skip to content
      </a>
      <aside
        id="workspace-navigation"
        className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}
        aria-label="Workspace navigation"
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-btn mobile-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-avatar">
            {user.name?.slice(0, 1).toUpperCase() || "Y"}
          </span>
          <div>
            <strong>Personal workspace</strong>
            <span>Your next chapter starts here</span>
          </div>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <a
                key={tab.id}
                href={`#${tab.id}`}
                className={`nav-item ${currentTab.id === tab.id ? "nav-active" : ""}`}
                aria-current={currentTab.id === tab.id ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(tab.id);
                }}
              >
                <Icon size={19} strokeWidth={1.7} />
                <span>{tab.label}</span>
                {currentTab.id === tab.id && <ChevronRight size={15} />}
              </a>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-dot" />
            <strong>Small steps. Real progress.</strong>
            <p>Start with your skills. The right opportunities follow.</p>
            <button onClick={() => navigate("profile")}>
              Build your profile
              <ArrowRight size={15} />
            </button>
          </div>
          <button
            className="nav-item"
            onClick={() => {
              setTourStep(0);
              setTourOpen(true);
            }}
          >
            <HelpCircle size={19} />
            <span>Take a quick tour</span>
          </button>
          <div className="account-row">
            <span className="account-avatar">
              {user.name?.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <button
              className="icon-btn"
              onClick={logout}
              aria-label="Sign out"
              disabled={signingOut}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="workspace-main" inert={menuOpen}>
        <header className="topbar">
          <div>
            <button
              className="icon-btn mobile-toggle"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Workspace
              <ChevronRight size={13} />
              <strong>{currentTab.label}</strong>
            </span>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <button
              className="topbar-help"
              onClick={() => {
                setTourStep(0);
                setTourOpen(true);
              }}
            >
              <HelpCircle size={16} />
              <span>Getting started</span>
            </button>
          </div>
        </header>
        <main className="page-content" id="main-content">
          <Notice>{shellError}</Notice>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {currentTab.id === "job-feed"
                  ? `LET’S MAKE YOUR NEXT MOVE, ${user.name?.split(" ")[0] || "THERE"}`
                  : "YOUR CAREER, WITH MORE CLARITY"}
              </span>
              <h1 ref={heading} tabIndex={-1}>
                {currentTab.title}
              </h1>
              <p>{currentTab.description}</p>
            </div>
            <span className="page-heading-mark" aria-hidden="true">
              <PageIcon size={36} strokeWidth={1.1} />
            </span>
          </div>
          <PageBoundary key={currentTab.id}>
            <Suspense fallback={<Loading />}>
              <div className="page-enter" key={currentTab.id}>
                {renderPage()}
              </div>
            </Suspense>
          </PageBoundary>
          <footer className="workspace-footer">
            <span>Made for your next chapter.</span>
            <span>Auto Apply AI</span>
          </footer>
        </main>
      </div>
      {tourOpen && (
        <Tour
          step={tourStep}
          setStep={setTourStep}
          onClose={closeTour}
          onVisit={visit}
        />
      )}
    </div>
  );
}
