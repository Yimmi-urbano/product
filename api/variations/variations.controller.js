const service = require('./variations.service');
const { variationSchema } = require('./variations.validation');

const createVariation = async (req, res) => {
  try {
    const { error, value } = variationSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const payload = { ...value, tenantId: req.tenantId };
    const variation = await service.createVariation(payload);
    res.status(201).json(variation);
  } catch (err) {
    console.error('Error creating variation:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getVariationById = async (req, res) => {
  try {
    const { id } = req.params;
    const variation = await service.getVariation(req.tenantId, id);
    if (!variation) return res.status(404).json({ error: 'Variation not found' });
    res.json(variation);
  } catch (err) {
    console.error('Error getting variation:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const listAllVariations = async (req, res) => {
  try {
    const filter = req.query.productId ? { productId: req.query.productId } : {};
    const variations = await service.listVariations(req.tenantId, filter);
    res.json(variations);
  } catch (err) {
    console.error('Error listing variations:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateVariation = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = variationSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const variation = await service.updateVariation(req.tenantId, id, value);
    if (!variation) return res.status(404).json({ error: 'Variation not found' });
    res.json(variation);
  } catch (err) {
    console.error('Error updating variation:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteVariation = async (req, res) => {
  try {
    const { id } = req.params;
    const variation = await service.deleteVariation(req.tenantId, id);
    if (!variation) return res.status(404).json({ error: 'Variation not found' });
    res.json({ message: 'Variation moved to trash' });
  } catch (err) {
    console.error('Error deleting variation:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAvailableVariationsByProductId = async (req, res) => {
  try {
    const { productId } = req.params;
    const variations = await service.getAvailableVariations(req.tenantId, productId);
    res.json(variations);
  } catch (err) {
    console.error('Error fetching available variations:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createVariation,
  getVariationById,
  listAllVariations,
  updateVariation,
  deleteVariation,
  getAvailableVariationsByProductId
};
