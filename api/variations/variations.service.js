const dao = require('./variations.dao');

const createVariation = async (data) => {
  return dao.create(data);
};

const getVariation = async (tenantId, id) => {
  return dao.findById(tenantId, id);
};

const listVariations = async (tenantId, filter = {}) => {
  return dao.findAll(tenantId, filter);
};

const updateVariation = async (tenantId, id, data) => {
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
