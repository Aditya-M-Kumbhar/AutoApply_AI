import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch, SOCKET_URL } from "../lib/api";
import { Notice } from "./UI";
import { io } from "socket.io-client";
import { Shield, RefreshCw, Trash2 } from "lucide-react";

export default function AdminPanel() {
  // API Ingestion & Crawl inputs
  const [notice, setNotice] = useState("");
  const [crawlUrl, setCrawlUrl] = useState("");
  const [sourcePlatform, setSourcePlatform] = useState("Naukri");
  const [crawlMode, setCrawlMode] = useState("Stealth Headless");
  const [syncingAPIs, setSyncingAPIs] = useState(false);
  const [submittingCrawl, setSubmittingCrawl] = useState(false);

  // CDP status indicators
  const [cdpConnecting, setCdpConnecting] = useState(false);
  const [cdpStatus, setCdpStatus] = useState("disconnected"); // 'connected' or 'disconnected'

  // Scraper Logs
  const [logs, setLogs] = useState([]);
  const socketRef = useRef(null);
  const logEndRef = useRef(null);

  // Catalog Jobs list
  const [jobs, setJobs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [jobsLoading, setJobsLoading] = useState(false);

  // Fetch Jobs List for Admin Catalog
  const fetchAdminJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const res = await apiFetch(`/admin/jobs?page=${page}&limit=10`, {
        credentials: "include",
      });
      if (res.ok) {
        const result = await res.json();
        setJobs(result.data.jobs || []);
        setTotalPages(result.data.pagination.pages || 1);
      } else {
        setNotice(
          (await res.json()).message || "The catalog could not be loaded.",
        );
      }
    } catch (err) {
      setNotice(err.message);
    } finally {
      setJobsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchAdminJobs();
  }, [fetchAdminJobs]);

  // Connect to the debugging browser only when explicitly requested.
  const checkCDPConnection = async () => {
    setCdpConnecting(true);
    try {
      const res = await apiFetch("/admin/connect-real-browser", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setCdpStatus("connected");
      } else {
        setCdpStatus("disconnected");
      }
    } catch {
      setCdpStatus("disconnected");
    } finally {
      setCdpConnecting(false);
    }
  };

  useEffect(() => () => socketRef.current?.disconnect(), []);

  // Sync all API sources
  const handleSyncAPIs = async () => {
    setSyncingAPIs(true);
    try {
      const res = await apiFetch("/admin/sync-apis", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setNotice(
          "Job sources queued for synchronization. Check back shortly for new listings.",
        );
      } else {
        setNotice(data.message || "Job sources could not be synchronized.");
      }
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSyncingAPIs(false);
    }
  };

  // Trigger crawl job
  const handleStartCrawl = async (e) => {
    e.preventDefault();
    if (!crawlUrl) return;
    setSubmittingCrawl(true);

    // Reset logs
    setLogs([
      {
        message: `[SYSTEM] Initializing scraper pipeline for url: ${crawlUrl}...`,
        timestamp: Date.now(),
      },
    ]);

    try {
      const res = await apiFetch("/admin/crawl", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: crawlUrl,
          sourcePlatform,
          mode: crawlMode,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const { roomId } = data.data;
        // Connect socket and listen to room logs
        setupSocketLogs(roomId);
      } else {
        setLogs((prev) => [
          ...prev,
          {
            message: `[SYSTEM ERROR] Failed to queue crawl: ${data.message}`,
            timestamp: Date.now(),
          },
        ]);
      }
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        {
          message: `[SYSTEM ERROR] Failed to connect: ${err.message}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setSubmittingCrawl(false);
    }
  };

  // Socket listeners setup
  const setupSocketLogs = (roomId) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(SOCKET_URL, { withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_room", roomId);
      setLogs((prev) => [
        ...prev,
        {
          message: `[SYSTEM] Subscribed to crawler channel: ${roomId}`,
          timestamp: Date.now(),
        },
      ]);
    });

    // Listen for log pushes
    socket.on("crawl_log", (data) => {
      setLogs((prev) => [
        ...prev,
        { message: data.message, timestamp: data.timestamp || Date.now() },
      ]);
    });

    socket.on("crawl_complete", (data) => {
      setLogs((prev) => [
        ...prev,
        {
          message: `[SYSTEM] Job crawler execution completed. ${data.message}`,
          timestamp: Date.now(),
        },
      ]);
      fetchAdminJobs();
      socket.disconnect();
    });

    socket.on("disconnect", () => {
      setLogs((prev) => [
        ...prev,
        {
          message: `[SYSTEM] Connection with scraper pipeline closed.`,
          timestamp: Date.now(),
        },
      ]);
    });
  };

  useEffect(() => {
    const node = logEndRef.current?.parentElement;
    if (node) node.scrollTop = node.scrollHeight;
  }, [logs]);

  // Delete job
  const handleDeleteJob = async (jobId) => {
    if (
      !confirm("Are you sure you want to permanently delete this job listing?")
    )
      return;
    try {
      const res = await apiFetch(`/admin/jobs/${jobId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j._id !== jobId));
      } else {
        setNotice(
          (await res.json()).message || "This listing could not be deleted.",
        );
      }
    } catch (err) {
      setNotice(err.message);
    }
  };

  return (
    <div className="space-y-6 admin-page">
      <Notice>{notice}</Notice>
      {/* Header */}
      <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gray-100 rounded-lg text-gray-700">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-900">
              Admin Console
            </h3>
            <p className="text-xs text-gray-500">
              Manage job sources and imports
            </p>
          </div>
        </div>

        {import.meta.env.PROD ? (
          <span className="soft-badge">Cloud headless imports</span>
        ) : (
          <div className="flex items-center space-x-3">
            <div
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
                cdpStatus === "connected"
                  ? "text-green-700 border-green-200 bg-green-50"
                  : "text-red-700 border-red-200 bg-red-50"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${cdpStatus === "connected" ? "bg-green-500" : "bg-red-500"}`}
              ></div>
              <span>
                Optional local browser:{" "}
                {cdpStatus === "connected" ? "Connected" : "Disconnected"}
              </span>
            </div>

            <button
              aria-label="Connect to browser"
              onClick={checkCDPConnection}
              disabled={cdpConnecting}
              className="p-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-gray-500 transition"
            >
              <RefreshCw
                className={`w-4 h-4 ${cdpConnecting ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        )}
      </div>

      {/* Sync and Scrape section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Control Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* API Sync card */}
          <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm space-y-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase pb-2 border-b border-gray-100">
              Job sources
            </h4>

            <p className="text-xs text-gray-600 leading-relaxed">
              Import new listings from Adzuna, Remotive, and The Muse endpoints.
            </p>

            <button
              onClick={handleSyncAPIs}
              disabled={syncingAPIs}
              className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg text-xs transition duration-200"
            >
              {syncingAPIs ? "Syncing..." : "Sync APIs"}
            </button>
          </div>

          {/* Scrape Target card */}
          <form
            onSubmit={handleStartCrawl}
            className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm space-y-4"
          >
            <h4 className="text-xs font-semibold text-gray-500 uppercase pb-2 border-b border-gray-100">
              Add jobs from a page
            </h4>

            <div className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="crawl-url"
                  className="block text-[10px] font-medium text-gray-500 uppercase"
                >
                  Target URL
                </label>
                <input
                  id="crawl-url"
                  type="url"
                  required
                  placeholder="https://..."
                  value={crawlUrl}
                  onChange={(e) => setCrawlUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="crawl-source"
                  className="block text-[10px] font-medium text-gray-500 uppercase"
                >
                  Source Platform
                </label>
                <select
                  id="crawl-source"
                  value={sourcePlatform}
                  onChange={(e) => setSourcePlatform(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Naukri">Naukri</option>
                  <option value="Wellfound">Wellfound</option>
                  <option value="Greenhouse">Greenhouse</option>
                  <option value="Workday">Workday</option>
                  <option value="Custom Scrape">Custom Scrape</option>
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="crawl-mode"
                  className="block text-[10px] font-medium text-gray-500 uppercase"
                >
                  Crawl Mode
                </label>
                <select
                  id="crawl-mode"
                  value={crawlMode}
                  onChange={(e) => setCrawlMode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  <option value="Stealth Headless">Stealth Headless</option>
                  <option value="Real Browser" disabled={import.meta.env.PROD}>
                    Real Browser{" "}
                    {import.meta.env.PROD
                      ? "(local development only)"
                      : "(CDP)"}
                  </option>
                </select>
              </div>
            </div>

            {crawlMode === "Real Browser" && cdpStatus === "disconnected" && (
              <div className="p-2.5 bg-red-50 border border-red-100 rounded text-xs text-red-600 font-medium">
                CDP disconnected.
              </div>
            )}

            <button
              type="submit"
              disabled={
                submittingCrawl ||
                (crawlMode === "Real Browser" && cdpStatus === "disconnected")
              }
              className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg text-xs transition duration-200"
            >
              {submittingCrawl ? "Dispatching..." : "Start import"}
            </button>
          </form>
        </div>

        {/* Scraper Terminal Output Log */}
        <div className="lg:col-span-2 bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col h-[480px]">
          <h4 className="text-xs font-semibold text-gray-500 uppercase pb-2 border-b border-gray-100">
            Import activity
          </h4>

          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-xs text-gray-700 overflow-y-auto space-y-1 my-4">
            {logs.map((log, index) => (
              <div key={index} className="leading-relaxed">
                <span className="text-gray-400 mr-2">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span>{log.message}</span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-gray-400 h-full flex items-center justify-center">
                Log output...
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Catalog list table */}
      <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm space-y-4">
        <h4 className="text-xs font-semibold text-gray-900 uppercase pb-3 border-b border-gray-100">
          Job catalog
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500 uppercase text-[10px]">
                <th className="pb-3 pl-2">Job Title</th>
                <th className="pb-3">Company</th>
                <th className="pb-3">Location</th>
                <th className="pb-3">Source</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {jobsLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    No jobs found
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr
                    key={job._id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition"
                  >
                    <td className="py-3 pl-2 font-medium text-gray-900">
                      {job.title}
                    </td>
                    <td className="py-3">{job.company}</td>
                    <td className="py-3">{job.location}</td>
                    <td className="py-3">
                      <span className="px-2 py-1 bg-gray-100 rounded-full text-[9px] font-medium text-gray-600">
                        {job.sourcePlatform}
                      </span>
                    </td>
                    <td className="py-3 text-right pr-2">
                      <button
                        aria-label={`Delete ${job.title}`}
                        onClick={() => handleDeleteJob(job._id)}
                        className="p-1.5 border border-gray-200 hover:border-red-200 hover:text-red-600 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="self-center text-xs text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
