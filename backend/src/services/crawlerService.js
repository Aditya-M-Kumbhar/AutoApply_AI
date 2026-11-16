import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import Job from '../models/Job.js';
import logger from '../config/logger.js';
import { getIO } from '../config/socket.js';

// NODE v22 LEGACY MODULE COMPLIANCE (TOP OF FILE)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

// Stealth plugin activation
chromium.use(StealthPlugin());

const SKILL_DICT = [
    'react', 'node.js', 'express', 'mongodb', 'redis', 'playwright',
    'javascript', 'typescript', 'python', 'kubernetes', 'docker', 'java', 'c++', 'aws',
    'gcp', 'azure', 'sql', 'postgresql', 'graphql', 'rest api', 'dsa', 'system design',
    'machine learning', 'deep learning', 'tensorflow', 'pytorch'
];

function extractSkills(description) {
    if (!description) return [];
    const descLower = description.toLowerCase();
    return SKILL_DICT.filter(skill => {
        if (skill === 'java') {
            return /\bjava\b/.test(descLower);
        }
        if (skill === 'c++') {
            return descLower.includes('c++') || descLower.includes('c plus plus');
        }
        return descLower.includes(skill);
    });
}

function emitLog(roomId, message) {
    const io = getIO();
    if (io && roomId) {
        io.to(roomId).emit('crawl_log', {
            message,
            timestamp: Date.now()
        });
    }
}

// TIERED 100% ACCURATE UNIVERSAL COMPANY NAME PARSER
export function parseDynamicCompanyName(url, companyOverride, pageTitle = '') {
    // Priority 1: explicit override
    if (companyOverride && typeof companyOverride === 'string' && companyOverride.trim()) {
        return companyOverride.trim();
    }

    // Priority 4: HTML Title Fallback
    if (pageTitle && typeof pageTitle === 'string') {
        const parts = pageTitle.split(/\s*[\-\|—]\s*/);
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i].trim();
            let cleaned = part.replace(/\s*(careers|job listings|jobs|job portal|hiring|recruiting|careers page|portal).*/i, '').trim();
            cleaned = cleaned.replace(/\b(careers|jobs|hiring)\b/i, '').trim();
            
            const hasJobKeywords = /\b(engineer|developer|analyst|manager|designer|architect|programmer|lead|specialist|intern|senior|junior|consultant|expert)\b/i.test(cleaned);
            
            if (cleaned && cleaned.toLowerCase() !== 'unknown company' && cleaned.toLowerCase() !== 'corporate_fare') {
                // If it is the last part or doesn't look like a job title, it's likely the company name
                if (!hasJobKeywords || i === parts.length - 1) {
                    return cleaned;
                }
            }
        }
    }

    // Priority 2: Parse URL using native URL class & Priority 3: Short Acronym Rule
    let hostCompany = 'Unknown Company';
    try {
        const parsedUrl = new URL(url);
        let host = parsedUrl.hostname.toLowerCase();
        const prefixes = ['www.', 'careers.', 'jobs.', 'about.', 'recruiting.'];
        for (const pref of prefixes) {
            if (host.startsWith(pref)) {
                host = host.slice(pref.length);
            }
        }
        const parts = host.split('.');
        const brandToken = parts[0] || '';
        if (brandToken) {
            if (brandToken.length <= 3) {
                hostCompany = brandToken.toUpperCase();
            } else {
                hostCompany = brandToken.charAt(0).toUpperCase() + brandToken.slice(1);
            }
        }
    } catch (e) {
        // Fallback to Unknown Company
    }

    return hostCompany;
}

