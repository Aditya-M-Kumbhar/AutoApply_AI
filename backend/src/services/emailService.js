import EmailTemplate from '../models/EmailTemplate.js';
import { tokenize } from '../utils/matchingEngine.js';
import { generateText } from './aiService.js';
import logger from '../config/logger.js';

export async function generateColdEmail(templateId, userData, jobData) {
    logger.info(`Generating cold email for template: ${templateId}, user: ${userData.name}, job: ${jobData.title}`);
    
    let template;
    if (templateId) {
        try {
            template = await EmailTemplate.findById(templateId);
        } catch (err) {
            logger.error(`Error finding EmailTemplate ${templateId}: ${err.message}`);
        }
    }
    
    // Default template fallback if not found
    if (!template) {
        template = {
            name: 'Default Professional',
            subject: 'Expression of Interest: [TARGET_ROLE] role at [COMPANY_NAME]',
            body: `Dear Hiring Team,

My name is [CANDIDATE_NAME], and I am writing to express my interest in the [TARGET_ROLE] role at [COMPANY_NAME].

I have strong expertise in technical domains, especially [RELEVANT_SKILL_1] and [RELEVANT_SKILL_2], which directly align with your requirements. I have applied my expertise across multiple projects, utilizing tools like [RELEVANT_PROJECT] to deliver high-quality solutions.

I would welcome the opportunity to discuss how my skill set and background match your team's goals.

Best regards,
[CANDIDATE_NAME]`
        };
    }
    
    // Extract top 2 matching skills using TF-IDF term frequency overlap
    const userSkills = userData.skills || [];
    const jobDescription = jobData.description || '';
    
    const jobTokens = tokenize(jobDescription);
    const jobFreq = {};
    jobTokens.forEach(t => jobFreq[t] = (jobFreq[t] || 0) + 1);
    
    const matchedSkills = userSkills
        .map(skill => ({
            skill,
            frequency: jobFreq[skill.toLowerCase()] || 0
        }))
        .filter(item => item.frequency > 0)
        .sort((a, b) => b.frequency - a.frequency)
        .map(item => item.skill);
        
    const skill1 = matchedSkills[0] || userSkills[0] || 'Software Engineering';
    const skill2 = matchedSkills[1] || userSkills[1] || 'Systems Design';
    const project = userSkills[2] || 'Full-Stack Development Projects';
    
    // Replace all placeholders
    let subject = template.subject
        .replace(/\[TARGET_ROLE\]/g, jobData.title || 'Software Engineer')
        .replace(/\[COMPANY_NAME\]/g, jobData.company || 'your company')
        .replace(/\[CANDIDATE_NAME\]/g, userData.name || 'Applicant');
        
    let body = template.body
        .replace(/\[TARGET_ROLE\]/g, jobData.title || 'Software Engineer')
        .replace(/\[COMPANY_NAME\]/g, jobData.company || 'your company')
        .replace(/\[CANDIDATE_NAME\]/g, userData.name || 'Applicant')
        .replace(/\[RELEVANT_SKILL_1\]/g, skill1)
        .replace(/\[RELEVANT_SKILL_2\]/g, skill2)
        .replace(/\[RELEVANT_PROJECT\]/g, project);
        
    return { subject, body };
}

export async function personalizeWithAI(emailBody, toneInstruction) {
    logger.info(`Personalizing email using AI tone: ${toneInstruction}...`);
    const prompt = `Rewrite this email in a ${toneInstruction} tone, keeping all facts identical: ${emailBody}`;
    
    // Rely on generateText wrapper which has Gemini with Groq failover
    const resultText = await generateText(prompt, "You are a professional career coach. Rewrite the user's email in the specified tone, making sure to keep all facts and placeholders intact. Output ONLY the rewritten email, no other text.");
    return resultText;
}
