const mongoose = require('mongoose');
const Product = require('../products/product.model');
const Variation = require('../variations/variations.model');
const {
    InventorySettings,
    Warehouse,
    Supplier,
    InventoryItem,
    StockEntry,
    InventoryLot,
    InventoryMovement,
    Recipe
} = require('./inventory.models');

class InventoryError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = 'InventoryError';
        this.status = status;
    }
}

function toMinor(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) throw new InventoryError('El costo debe ser un número mayor o igual a cero.');
    return Math.round((parsed + Number.EPSILON) * 100);
}

function fromMinor(value) {
    return Number((Number(value || 0) / 100).toFixed(2));
}

function quantity(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new InventoryError('La cantidad debe ser mayor que cero.');
    return Number(parsed.toFixed(3));
}

function objectId(value, label) {
    if (!mongoose.isValidObjectId(value)) throw new InventoryError(`${label} no es válido.`);
    return new mongoose.Types.ObjectId(value);
}

function rangeDate(value, endOfDay = false) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.valueOf())) throw new InventoryError('El rango de fechas no es válido.');
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        parsed.setUTCHours(23, 59, 59, 999);
    }
    return parsed;
}

function planFifoAllocations(lots, requestedQuantity) {
    const requested = quantity(requestedQuantity);
    const available = lots.reduce((sum, lot) => sum + Number(lot.availableQuantity || 0), 0);
    if (available + 1e-9 < requested) {
        throw new InventoryError(`Stock insuficiente. Disponible: ${available}.`, 409);
    }

    let remaining = requested;
    const plan = [];
    for (const lot of lots) {
        if (remaining <= 1e-9) break;
        const take = Number(Math.min(lot.availableQuantity, remaining).toFixed(3));
        plan.push({
            lot,
            quantity: take,
            unitCostMinor: lot.unitCostMinor,
            totalCostMinor: Math.round(take * lot.unitCostMinor)
        });
        remaining = Number((remaining - take).toFixed(3));
    }
    return plan;
}

function incrementStockSafely(delta) {
    const parsedDelta = Number(delta);
    if (!Number.isFinite(parsedDelta)) throw new InventoryError('El ajuste de stock no es válido.');
    return [{
        $set: {
            stock: {
                $add: [
                    { $convert: { input: '$stock', to: 'double', onError: 0, onNull: 0 } },
                    parsedDelta
                ]
            }
        }
    }];
}

async function ensureDefaults(tenantId, session = null) {
    const options = { new: true, upsert: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) };
    const warehouse = await Warehouse.findOneAndUpdate(
        { tenantId, code: 'MAIN' },
        { $setOnInsert: { tenantId, name: 'Principal', code: 'MAIN', isDefault: true, isActive: true } },
        options
    );
    const supplier = await Supplier.findOneAndUpdate(
        { tenantId, isDefault: true },
        { $setOnInsert: { tenantId, name: 'Compra directa', isDefault: true, isActive: true } },
        options
    );
    const settings = await InventorySettings.findOneAndUpdate(
        { tenantId },
        {
            $setOnInsert: { tenantId, mode: 'simple', businessType: 'retail', costingMethod: 'FIFO' },
            $set: { defaultWarehouseId: warehouse._id, defaultSupplierId: supplier._id }
        },
        options
    );
    return { warehouse, supplier, settings };
}

async function resolveInventoryItem(tenantId, line, session = null) {
    if (line.inventoryItemId) {
        const item = await InventoryItem.findOne({ _id: objectId(line.inventoryItemId, 'El artículo'), tenantId }).session(session);
        if (!item) throw new InventoryError('El artículo inventariable no existe.', 404);
        return item;
    }

    let variationId = line.variationId ? objectId(line.variationId, 'La variación') : null;
    let productId = line.productId ? objectId(line.productId, 'El producto') : null;
    if (!variationId && !productId) throw new InventoryError('Cada línea requiere un producto, una variación o un artículo inventariable.');

    let source;
    let key;
    let type;
    if (!variationId && line.variationSku) {
        source = await Variation.findOne({
            tenantId,
            sku: String(line.variationSku),
            ...(productId ? { productId } : {}),
            isTrash: false
        }).session(session);
        if (!source) throw new InventoryError('La variación indicada no existe.', 404);
        variationId = source._id;
        productId = source.productId;
    }
    if (variationId) {
        source = source || await Variation.findOne({ _id: variationId, tenantId, isTrash: false }).session(session);
        key = `variation:${variationId}`;
        type = 'variant';
    } else {
        source = await Product.findOne({ _id: productId, domain: tenantId, 'is_trash.status': false }).session(session);
        key = `product:${productId}`;
        type = line.type || 'product';
    }
    if (!source) throw new InventoryError(type === 'variant' ? 'La variación no existe.' : 'El producto no existe.', 404);

    return InventoryItem.findOneAndUpdate(
        { tenantId, key },
        {
            $setOnInsert: {
                tenantId,
                key,
                type,
                productId: productId || source.productId,
                variationId,
                name: line.name || source.title || source.sku || 'Artículo',
                sku: line.sku || source.sku || '',
                baseUnit: line.unit || 'unit',
                trackInventory: true,
                isActive: true
            }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) }
    );
}

