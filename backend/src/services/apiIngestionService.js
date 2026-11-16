import axios from 'axios';
import Job from '../models/Job.js';
import logger from '../config/logger.js';

const SKILL_DICT = [
    'react', 'node.js', 'express', 'mongodb', 'redis', 'playwright',
    'javascript', 'typescript', 'python', 'kubernetes', 'docker', 'java', 'c++', 'aws',
    'gcp', 'azure', 'sql', 'postgresql', 'graphql', 'rest api', 'dsa', 'system design',
    'machine learning', 'deep learning', 'tensorflow', 'pytorch'
];

function extractSkills(description) {
    if (!description) return [];
    const descLower = description.toLowerCase();
    // Keep skill matching robust
    return SKILL_DICT.filter(skill => {
        if (skill === 'java') {
            // avoid matching 'javascript' as 'java'
            return /\bjava\b/.test(descLower);
        }
        if (skill === 'c++') {
            return descLower.includes('c++') || descLower.includes('c plus plus');
        }
        return descLower.includes(skill);
    });
}

function cleanHtml(text) {
    if (!text) return '';
    return text.replace(/<\/?[^>]+(>|$)/g, "").trim();
}

export async function fetchAdzunaJobs() {
    const appId = process.env.ADZUNA_APP_ID || 'PLACEHOLDER_APP_ID';
    const appKey = process.env.ADZUNA_APP_KEY || 'PLACEHOLDER_APP_KEY';
    
    logger.info('Fetching jobs from Adzuna API...');
    const url = `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=50&what=software+engineer`;
    
    try {
        const response = await axios.get(url);
        const results = response.data?.results || [];
        logger.info(`Adzuna returned ${results.length} jobs.`);
        
        let upsertedCount = 0;
        for (const item of results) {
            const title = cleanHtml(item.title);
            const company = cleanHtml(item.company?.display_name || 'Unknown Company');
            const location = cleanHtml(item.location?.display_name || 'Remote');
            const description = cleanHtml(item.description || '');
            const applyLink = item.redirect_url;
            
            if (!title || !company || !applyLink) continue;
            
            const skillsRequired = extractSkills(description);
            const salaryRange = (item.salary_min && item.salary_max) 
                ? `${item.salary_min} - ${item.salary_max}` 
                : 'Not Disclosed';
                
            await Job.findOneAndUpdate(
                { title, company, location },
                {
                    description,
                    skillsRequired,
                    salaryRange,
                    applyLink,
                    sourcePlatform: 'Adzuna',
                    postedAt: item.created ? new Date(item.created) : new Date()
                },
                { upsert: true, new: true }
            );
            upsertedCount++;
        }
        logger.info(`Successfully upserted ${upsertedCount} jobs from Adzuna.`);
        return upsertedCount;
    } catch (error) {
        logger.error(`Error fetching Adzuna jobs: ${error.message}`);
        throw error;
    }
}

export async function fetchRemotiveJobs() {
    logger.info('Fetching jobs from Remotive API...');
    const url = 'https://remotive.com/api/remote-jobs?limit=50';
    
    try {
        const response = await axios.get(url);
        const results = response.data?.jobs || [];
        logger.info(`Remotive returned ${results.length} jobs.`);
        
        let upsertedCount = 0;
        for (const item of results) {
            const title = cleanHtml(item.title);
            const company = cleanHtml(item.company_name || 'Unknown Company');
            const location = cleanHtml(item.candidate_required_location || 'Remote');
            const description = cleanHtml(item.description || '');
            const applyLink = item.url;
            
            if (!title || !company || !applyLink) continue;
            
            const skillsRequired = extractSkills(description);
            const salaryRange = item.salary || 'Not Disclosed';
            
            await Job.findOneAndUpdate(
                { title, company, location },
                {
                    description,
                    skillsRequired,
                    salaryRange,
                    applyLink,
                    sourcePlatform: 'Remotive',
                    postedAt: item.publication_date ? new Date(item.publication_date) : new Date()
                },
                { upsert: true, new: true }
            );
            upsertedCount++;
        }
        logger.info(`Successfully upserted ${upsertedCount} jobs from Remotive.`);
        return upsertedCount;
    } catch (error) {
        logger.error(`Error fetching Remotive jobs: ${error.message}`);
        throw error;
    }
}

export async function fetchMuseJobs() {
    logger.info('Fetching jobs from The Muse API...');
    const apiKey = process.env.MUSE_API_KEY;
    const url = `https://www.themuse.com/api/public/jobs?page=1&descending=true${apiKey ? `&api_key=${apiKey}` : ''}`;
    
    try {
        const response = await axios.get(url);
        const results = response.data?.results || [];
        logger.info(`The Muse returned ${results.length} jobs.`);
        
        let upsertedCount = 0;
        for (const item of results) {
            const title = cleanHtml(item.name);
            const company = cleanHtml(item.company?.name || 'Unknown Company');
            const location = cleanHtml(item.locations?.[0]?.name || 'Remote');
            const description = cleanHtml(item.contents || '');
            const applyLink = item.refs?.landing_page;
            
            if (!title || !company || !applyLink) continue;
            
            const skillsRequired = extractSkills(description);
            const salaryRange = 'Not Disclosed';
            
            await Job.findOneAndUpdate(
                { title, company, location },
                {
                    description,
                    skillsRequired,
                    salaryRange,
                    applyLink,
                    sourcePlatform: 'The Muse',
                    postedAt: item.publication_date ? new Date(item.publication_date) : new Date()
                },
                { upsert: true, new: true }
            );
            upsertedCount++;
        }
        logger.info(`Successfully upserted ${upsertedCount} jobs from The Muse.`);
        return upsertedCount;
    } catch (error) {
        logger.error(`Error fetching The Muse jobs: ${error.message}`);
        throw error;
    }
}
