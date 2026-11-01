const Joi = require('joi');

const variationSchema = Joi.object({
  productId: Joi.string().required(),
  sku: Joi.string().required(),
  attributes: Joi.object().required(),
  price: Joi.object({
    regular: Joi.number().required(),
    sale: Joi.number().optional(),
  }).required(),
  stock: Joi.number().required(),
  cost_price: Joi.number().min(0).allow(null).optional(),
  image: Joi.string().optional(),
  isAvailable: Joi.boolean().optional(),
});

module.exports = { variationSchema };
