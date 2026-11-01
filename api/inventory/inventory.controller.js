const service = require('./inventory.service');

function sendError(res, error) {
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    res.status(status).json({ message: error.message || 'Error interno de inventario.' });
}

exports.getSettings = async (req, res) => {
    try { res.json(await service.getSettings(req.domain)); } catch (error) { sendError(res, error); }
};

exports.updateSettings = async (req, res) => {
    try { res.json(await service.updateSettings(req.domain, req.body)); } catch (error) { sendError(res, error); }
};

exports.getSummary = async (req, res) => {
    try { res.json(await service.getSummary(req.domain, req.query)); } catch (error) { sendError(res, error); }
};

exports.createEntry = async (req, res) => {
    try { res.status(201).json(await service.createEntry(req.domain, req.body)); } catch (error) { sendError(res, error); }
};

exports.bootstrapExistingStock = async (req, res) => {
    try { res.status(201).json(await service.bootstrapExistingStock(req.domain, req.body)); } catch (error) { sendError(res, error); }
};

exports.listEntries = async (req, res) => {
    try { res.json(await service.listEntries(req.domain, req.query)); } catch (error) { sendError(res, error); }
};

exports.listItems = async (req, res) => {
    try { res.json(await service.listItems(req.domain, req.query)); } catch (error) { sendError(res, error); }
};

exports.createItem = async (req, res) => {
    try { res.status(201).json(await service.createItem(req.domain, req.body)); } catch (error) { sendError(res, error); }
};

exports.consume = async (req, res) => {
    try { res.status(201).json(await service.consume(req.domain, req.body)); } catch (error) { sendError(res, error); }
};

exports.reverseMovement = async (req, res) => {
    try { res.status(201).json(await service.reverseMovement(req.domain, req.params.id, req.body)); } catch (error) { sendError(res, error); }
};

exports.listMovements = async (req, res) => {
    try { res.json(await service.listMovements(req.domain, req.query)); } catch (error) { sendError(res, error); }
};

exports.listWarehouses = async (req, res) => {
    try { res.json(await service.listWarehouses(req.domain)); } catch (error) { sendError(res, error); }
};

exports.createWarehouse = async (req, res) => {
    try { res.status(201).json(await service.createWarehouse(req.domain, req.body)); } catch (error) { sendError(res, error); }
};

exports.listSuppliers = async (req, res) => {
    try { res.json(await service.listSuppliers(req.domain)); } catch (error) { sendError(res, error); }
};

exports.createSupplier = async (req, res) => {
    try { res.status(201).json(await service.createSupplier(req.domain, req.body)); } catch (error) { sendError(res, error); }
};

exports.listRecipes = async (req, res) => {
    try { res.json(await service.listRecipes(req.domain)); } catch (error) { sendError(res, error); }
};

exports.createRecipe = async (req, res) => {
    try { res.status(201).json(await service.saveRecipe(req.domain, req.body)); } catch (error) { sendError(res, error); }
};

exports.updateRecipe = async (req, res) => {
    try { res.status(201).json(await service.saveRecipe(req.domain, req.body, req.params.id)); } catch (error) { sendError(res, error); }
};

exports.recipeCost = async (req, res) => {
    try { res.json(await service.recipeCost(req.domain, req.params.id)); } catch (error) { sendError(res, error); }
};

exports.consumeRecipe = async (req, res) => {
    try { res.status(201).json(await service.consumeRecipe(req.domain, req.params.id, req.body)); } catch (error) { sendError(res, error); }
};
