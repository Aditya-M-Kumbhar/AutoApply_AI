// Directed Acyclic Graph — skill prerequisites
const skillGraph = {
    'system design': ['operating systems', 'computer networks', 'databases', 'dsa'],
    'machine learning': ['python', 'numpy', 'pandas', 'linear algebra', 'statistics'],
    'kubernetes': ['docker', 'linux', 'networking'],
    'deep learning': ['machine learning', 'tensorflow', 'pytorch'],
    'react': ['javascript', 'html', 'css'],
    'node.js': ['javascript', 'rest api'],
    'aws': ['linux', 'networking', 'docker'],
    'graphql': ['rest api', 'node.js'],
    'kafka': ['system design', 'distributed systems'],
    'spring boot': ['java', 'rest api', 'sql'],
};

// BFS traversal — find all prerequisite skills for a target role
function getLearningPath(targetSkills, userSkills) {
    if (!targetSkills || !Array.isArray(targetSkills)) return [];
    if (!userSkills || !Array.isArray(userSkills)) userSkills = [];
    
    const userSkillSet = new Set(userSkills.map(s => s.toLowerCase().trim()));
    const missing = [];
    const queue = [...targetSkills.map(s => s.toLowerCase().trim())];
    const visited = new Set();

    while (queue.length > 0) {
        const skill = queue.shift();
        if (visited.has(skill)) continue;
        visited.add(skill);

        if (!userSkillSet.has(skill)) {
            missing.push(skill);
            const prereqs = skillGraph[skill] || [];
            queue.push(...prereqs.map(p => p.toLowerCase().trim()));
        }
    }
    return missing;
}

export { getLearningPath, skillGraph };