async function updateStockSnapshot(item, delta, session) {
    if (item.variationId) {
        await Promise.all([
            Variation.updateOne(
                { _id: item.variationId, tenantId: item.tenantId },
                incrementStockSafely(delta),
                { session }
            ),
            Product.updateOne(
                { _id: item.productId, domain: item.tenantId },
                incrementStockSafely(delta),
                { session }
            )
        ]);
    } else if (item.productId) {
        await Product.updateOne(
            { _id: item.productId, domain: item.tenantId },
            incrementStockSafely(delta),
            { session }
        );
    }
}

async function updateCostSnapshot(item, session) {
    const firstLot = await InventoryLot.findOne({
        tenantId: item.tenantId,
        inventoryItemId: item._id,
        availableQuantity: { $gt: 0 },
        status: 'open'
    }).sort({ receivedAt: 1, _id: 1 }).session(session);
    const cost = firstLot ? fromMinor(firstLot.unitCostMinor) : null;
    if (item.variationId) {
        await Variation.updateOne({ _id: item.variationId, tenantId: item.tenantId }, { $set: { cost_price: cost } }, { session });
    } else if (item.productId) {
        await Product.updateOne({ _id: item.productId, domain: item.tenantId }, { $set: { cost_price: cost } }, { session });
    }
}

async function createEntryInSession(tenantId, data, session) {
    const defaults = await ensureDefaults(tenantId, session);
    const warehouseId = data.warehouseId ? objectId(data.warehouseId, 'El almacén') : defaults.warehouse._id;
    const supplierId = data.supplierId ? objectId(data.supplierId, 'El proveedor') : defaults.supplier._id;
    const warehouse = await Warehouse.findOne({ _id: warehouseId, tenantId, isActive: true }).session(session);
    const supplier = await Supplier.findOne({ _id: supplierId, tenantId, isActive: true }).session(session);
    if (!warehouse) throw new InventoryError('El almacén no existe o está inactivo.', 404);
    if (!supplier) throw new InventoryError('El proveedor no existe o está inactivo.', 404);
    if (!Array.isArray(data.lines) || data.lines.length === 0) throw new InventoryError('La entrada debe contener al menos una línea.');

    const prepared = [];
    for (const rawLine of data.lines) {
        const item = await resolveInventoryItem(tenantId, rawLine, session);
        const lineQuantity = quantity(rawLine.quantity);
        const unitCostMinor = toMinor(rawLine.unitCost);
        prepared.push({
            item,
            productId: item.productId,
            variationId: item.variationId,
            quantity: lineQuantity,
            unit: rawLine.unit || item.baseUnit,
            unitCostMinor,
            totalCostMinor: Math.round(lineQuantity * unitCostMinor),
            expirationDate: rawLine.expirationDate ? new Date(rawLine.expirationDate) : null
        });
    }

    const entry = new StockEntry({
        tenantId,
        warehouseId,
        supplierId,
        date: data.date ? new Date(data.date) : new Date(),
        reference: data.reference || '',
        notes: data.notes || '',
        status: 'confirmed',
        lines: prepared.map(({ item, ...line }) => ({ inventoryItemId: item._id, ...line })),
        totalCostMinor: prepared.reduce((sum, line) => sum + line.totalCostMinor, 0),
        createdBy: data.createdBy || ''
    });
    await entry.save({ session });

    for (const line of prepared) {
        const [lot] = await InventoryLot.create([{
            tenantId,
            inventoryItemId: line.item._id,
            warehouseId,
            supplierId,
            sourceEntryId: entry._id,
            receivedAt: entry.date,
            expirationDate: line.expirationDate,
            initialQuantity: line.quantity,
            availableQuantity: line.quantity,
            unitCostMinor: line.unitCostMinor,
            status: 'open'
        }], { session });
        await InventoryMovement.create([{
            tenantId,
            inventoryItemId: line.item._id,
            warehouseId,
            type: 'entry',
            direction: 'in',
            quantity: line.quantity,
            totalCostMinor: line.totalCostMinor,
            referenceType: 'inventory-entry',
            referenceId: String(entry._id),
            reason: data.reason || 'Ingreso de mercadería',
            allocations: [{ lotId: lot._id, quantity: line.quantity, unitCostMinor: line.unitCostMinor, totalCostMinor: line.totalCostMinor }],
            createdBy: data.createdBy || ''
        }], { session });
        await updateStockSnapshot(line.item, line.quantity, session);
        await updateCostSnapshot(line.item, session);
    }

    return entry;
}

