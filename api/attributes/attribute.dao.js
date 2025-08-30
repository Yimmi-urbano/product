const AttributeModel = require('./attribute.model');

exports.create = (data) => AttributeModel.create(data);

exports.findAllByTenant = (tenantId) => AttributeModel.find({ tenantId });

exports.findById = (tenantId, id) => AttributeModel.findOne({ tenantId, _id: id });

exports.updateById = (tenantId, id, updateData) =>
    AttributeModel.findOneAndUpdate({ tenantId, _id: id }, updateData, { new: true });

exports.deleteById = (tenantId, id) =>
    AttributeModel.findOneAndDelete({ tenantId, _id: id });
