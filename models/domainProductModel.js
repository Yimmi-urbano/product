const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    domain: { type: String, required: true },
    is_trash: {
        status: { type: Boolean, default: false },
        date: { type: String }
    },
    price: {
        regular: { type: Number, required: true },
        sale: { type: Number, required: true },
        tag: { type: String }
    },
    title: { type: String, required: true },
    slug: { type: String, unique: true },
    type_product: { type: String, required: true },
    image_default: [{ type: String, required: true }],
    stock: { type: Number, default: 0 }, 
    category: [{
        type: Object,
    }],
    is_available: { type: Boolean, required: true },
    default_variations: [{ type: String }],
    atributos: [{
        name_attr: { type: String, required: true },
        values: [{
            Id: { type: String, required: true },
            valor: { type: String, required: true }
        }]
    }],
    variations: [{
        chill_attr: [{ type: String, required: true }],
        price: {
            regular: { type: Number, required: true },
            sale: { type: Number, required: true },
            tag: { type: String }
        }
    }],
    description_long: { type: String, required: true },
    description_short: { type: String, required: true }
});

module.exports = mongoose.model('Product', ProductSchema);