async function createEntry(tenantId, data, options = {}) {
    if (options.session) return createEntryInSession(tenantId, data, options.session);
    const session = await mongoose.startSession();
    let entry;
    try {
        await session.withTransaction(async () => {
            entry = await createEntryInSession(tenantId, data, session);
        });
        return entry;
    } finally {
        await session.endSession();
    }
}

async function bootstrapExistingStock(tenantId, data) {
    if (!Array.isArray(data.lines) || data.lines.length === 0) {
        throw new InventoryError('La apertura debe contener al menos un producto o variación.');
    }
    const session = await mongoose.startSession();
    let result;
    try {
        await session.withTransaction(async () => {
            const openingLines = [];
            const skipped = [];
            const affectedVariableProducts = new Set();
            for (const rawLine of data.lines) {
                const item = await resolveInventoryItem(tenantId, rawLine, session);
                const hasLots = await InventoryLot.exists({ tenantId, inventoryItemId: item._id }).session(session);
                if (hasLots) {
                    skipped.push({ inventoryItemId: item._id, reason: 'already-managed' });
                    continue;
                }
                const source = item.variationId
                    ? await Variation.findOne({ _id: item.variationId, tenantId }).session(session)
                    : await Product.findOne({ _id: item.productId, domain: tenantId }).session(session);
                const currentStock = Number(source?.stock || 0);
                if (currentStock <= 0) {
                    skipped.push({ inventoryItemId: item._id, reason: 'without-stock' });
                    continue;
                }
                const openingCost = rawLine.unitCost ?? source.cost_price;
                if (openingCost === undefined || openingCost === null || openingCost === '') {
                    throw new InventoryError(`Debes indicar el costo de apertura de ${item.name}.`);
                }
                toMinor(openingCost);
                if (item.variationId) {
                    await Variation.updateOne(
                        { _id: item.variationId, tenantId },
                        { $set: { stock: 0 } },
                        { session }
                    );
                    affectedVariableProducts.add(String(item.productId));
                } else {
                    await Product.updateOne(
                        { _id: item.productId, domain: tenantId },
                        { $set: { stock: 0 } },
                        { session }
                    );
                }
                openingLines.push({
                    inventoryItemId: item._id,
                    quantity: currentStock,
                    unitCost: Number(openingCost),
                    unit: rawLine.unit || item.baseUnit
                });
            }

            for (const productId of affectedVariableProducts) {
                const [remaining] = await Variation.aggregate([
                    { $match: { tenantId, productId: new mongoose.Types.ObjectId(productId), isTrash: false } },
                    { $group: { _id: null, stock: { $sum: '$stock' } } }
                ]).session(session);
                await Product.updateOne(
                    { _id: productId, domain: tenantId },
                    { $set: { stock: remaining?.stock || 0 } },
                    { session }
                );
            }

            const entry = openingLines.length > 0
                ? await createEntryInSession(tenantId, {
                    date: data.date,
                    reference: data.reference || 'APERTURA-FIFO',
                    notes: data.notes || 'Apertura de inventario existente',
                    reason: 'Apertura de inventario existente',
                    lines: openingLines,
                    createdBy: data.createdBy
                }, session)
                : null;
            result = { entry, migratedItems: openingLines.length, skipped };
        });
        return result;
    } finally {
        await session.endSession();
    }
}

