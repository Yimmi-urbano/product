const express = require('express');
const router = express.Router();
const controller = require('./product.controller');
const validateDomain = require('../../middlewares/validateDomain');

// Crear producto
router.post('/', validateDomain, controller.create);

// Listar productos
router.get('/', validateDomain, controller.list);

// Buscar productos
router.get('/search', validateDomain, controller.search);

// Obtener por categoría
router.get('/category/:categorySlug', validateDomain, controller.byCategory);

// Obtener por slug (para admin)
router.get('/slug/:slug', validateDomain, controller.getProductBySlug);

// Obtener por slug (para cliente)
router.get('/client/:slug', validateDomain, controller.getProductBySlug);

// Ordenar productos
router.patch('/sorter_custom', validateDomain, controller.updateProductOrder);
router.patch("/sorter_custom/update-order-single", validateDomain,  controller.updateSingleProductOrderController);
router.patch('/sorter_custom/category/:name_category', validateDomain, controller.updateProductOrderByCategory);

// Obtener producto por ID (⚠️ genérica, debe ir al final)
router.get('/:id', validateDomain, controller.getById);

// Actualizar producto
router.put('/:id', validateDomain, controller.update);
router.patch('/:id', validateDomain, controller.update);

// Eliminar (soft delete a trash)
router.delete('/:id/trash', validateDomain, controller.remove);

module.exports = router;
