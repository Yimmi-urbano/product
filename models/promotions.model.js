const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    categories: [{ type: String, required: true }],
    discountType: { type: String, required: true, enum: ['percentage', 'fixed'] },
    discountValue: { type: Number, required: true },
    startDate: { type: Date, default: Date.now },
    expirationDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

promotionSchema.index({ tenantId: 1, categories: 1, isActive: 1, expirationDate: 1, startDate: 1 });

module.exports = mongoose.model('Promotion', promotionSchema);