const express = require('express');
const controller = require('./attribute.controller');
const router = express.Router();
const validateDomain = require('../../middlewares/validateDomain');

router.post('/', validateDomain, controller.create);
router.get('/', validateDomain, controller.findAll);
router.get('/:id', validateDomain, controller.findById);
router.put('/:id', validateDomain, controller.update);
router.delete('/:id', validateDomain, controller.delete);

module.exports = router;
