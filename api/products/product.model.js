const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    domain: { type: String, required: true },
    is_trash: {
        status: { type: Boolean, default: false },
        date: { type: Date }
    },
    price: {
        regular: { type: Number, required: true },
        sale: { type: Number, required: true },
        tag: { type: String }
    },
    title: { type: String, required: true },
    slug: { type: String },
    type_product: { type: String, required: true },
    image_default: [{ type: String, required: true }],
    stock: { type: Number, default: 0 }, 
    category: [{ type: Object }],
    is_available: { type: Boolean, required: true },
    default_variations: [{ type: String }],
    description_long: { type: String },
    description_short: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', ProductSchema);
