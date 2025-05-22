const mongoose = require('mongoose');

const attributeValueSchema = new mongoose.Schema({
    value: { type: String, required: true },
    label: { type: String, required: true },
    hexa: { type: String },
    image: { type: String }
}, { _id: false });

const attributeSchema = new mongoose.Schema({
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    label: { type: String, required: true },
    type_label: { type: String, enum: ['label', 'hexa', 'image'], default: 'label' },
    values: [attributeValueSchema]
}, { timestamps: true });

module.exports = mongoose.model('Attributes', attributeSchema);