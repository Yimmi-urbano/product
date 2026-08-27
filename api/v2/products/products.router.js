const express = require('express');
const router = express.Router();
const controller = require('./product.controller');
const validateDomain = require('../../../middlewares/validateDomain');

router.get('/', validateDomain, controller.list);
router.get('/search', validateDomain, controller.search);
router.get('/category/:categorySlug', validateDomain, controller.byCategory);
router.get('/slug/:slug', validateDomain, controller.getBySlug);
router.get('/client/:slug', validateDomain, controller.getBySlug);
router.get('/:id', validateDomain, controller.getById);

module.exports = router;