async function consumeItemInSession(tenantId, rawLine, context, session) {
    const item = await resolveInventoryItem(tenantId, rawLine, session);
    const requested = quantity(rawLine.quantity);
    const idempotencyKey = rawLine.idempotencyKey || context.idempotencyKey || '';
    if (idempotencyKey) {
        const existing = await InventoryMovement.findOne({ tenantId, idempotencyKey }).session(session);
        if (existing) return existing;
    }
    const warehouseId = context.warehouseId
        ? objectId(context.warehouseId, 'El almacén')
        : (await ensureDefaults(tenantId, session)).warehouse._id;
    const lots = await InventoryLot.find({
        tenantId,
        inventoryItemId: item._id,
        warehouseId,
        availableQuantity: { $gt: 0 },
        status: 'open'
    }).sort({ receivedAt: 1, _id: 1 }).session(session);

    let plan;
    try {
        plan = planFifoAllocations(lots, requested);
    } catch (error) {
        if (error instanceof InventoryError && error.status === 409) {
            error.message = `Stock insuficiente para ${item.name}. ${error.message.split('. ').slice(1).join('. ')}`;
        }
        throw error;
    }
    const allocations = [];
    for (const allocation of plan) {
        const { lot } = allocation;
        const take = allocation.quantity;
        const result = await InventoryLot.updateOne(
            { _id: lot._id, availableQuantity: { $gte: take } },
            {
                $inc: { availableQuantity: -take },
                ...(Math.abs(lot.availableQuantity - take) <= 1e-9 ? { $set: { status: 'depleted' } } : {})
            },
            { session }
        );
        if (result.modifiedCount !== 1) throw new InventoryError('El inventario cambió durante la operación. Intenta nuevamente.', 409);
        allocations.push({ lotId: lot._id, quantity: take, unitCostMinor: allocation.unitCostMinor, totalCostMinor: allocation.totalCostMinor });
    }

    const movement = new InventoryMovement({
        tenantId,
        inventoryItemId: item._id,
        warehouseId,
        type: context.type || 'sale',
        direction: 'out',
        quantity: requested,
        totalCostMinor: allocations.reduce((sum, allocation) => sum + allocation.totalCostMinor, 0),
        totalRevenueMinor: context.unitSalePrice === undefined ? 0 : Math.round(toMinor(context.unitSalePrice) * requested),
        referenceType: context.referenceType || 'manual',
        referenceId: context.referenceId || '',
        idempotencyKey,
        reason: context.reason || '',
        allocations,
        createdBy: context.createdBy || ''
    });
    await movement.save({ session });
    await updateStockSnapshot(item, -requested, session);
    await updateCostSnapshot(item, session);
    return movement;
}

async function consume(tenantId, data) {
    if (!Array.isArray(data.lines) || data.lines.length === 0) throw new InventoryError('La salida debe contener al menos una línea.');
    const session = await mongoose.startSession();
    const movements = [];
    try {
        await session.withTransaction(async () => {
            for (let index = 0; index < data.lines.length; index += 1) {
                const line = data.lines[index];
                movements.push(await consumeItemInSession(tenantId, line, {
                    ...data,
                    unitSalePrice: line.unitSalePrice,
                    idempotencyKey: data.idempotencyKey ? `${data.idempotencyKey}:${index}` : line.idempotencyKey
                }, session));
            }
        });
        return movements;
    } finally {
        await session.endSession();
    }
}

async function reverseMovement(tenantId, movementId, data = {}) {
    const session = await mongoose.startSession();
    let reversal;
    try {
        await session.withTransaction(async () => {
            const movement = await InventoryMovement.findOne({ _id: objectId(movementId, 'El movimiento'), tenantId, direction: 'out' }).session(session);
            if (!movement) throw new InventoryError('El movimiento de salida no existe.', 404);
            const exists = await InventoryMovement.findOne({ tenantId, reversalOf: movement._id }).session(session);
            if (exists) throw new InventoryError('Este movimiento ya fue revertido.', 409);
            for (const allocation of movement.allocations) {
                await InventoryLot.updateOne(
                    { _id: allocation.lotId, tenantId },
                    { $inc: { availableQuantity: allocation.quantity }, $set: { status: 'open' } },
                    { session }
                );
            }
            const item = await InventoryItem.findOne({ _id: movement.inventoryItemId, tenantId }).session(session);
            reversal = new InventoryMovement({
                tenantId,
                inventoryItemId: movement.inventoryItemId,
                warehouseId: movement.warehouseId,
                type: 'return',
                direction: 'in',
                quantity: movement.quantity,
                totalCostMinor: movement.totalCostMinor,
                referenceType: data.referenceType || movement.referenceType,
                referenceId: data.referenceId || movement.referenceId,
                reason: data.reason || 'Reversión de salida',
                allocations: movement.allocations,
                reversalOf: movement._id,
                createdBy: data.createdBy || ''
            });
            await reversal.save({ session });
            await updateStockSnapshot(item, movement.quantity, session);
            await updateCostSnapshot(item, session);
        });
        return reversal;
    } finally {
        await session.endSession();
    }
}

