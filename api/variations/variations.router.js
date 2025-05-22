const express = require('express');
const controller = require('./variations.controller');
const validateDomain = require('../../middlewares/validateDomain');

const router = express.Router();

router.post('/', validateDomain, controller.createVariation);
router.get('/', validateDomain, controller.listAllVariations);
router.get('/:id',  validateDomain, controller.getVariationById);
router.put('/:id', validateDomain, controller.updateVariation);
router.delete('/:id', validateDomain, controller.deleteVariation);
router.get('/product/:productId', validateDomain, controller.getAvailableVariationsByProductId);

module.exports = router;
