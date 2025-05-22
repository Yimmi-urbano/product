const attributeDao = require('./attribute.dao');

exports.createAttribute = async (tenantId, data) => {
    return await attributeDao.create({ ...data, tenantId });
};

exports.getAttributes = async (tenantId) => {
    return await attributeDao.findAllByTenant(tenantId);
};

exports.getAttributeById = async (tenantId, id) => {
    const attr = await attributeDao.findById(tenantId, id);
    if (!attr) throw new Error('Attribute not found');
    return attr;
};

exports.updateAttribute = async (tenantId, id, updateData) => {
    const attr = await attributeDao.updateById(tenantId, id, updateData);
    if (!attr) throw new Error('Attribute not found or not updated');
    return attr;
};

exports.deleteAttribute = async (tenantId, id) => {
    const result = await attributeDao.deleteById(tenantId, id);
    if (!result) throw new Error('Attribute not found or not deleted');
    return result;
};
