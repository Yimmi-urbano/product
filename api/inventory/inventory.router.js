const express = require('express');
const controller = require('./inventory.controller');
const validateDomain = require('../../middlewares/validateDomain');

const router = express.Router();
router.use(validateDomain);

router.get('/settings', controller.getSettings);
router.patch('/settings', controller.updateSettings);
router.get('/summary', controller.getSummary);

router.get('/entries', controller.listEntries);
router.post('/entries', controller.createEntry);
router.post('/bootstrap', controller.bootstrapExistingStock);
router.get('/items', controller.listItems);
router.post('/items', controller.createItem);
router.post('/consume', controller.consume);
router.get('/movements', controller.listMovements);
router.post('/movements/:id/reverse', controller.reverseMovement);

router.get('/warehouses', controller.listWarehouses);
router.post('/warehouses', controller.createWarehouse);
router.get('/suppliers', controller.listSuppliers);
router.post('/suppliers', controller.createSupplier);

router.get('/recipes', controller.listRecipes);
router.post('/recipes', controller.createRecipe);
router.put('/recipes/:id', controller.updateRecipe);
router.get('/recipes/:id/cost', controller.recipeCost);
router.post('/recipes/:id/consume', controller.consumeRecipe);

module.exports = router;
