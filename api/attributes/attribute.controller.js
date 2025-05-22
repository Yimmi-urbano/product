const attributeService = require('./attribute.service');

exports.create = async (req, res) => {
    try {
        const attribute = await attributeService.createAttribute(req.tenantId, req.body);
        res.status(201).json(attribute);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.findAll = async (req, res) => {
    try {
        const attributes = await attributeService.getAttributes(req.tenantId);
        res.json(attributes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.findById = async (req, res) => {
    try {
        const attribute = await attributeService.getAttributeById(req.tenantId, req.params.id);
        res.json(attribute);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const updated = await attributeService.updateAttribute(req.tenantId, req.params.id, req.body);
        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        await attributeService.deleteAttribute(req.tenantId, req.params.id);
        res.json({ message: 'Attribute deleted' });
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};
