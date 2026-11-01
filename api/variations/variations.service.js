const dao = require('./variations.dao');
const mongoose = require('mongoose');
const Variation = require('./variations.model');
const inventoryService = require('../inventory/inventory.service');
const { InventoryItem } = require('../inventory/inventory.models');

const createVariation = async (data) => {
  const initialStock = Math.max(0, Number(data.stock) || 0);
  const initialCost = data.cost_price;
  const hasInitialInventory = initialStock > 0 && Number.isFinite(Number(initialCost)) && Number(initialCost) >= 0;
  if (!hasInitialInventory) return dao.create(data);

  const session = await mongoose.startSession();
  let variation;
  try {
    await session.withTransaction(async () => {
      [variation] = await Variation.create([{ ...data, stock: 0, cost_price: Number(initialCost) }], { session });
      await inventoryService.createEntry(data.tenantId, {
        notes: 'Stock inicial creado con la variación',
        lines: [{
          variationId: variation._id,
          productId: variation.productId,
          name: variation.sku,
          sku: variation.sku,
          quantity: initialStock,
          unitCost: Number(initialCost),
          unit: 'unit'
        }]
      }, { session });
    });
    return Variation.findById(variation._id);
  } finally {
    await session.endSession();
  }
};

const getVariation = async (tenantId, id) => {
  return dao.findById(tenantId, id);
};

const listVariations = async (tenantId, filter = {}) => {
  return dao.findAll(tenantId, filter);
};

const updateVariation = async (tenantId, id, data) => {
  const inventoryItem = await InventoryItem.exists({ tenantId, variationId: id });
  if (inventoryItem) {
    delete data.stock;
    delete data.cost_price;
  }
  return dao.update(tenantId, id, data);
};

const deleteVariation = async (tenantId, id) => {
  return dao.softDelete(tenantId, id);
};

const getAvailableVariations = async (tenantId, productId) => {
  return await dao.findAvailableByProductId(tenantId, productId);
};

module.exports = {
  createVariation,
  getVariation,
  listVariations,
  updateVariation,
  deleteVariation,
  getAvailableVariations
};
