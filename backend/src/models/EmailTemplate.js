import mongoose from 'mongoose';

const EmailTemplateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true }
    // Body contains placeholders: [CANDIDATE_NAME], [TARGET_ROLE], [COMPANY_NAME], [RELEVANT_SKILL_1], [RELEVANT_SKILL_2], [RELEVANT_PROJECT]
});

const EmailTemplate = mongoose.model('EmailTemplate', EmailTemplateSchema);
export default EmailTemplate;