async function getSummary(tenantId, query = {}) {
    await ensureDefaults(tenantId);
    const start = rangeDate(query.from) || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = rangeDate(query.to, true) || new Date();
    if (start > end) throw new InventoryError('La fecha inicial no puede ser posterior a la fecha final.');
    const [valuation] = await InventoryLot.aggregate([
        { $match: { tenantId, availableQuantity: { $gt: 0 }, status: 'open' } },
        { $group: { _id: null, inventoryValueMinor: { $sum: { $multiply: ['$availableQuantity', '$unitCostMinor'] } }, units: { $sum: '$availableQuantity' }, lots: { $sum: 1 } } }
    ]);
    const [profitability] = await InventoryMovement.aggregate([
        { $match: { tenantId, direction: 'out', type: { $in: ['sale', 'recipe-consumption'] }, createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, revenueMinor: { $sum: '$totalRevenueMinor' }, costMinor: { $sum: '$totalCostMinor' } } }
    ]);
    const revenueMinor = profitability?.revenueMinor || 0;
    const costMinor = profitability?.costMinor || 0;
    const profitMinor = revenueMinor - costMinor;
    return {
        period: { from: start, to: end },
        inventoryValue: fromMinor(valuation?.inventoryValueMinor || 0),
        availableUnits: valuation?.units || 0,
        openLots: valuation?.lots || 0,
        netSales: fromMinor(revenueMinor),
        costOfGoodsSold: fromMinor(costMinor),
        grossProfit: fromMinor(profitMinor),
        grossMarginPercentage: revenueMinor > 0 ? Number(((profitMinor / revenueMinor) * 100).toFixed(2)) : 0
    };
}

async function getSettings(tenantId) {
    return (await ensureDefaults(tenantId)).settings;
}

async function updateSettings(tenantId, data) {
    await ensureDefaults(tenantId);
    const allowed = ['mode', 'businessType', 'allowNegativeStock', 'deductStockOn'];
    const update = Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
    return InventorySettings.findOneAndUpdate({ tenantId }, { $set: update }, { new: true });
}

async function listItems(tenantId, query = {}) {
    const filter = { tenantId, isActive: true };
    if (query.type) filter.type = query.type;
    return InventoryItem.find(filter).sort({ name: 1 }).lean();
}

async function createItem(tenantId, data) {
    const allowedTypes = ['ingredient', 'preparation', 'packaging'];
    if (!allowedTypes.includes(data.type)) throw new InventoryError('El tipo de insumo no es válido.');
    if (!data.name?.trim()) throw new InventoryError('El nombre del insumo es requerido.');
    if (!['unit', 'g', 'ml'].includes(data.baseUnit || 'unit')) throw new InventoryError('La unidad base debe ser unit, g o ml.');
    const id = new mongoose.Types.ObjectId();
    return InventoryItem.create({
        _id: id,
        tenantId,
        key: `${data.type}:${id}`,
        type: data.type,
        name: data.name.trim(),
        sku: data.sku || '',
        baseUnit: data.baseUnit || 'unit',
        trackInventory: true,
        isActive: true
    });
}

async function listMovements(tenantId, query = {}) {
    const filter = { tenantId };
    if (query.inventoryItemId) filter.inventoryItemId = objectId(query.inventoryItemId, 'El artículo');
    if (query.type) filter.type = query.type;
    return InventoryMovement.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(query.limit) || 100, 500)).lean();
}

async function listEntries(tenantId, query = {}) {
    return StockEntry.find({ tenantId }).sort({ date: -1 }).limit(Math.min(Number(query.limit) || 100, 500)).lean();
}

async function listWarehouses(tenantId) {
    await ensureDefaults(tenantId);
    return Warehouse.find({ tenantId, isActive: true }).sort({ isDefault: -1, name: 1 }).lean();
}

