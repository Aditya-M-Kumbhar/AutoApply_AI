import mongoose from 'mongoose';

const ensureSearchIndex = async () => {
    try {
        const collection = mongoose.connection.db.collection('jobs');
        await collection.createIndex({ skillsRequired: 1 });
        console.log('[Search] Inverted index on skillsRequired ensured');
    } catch (err) {
        console.error(`[Search] Error ensuring search index: ${err.message}`);
    }
};

export { ensureSearchIndex };
