function tokenize(text) {
    if (!text) return [];
    // Lowercase, remove punctuation, split by spaces, filter stopwords
    const stopwords = ['the','and','for','with','you','are','this','that','have','from','will','our','your'];
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopwords.includes(w));
}

function computeTFIDF(userSkills, jobDescription) {
    if (!userSkills || !Array.isArray(userSkills) || userSkills.length === 0 || !jobDescription) {
        return 0;
    }
    const jobTokens = tokenize(jobDescription);
    const skillTokens = userSkills.map(s => s.toLowerCase());
    
    const jobFreq = {};
    jobTokens.forEach(t => jobFreq[t] = (jobFreq[t] || 0) + 1);
    
    let dotProduct = 0;
    let userMagnitude = 0;
    let jobMagnitude = 0;
    
    skillTokens.forEach(skill => {
        const tf = (jobFreq[skill] || 0) / jobTokens.length;
        dotProduct += tf;
        userMagnitude += 1;
    });
    
    Object.values(jobFreq).forEach(freq => {
        jobMagnitude += Math.pow(freq / jobTokens.length, 2);
    });
    jobMagnitude = Math.sqrt(jobMagnitude);
    
    if (userMagnitude === 0 || jobMagnitude === 0) return 0;
    const similarity = dotProduct / (Math.sqrt(userMagnitude) * jobMagnitude);
    return Math.min(Math.round(similarity * 100 * 10), 100);
}

export { computeTFIDF, tokenize };