async function createWarehouse(tenantId, data) {
    if (!data.name?.trim()) throw new InventoryError('El nombre del almacén es requerido.');
    const code = (data.code || data.name).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-');
    return Warehouse.create({ tenantId, name: data.name.trim(), code, address: data.address || '', isActive: true });
}

async function listSuppliers(tenantId) {
    await ensureDefaults(tenantId);
    return Supplier.find({ tenantId, isActive: true }).sort({ isDefault: -1, name: 1 }).lean();
}

async function createSupplier(tenantId, data) {
    if (!data.name?.trim()) throw new InventoryError('El nombre del proveedor es requerido.');
    return Supplier.create({ ...data, tenantId, name: data.name.trim(), isDefault: false, isActive: true });
}

async function listRecipes(tenantId) {
    return Recipe.find({ tenantId, isActive: true }).sort({ updatedAt: -1 }).lean();
}

async function saveRecipe(tenantId, data, recipeId = null) {
    if (!data.productId || !mongoose.isValidObjectId(data.productId)) throw new InventoryError('El producto de la receta es requerido.');
    if (!Array.isArray(data.components) || data.components.length === 0) throw new InventoryError('La receta debe tener al menos un insumo.');
    for (const component of data.components) {
        objectId(component.inventoryItemId, 'El insumo');
        quantity(component.quantity);
    }
    if (recipeId) {
        const current = await Recipe.findOne({ _id: objectId(recipeId, 'La receta'), tenantId });
        if (!current) throw new InventoryError('La receta no existe.', 404);
        current.isActive = false;
        await current.save();
        return Recipe.create({ ...data, tenantId, version: current.version + 1, isActive: true });
    }
    return Recipe.create({ ...data, tenantId, version: 1, isActive: true });
}

async function recipeCost(tenantId, recipeId) {
    const recipe = await Recipe.findOne({ _id: objectId(recipeId, 'La receta'), tenantId, isActive: true }).lean();
    if (!recipe) throw new InventoryError('La receta no existe.', 404);
    let totalMinor = 0;
    const components = [];
    for (const component of recipe.components) {
        const lot = await InventoryLot.findOne({ tenantId, inventoryItemId: component.inventoryItemId, availableQuantity: { $gt: 0 }, status: 'open' }).sort({ receivedAt: 1, _id: 1 }).lean();
        const adjustedQuantity = component.quantity * (1 + (component.wastePercentage || 0) / 100);
        const componentCostMinor = lot ? Math.round(adjustedQuantity * lot.unitCostMinor) : 0;
        totalMinor += componentCostMinor;
        components.push({ inventoryItemId: component.inventoryItemId, quantity: adjustedQuantity, unitCost: lot ? fromMinor(lot.unitCostMinor) : null, totalCost: fromMinor(componentCostMinor) });
    }
    return { recipeId: recipe._id, version: recipe.version, totalCost: fromMinor(totalMinor), components };
}

async function consumeRecipe(tenantId, recipeId, data) {
    const recipe = await Recipe.findOne({ _id: objectId(recipeId, 'La receta'), tenantId, isActive: true }).lean();
    if (!recipe) throw new InventoryError('La receta no existe.', 404);
    const servings = quantity(data.quantity || 1);
    const totalRevenue = Number(data.unitSalePrice || 0) * servings;
    const lines = recipe.components.map((component, index) => {
        const componentQuantity = Number((component.quantity * servings * (1 + (component.wastePercentage || 0) / 100)).toFixed(3));
        return {
            inventoryItemId: component.inventoryItemId,
            quantity: componentQuantity,
            unitSalePrice: index === 0 && componentQuantity > 0 ? totalRevenue / componentQuantity : 0
        };
    });
    return consume(tenantId, {
        ...data,
        type: 'recipe-consumption',
        referenceType: data.referenceType || 'recipe-sale',
        lines
    });
}

module.exports = {
    InventoryError,
    toMinor,
    fromMinor,
    planFifoAllocations,
    incrementStockSafely,
    ensureDefaults,
    createEntry,
    bootstrapExistingStock,
    consume,
    reverseMovement,
    getSummary,
    getSettings,
    updateSettings,
    listMovements,
    listEntries,
    listItems,
    createItem,
    listWarehouses,
    createWarehouse,
    listSuppliers,
    createSupplier,
    listRecipes,
    saveRecipe,
    recipeCost,
    consumeRecipe
};
