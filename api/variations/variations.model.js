const mongoose = require('mongoose');

const priceSchema = new mongoose.Schema({
  regular: { type: Number, required: true },
  sale: { type: Number },
}, { _id: false });

const variationSchema = new mongoose.Schema({
  tenantId: { type: String, required: true },
  productId: { type: mongoose.Types.ObjectId, required: true, ref: 'Product' },
  sku: { type: String, required: true, unique: true },
  attributes: { type: Object, required: true },
  price: { type: priceSchema, required: true },
  stock: { type: Number, required: true },
  image: { type: String },
  isAvailable: { type: Boolean, default: true },
  isTrash: { type: Boolean, default: false },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Variation', variationSchema);
