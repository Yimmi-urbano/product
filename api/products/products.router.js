const express = require('express');
const router = express.Router();
const controller = require('./product.controller');
const validateDomain = require('../../middlewares/validateDomain');


router.post('/', validateDomain, controller.create);
router.get('/', validateDomain, controller.list);
router.get('/search', validateDomain, controller.search);
router.get('/category/:categorySlug', validateDomain, controller.byCategory);
router.get('/:id', validateDomain, controller.getById);
router.put('/:id', validateDomain, controller.update);
router.patch('/:id', validateDomain, controller.update);
router.delete('/:id/trash', validateDomain,  controller.remove);
router.get('/slug/:slug', validateDomain, controller.getProductBySlug);
router.get('/client/:slug', validateDomain, controller.getProductBySlug);

module.exports = router;