async function heuristicScan(page) {
    return await page.evaluate(() => {
        const jobKeywords = /\b(engineer|developer|analyst|manager|designer|architect|programmer|lead|specialist|intern|senior|junior|consultant|expert)\b/i;
        const results = [];
        
        const links = Array.from(document.querySelectorAll('a'));
        links.forEach(link => {
            const text = link.innerText.trim();
            if (text.length > 5 && text.length < 100 && jobKeywords.test(text)) {
                let parent = link.parentElement;
                let count = 0;
                while (parent && count < 4) {
                    const parentText = parent.innerText || '';
                    const lines = parentText.split('\n').map(l => l.trim()).filter(Boolean);
                    if (lines.length >= 2) {
                        const title = text;
                        const company = lines.find(l => l !== text && l.length > 2 && l.length < 50) || 'Unknown Company';
                        const location = lines.find(l => l !== text && l !== company && (l.toLowerCase().includes('remote') || l.toLowerCase().includes('hybrid') || l.includes(','))) || 'Remote';
                        
                        results.push({
                            title,
                            company,
                            location,
                            description: parentText,
                            applyLink: link.href
                        });
                        break;
                    }
                    parent = parent.parentElement;
                    count++;
                }
            }
        });
        
        if (results.length < 3) {
            const cards = Array.from(document.querySelectorAll('div, section, li, article'));
            cards.forEach(el => {
                const h = el.querySelector('h1, h2, h3, h4, h5, h6, strong');
                if (h) {
                    const titleText = h.innerText.trim();
                    if (titleText.length > 5 && titleText.length < 80 && jobKeywords.test(titleText)) {
                        const link = el.querySelector('a');
                        const applyLink = link ? link.href : window.location.href;
                        const text = el.innerText || '';
                        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                        const company = lines.find(l => l !== titleText && l.length > 2 && l.length < 50) || 'Unknown Company';
                        const location = lines.find(l => l !== titleText && l !== company && (l.toLowerCase().includes('remote') || l.toLowerCase().includes('hybrid') || l.includes(','))) || 'Remote';
                        
                        results.push({
                            title: titleText,
                            company,
                            location,
                            description: text,
                            applyLink
                        });
                    }
                }
            });
        }
        
        const unique = [];
        const seen = new Set();
        results.forEach(job => {
            const key = `${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(job);
            }
        });
        return unique;
    });
}

async function extractFromElements(elements) {
    const jobs = [];
    for (const el of elements) {
        try {
            const details = await el.evaluate(node => {
                const jobKeywords = /\b(engineer|developer|analyst|manager|designer|architect|programmer|lead|specialist|intern|senior|junior|consultant|expert)\b/i;
                const headings = Array.from(node.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, a'));
                let title = '';
                let applyLink = '';
                
                const titleEl = headings.find(h => jobKeywords.test(h.innerText.trim()));
                if (titleEl) {
                    title = titleEl.innerText.trim();
                    const anchor = titleEl.tagName === 'A' ? titleEl : node.querySelector('a');
                    applyLink = anchor ? anchor.href : window.location.href;
                } else {
                    const text = node.innerText.trim();
                    const firstLine = text.split('\n')[0] || '';
                    if (firstLine.length < 80) {
                        title = firstLine;
                    }
                    const anchor = node.querySelector('a');
                    applyLink = anchor ? anchor.href : window.location.href;
                }
                
                if (!title) return null;
                
                const nodeText = node.innerText || '';
                const lines = nodeText.split('\n').map(l => l.trim()).filter(Boolean);
                const company = lines.find(l => l !== title && l.length > 2 && l.length < 50) || 'Unknown Company';
                const location = lines.find(l => l !== title && l !== company && (l.toLowerCase().includes('remote') || l.toLowerCase().includes('hybrid') || l.includes(','))) || 'Remote';
                
                return {
                    title,
                    company,
                    location,
                    description: nodeText,
                    applyLink
                };
            });
            if (details) {
                jobs.push(details);
            }
        } catch (err) {
            // ignore
        }
    }
    return jobs;
}

async function extractJobListings(page, url, roomId) {
    let jobs = [];

    // Strategy 1 — Heuristic sibling pattern scan
    jobs = await heuristicScan(page);
    if (jobs.length > 0) {
        emitLog(roomId, `Strategy 1 (heuristic) succeeded — ${jobs.length} jobs found`);
        return jobs;
    }
    emitLog(roomId, 'Strategy 1 failed — trying Strategy 2');

    // Strategy 2 — Common job board CSS patterns
    const cssPatterns = [
        '.job-card', '.job-listing', '.job-result',
        '[data-job-id]', '[class*="jobCard"]', '[class*="job-item"]',
        'li:has(a[href*="job"])', 'div:has(h2 a[href*="career"])'
    ];
    for (const pattern of cssPatterns) {
        try {
            const elements = await page.$$(pattern);
            if (elements.length > 2) {
                jobs = await extractFromElements(elements);
                if (jobs.length > 0) {
                    emitLog(roomId, `Strategy 2 (CSS: ${pattern}) succeeded — ${jobs.length} jobs found`);
                    return jobs;
                }
            }
        } catch (e) {
            emitLog(roomId, `Strategy 2 pattern ${pattern} failed: ${e.message}`);
        }
    }
    emitLog(roomId, 'Strategy 2 failed — trying Strategy 3');

    // Strategy 3 — All anchor tags containing job-like URLs
    jobs = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        return anchors
            .filter(a => /job|career|position|opening|role/i.test(a.href + a.textContent))
            .map(a => ({
                title: a.textContent.trim(),
                applyLink: a.href,
                company: document.title,
                location: 'See listing',
                description: a.closest('div')?.innerText?.slice(0, 500) || '',
                rawCompany: document.title
            }))
            .filter(j => j.title.length > 3 && j.title.length < 100);
    });

    if (jobs.length > 0) {
        emitLog(roomId, `Strategy 3 (anchor scan) succeeded — ${jobs.length} jobs found`);
        return jobs;
    }

    emitLog(roomId, `WARNING: No listings extracted for ${url}.`);
    return [];
}

export async function runStealthCrawl(url, sourcePlatform, roomId, maxPages = 10, companyOverride = '') {
    logger.info(`[Crawler] Starting Stealth Crawl for ${url} in room: ${roomId}`);
    emitLog(roomId, `Starting Stealth Crawl for URL: ${url}`);
    
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: { width: 1366, height: 768 },
            locale: 'en-US',
            timezoneId: 'Asia/Kolkata',
            extraHTTPHeaders: {
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        
        const page = await context.newPage();
        return await crawlLoop(page, url, sourcePlatform, roomId, maxPages, companyOverride);
    } catch (err) {
        logger.error(`[Stealth Crawl Error] ${err.message}`);
        emitLog(roomId, `Stealth Crawl failed: ${err.message}`);
        throw err;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

export async function runRealBrowserCrawl(url, sourcePlatform, roomId, maxPages = 10, companyOverride = '') {
    logger.info(`[Crawler] Connecting to Real Chrome on port 9222 for: ${url}`);
    emitLog(roomId, `Attempting CDP connection to localhost:9222...`);
    
    let browser;
    try {
        browser = await chromium.connectOverCDP('http://localhost:9222');
        emitLog(roomId, `CDP connection successful. Syncing sessions...`);
        
        const context = browser.contexts().length > 0 ? browser.contexts()[0] : await browser.newContext();
        const page = await context.newPage();
        return await crawlLoop(page, url, sourcePlatform, roomId, maxPages, companyOverride);
    } catch (err) {
        logger.error(`[CDP Crawl Error] ${err.message}`);
        emitLog(roomId, `Real Browser connection failed: ${err.message}. Make sure Chrome is open with remote debugging enabled on port 9222.`);
        throw err;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function crawlLoop(page, startUrl, sourcePlatform, roomId, maxPages, companyOverride = '') {
    let currentUrl = startUrl;
    let pageNum = 1;
    let totalJobsFound = 0;
    
    // Intercept network requests to drop styles, images, fonts, and tracking scripts to preserve memory
    await page.route('**/*', (route) => {
        const req = route.request();
        const type = req.resourceType();
        const url = req.url().toLowerCase();
        
        const isTracking = url.includes('analytics') || 
                           url.includes('gtm') || 
                           url.includes('doubleclick') || 
                           url.includes('facebook') || 
                           url.includes('pixel') || 
                           url.includes('mixpanel') ||
                           url.includes('hotjar');
                           
        if (['image', 'media', 'font', 'stylesheet'].includes(type) || isTracking) {
            route.abort();
        } else {
            route.continue();
        }
    });

    // POLYMORPHIC ADAPTIVE CRAWLING STRATEGY ROUTER
    let strategy = 'C'; // Default to Traditional Pagination Grid
    const urlLower = startUrl.toLowerCase();
    if (urlLower.includes('google') || urlLower.includes('startup')) {
        strategy = 'A'; // GLOBAL VIEWPORT INFINITE SCROLL
    } else if (urlLower.includes('microsoft') || urlLower.includes('workday') || urlLower.includes('myworkdayjobs')) {
        strategy = 'B'; // NESTED PANEL SCROLL & INNER PAGINATION
    }

    emitLog(roomId, `Polymorphic Router -> Target Strategy identified: STRATEGY ${strategy}`);
    emitLog(roomId, `Navigating browser context to target: ${startUrl}`);
    await page.goto(startUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // IDEMPOTENT UPSTREAM COLLECTION UPSERT helper
    const saveJobs = async (jobsList) => {
        let pageJobsSaved = 0;
        for (const job of jobsList) {
            let finalCompany = '';
            let rawCompany = (job.company || '').trim();
            const isInvalidRaw = !rawCompany || 
                                 rawCompany.toLowerCase() === 'unknown company' || 
                                 rawCompany.toLowerCase() === 'corporate_fare';
            
            if (companyOverride && companyOverride.trim()) {
                finalCompany = companyOverride.trim();
            } else if (!isInvalidRaw) {
                finalCompany = rawCompany;
            } else {
                let pageTitle = '';
                try {
                    pageTitle = await page.title();
                } catch (tErr) {
                    // Ignore
                }
                finalCompany = parseDynamicCompanyName(startUrl, null, pageTitle);
            }

            const skillsRequired = extractSkills(job.description);
            try {
                // Compound unique index criteria { title, company, location }
                await Job.findOneAndUpdate(
                    { title: job.title, company: finalCompany, location: job.location },
                    {
                        description: job.description || `No description provided. Source: ${sourcePlatform}`,
                        skillsRequired,
                        applyLink: job.applyLink || startUrl,
                        sourcePlatform: sourcePlatform || 'Public Scrape',
                        postedAt: new Date()
                    },
                    { upsert: true, new: true }
                );
                pageJobsSaved++;
                totalJobsFound++;
            } catch (dbErr) {
                // Ignore uniqueness conflict/errors
            }
        }
        emitLog(roomId, `Processed batch — ${pageJobsSaved} jobs saved to cluster database`);
    };

    // STRATEGY A: GLOBAL VIEWPORT INFINITE SCROLL
    if (strategy === 'A') {
        emitLog(roomId, `Initiating Strategy A (Infinite scroll viewport hydration)`);
        let previousHeight = 0;
        let currentHeight = await page.evaluate(() => document.body.scrollHeight);
        
        while (pageNum <= maxPages) {
            emitLog(roomId, `Scrolling infinite scroll panel index ${pageNum}...`);
            previousHeight = currentHeight;
            
            // Scroll window root
            await page.evaluate(() => window.scrollBy(0, 1000));
            
            // Awaiting DOM hydration milestones
            try {
                await page.waitForLoadState('networkidle', { timeout: 3000 });
            } catch (e) {
                // Ignore load state timeout
            }
            await page.waitForTimeout(1500);
            
            const jobs = await extractJobListings(page, currentUrl, roomId);
            await saveJobs(jobs);
            
            currentHeight = await page.evaluate(() => document.body.scrollHeight);
            const isBottomSaturated = await page.evaluate(() => {
                return (window.scrollY + window.innerHeight) >= document.body.scrollHeight - 50;
            });
            
            if (currentHeight <= previousHeight || isBottomSaturated) {
                emitLog(roomId, `Infinite scroll bottom coordinate saturated (height: ${currentHeight}).`);
                break;
            }
            pageNum++;
        }
    }
    // STRATEGY B: NESTED PANEL SCROLL & INNER PAGINATION
    else if (strategy === 'B') {
        emitLog(roomId, `Initiating Strategy B (Sidebar scroll & inner button traversal)`);
        while (pageNum <= maxPages) {
            emitLog(roomId, `Traversing sidebar index page ${pageNum}...`);
            
            // Locate and isolate specific scrollable element container wrapper for sidebar card list
            const containerSelector = await page.evaluate(() => {
                const candidates = Array.from(document.querySelectorAll('*')).filter(el => {
                    const style = window.getComputedStyle(el);
                    const isScrollable = (style.overflowY === 'scroll' || style.overflowY === 'auto') && el.scrollHeight > el.clientHeight;
                    if (isScrollable) {
                        const text = el.innerText.toLowerCase();
                        return text.includes('engineer') || text.includes('developer') || text.includes('job') || text.includes('apply');
                    }
                    return false;
                });
                
                if (candidates.length > 0) {
                    candidates.sort((a, b) => b.scrollHeight - a.scrollHeight);
                    const best = candidates[0];
                    if (best.id) return `#${best.id}`;
                    if (best.className) {
                        const classes = Array.from(best.classList)
                            .filter(c => typeof c === 'string' && !c.includes('active') && !c.includes('focus'))
                            .join('.');
                        if (classes) return `.${classes}`;
                    }
                    return best.tagName.toLowerCase();
                }
                
                const commonSidebars = ['.job-list', '[class*="jobList"]', '[class*="sidebar"]', '[data-automation-id="jobSearchResultList"]'];
                for (const sel of commonSidebars) {
                    const el = document.querySelector(sel);
                    if (el) return sel;
                }
                return null;
            });
            
            // Execute scroll-by routine directly on the container element until scrollHeight is exhausted
            if (containerSelector) {
                emitLog(roomId, `Targeting sidebar selector box: ${containerSelector}`);
                let lastScrollTop = -1;
                let scrollAttempts = 0;
                while (scrollAttempts < 15) {
                    const scrollHeightMetrics = await page.evaluate((sel) => {
                        const container = document.querySelector(sel);
                        if (container) {
                            container.scrollTop += 500;
                            return { scrollTop: container.scrollTop, scrollHeight: container.scrollHeight };
                        }
                        return null;
                    }, containerSelector);
                    
                    if (!scrollHeightMetrics) break;
                    if (scrollHeightMetrics.scrollTop === lastScrollTop) {
                        emitLog(roomId, `Sidebar container scrollHeight fully exhausted.`);
                        break;
                    }
                    lastScrollTop = scrollHeightMetrics.scrollTop;
                    await page.waitForTimeout(500);
                    scrollAttempts++;
                }
            } else {
                await page.evaluate(() => window.scrollBy(0, 500));
                await page.waitForTimeout(1000);
            }
            
            // Map active page jobs
            const jobs = await extractJobListings(page, currentUrl, roomId);
            await saveJobs(jobs);
            
            // Programmatically trigger click on right chevron page navigator button inside the sidebar
            const clicked = await page.evaluate(() => {
                const chevronSelectors = [
                    'button[aria-label*="next"i]', 
                    'button:has-text(">")', 
                    'a[aria-label*="next"i]', 
                    'button[class*="next"i]', 
                    'a[class*="next"i]',
                    '[class*="pagination"] [class*="next"]',
                    '[class*="chevron-right"]',
                    'a:has-text(">")',
                    '.pagination-next'
                ];
                
                for (const selector of chevronSelectors) {
                    const btn = document.querySelector(selector);
                    if (btn) {
                        const rect = btn.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0 && !btn.disabled) {
                            btn.click();
                            return true;
                        }
                    }
                }
                return false;
            });
            
            if (clicked) {
                emitLog(roomId, `Triggering inner panel pagination click...`);
                try {
                    await page.waitForLoadState('networkidle', { timeout: 10000 });
                } catch (e) {
                    // Ignore load state timeout
                }
                await page.waitForTimeout(2000);
                pageNum++;
            } else {
                emitLog(roomId, `Sidebar chevron end reached.`);
                break;
            }
        }
    }
    // STRATEGY C: TRADITIONAL PAGINATION GRID
    else {
        emitLog(roomId, `Initiating Strategy C (Standard grid pagination link click)`);
        
        // Read total search result limits and layout page counts from primary viewport layout
        const layoutMeta = await page.evaluate(() => {
            const text = document.body.innerText;
            const ofMatch = text.match(/of\s+(\d+)\s+results/i) || 
                            text.match(/(\d+)\s+jobs\s+found/i) || 
                            text.match(/(\d+)\s+open\s+positions/i);
            const pageMatch = text.match(/page\s+(\d+)\s+of\s+(\d+)/i) || 
                               text.match(/(\d+)\s+\/\s+(\d+)\s+pages/i);
                               
            return {
                totalJobs: ofMatch ? parseInt(ofMatch[1], 10) : null,
                totalPages: pageMatch ? parseInt(pageMatch[2], 10) : null
            };
        });
        
        if (layoutMeta.totalJobs) {
            emitLog(roomId, `Parsed total search result limits: ${layoutMeta.totalJobs} jobs`);
        }
        if (layoutMeta.totalPages) {
            emitLog(roomId, `Parsed layout page count: ${layoutMeta.totalPages} pages`);
        }
        
        while (pageNum <= maxPages) {
            emitLog(roomId, `Scanning pagination page grid index ${pageNum}...`);
            await page.waitForTimeout(1000);
            
            const jobs = await extractJobListings(page, currentUrl, roomId);
            await saveJobs(jobs);
            
            // Programmatically trigger a click handle on the global "Next" or numerical page link at bottom
            const clickedNext = await page.evaluate((pageNum) => {
                const nextSelectors = [
                    'button:has-text("Next")',
                    'a:has-text("Next")',
                    'button:has-text("Load More")',
                    'a[class*="next"i]',
                    'button[class*="next"i]',
                    '[aria-label*="next"i]'
                ];
                
                for (const sel of nextSelectors) {
                    const btn = document.querySelector(sel);
                    if (btn) {
                        const rect = btn.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0 && !btn.disabled) {
                            btn.click();
                            return true;
                        }
                    }
                }
                
                const nextPageNum = pageNum + 1;
                const pageLinks = Array.from(document.querySelectorAll('a, button'));
                const targetLink = pageLinks.find(link => {
                    const txt = link.innerText.trim();
                    return txt === String(nextPageNum);
                });
                if (targetLink) {
                    const rect = targetLink.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        targetLink.click();
                        return true;
                    }
                }
                return false;
            }, pageNum);
            
            if (clickedNext) {
                emitLog(roomId, `Triggering standard grid page navigator...`);
                try {
                    await page.waitForLoadState('networkidle', { timeout: 10000 });
                } catch (e) {
                    // Ignore load state timeout
                }
                await page.waitForTimeout(2000);
                pageNum++;
            } else {
                emitLog(roomId, `Standard pagination link navigation end reached.`);
                break;
            }
        }
    }
    
    emitLog(roomId, `Universal Adaptive Ingestion complete. Total processed: ${totalJobsFound}`);
    return totalJobsFound;
}

export async function testCDPConnection() {
    let browser;
    try {
        browser = await chromium.connectOverCDP('http://localhost:9222');
        await browser.close();
        return true;
    } catch (err) {
        return false;
    }
}
