const Variation = require('./variations.model');

const create = (data) => Variation.create(data);

const findById = (tenantId, id) => Variation.findOne({ _id: id, tenantId, isTrash: false });

const findAll = (tenantId, filter = {}) => {
  return Variation.find({ tenantId, isTrash: false, ...filter });
};

const update = (tenantId, id, data) => {
  return Variation.findOneAndUpdate(
    { _id: id, tenantId },
    data,
    { new: true }
  );
};

const softDelete = (tenantId, id) => {
  return Variation.findOneAndUpdate(
    { _id: id, tenantId },
    { isTrash: true },
    { new: true }
  );
};

const findAvailableByProductId = async (tenantId, productId) => {
  return await Variation.find({
    tenantId,
    productId,
    isAvailable: true,
    isTrash: false,
  });
};

module.exports = {
  create,
  findById,
  findAll,
  update,
  softDelete,
  findAvailableByProductId
};
