const mongoose = require('mongoose');

const { Schema } = mongoose;

const warehouseSchema = new Schema({
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    address: { type: String, trim: true, default: '' },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });
warehouseSchema.index({ tenantId: 1, code: 1 }, { unique: true });

const supplierSchema = new Schema({
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    documentType: { type: String, trim: true, default: '' },
    documentNumber: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: String, trim: true, default: '' },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });
supplierSchema.index({ tenantId: 1, name: 1 });

const inventorySettingsSchema = new Schema({
    tenantId: { type: String, required: true, unique: true },
    mode: { type: String, enum: ['simple', 'advanced'], default: 'simple' },
    businessType: { type: String, enum: ['retail', 'food'], default: 'retail' },
    costingMethod: { type: String, enum: ['FIFO'], default: 'FIFO' },
    defaultWarehouseId: { type: Schema.Types.ObjectId, ref: 'InventoryWarehouse' },
    defaultSupplierId: { type: Schema.Types.ObjectId, ref: 'InventorySupplier' },
    allowNegativeStock: { type: Boolean, default: false },
    deductStockOn: { type: String, enum: ['confirmed', 'paid', 'completed'], default: 'paid' }
}, { timestamps: true });

const inventoryItemSchema = new Schema({
    tenantId: { type: String, required: true, index: true },
    key: { type: String, required: true },
    type: {
        type: String,
        enum: ['product', 'variant', 'ingredient', 'preparation', 'packaging'],
        required: true
    },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    variationId: { type: Schema.Types.ObjectId, ref: 'Variation', default: null },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, default: '' },
    baseUnit: { type: String, enum: ['unit', 'g', 'ml'], default: 'unit' },
    trackInventory: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });
inventoryItemSchema.index({ tenantId: 1, key: 1 }, { unique: true });

const entryLineSchema = new Schema({
    inventoryItemId: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    variationId: { type: Schema.Types.ObjectId, ref: 'Variation', default: null },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, default: 'unit' },
    unitCostMinor: { type: Number, required: true, min: 0 },
    totalCostMinor: { type: Number, required: true, min: 0 },
    expirationDate: { type: Date, default: null }
}, { _id: false });

const stockEntrySchema = new Schema({
    tenantId: { type: String, required: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'InventoryWarehouse', required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'InventorySupplier', required: true },
    date: { type: Date, required: true, default: Date.now },
    reference: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
    lines: { type: [entryLineSchema], default: [] },
    totalCostMinor: { type: Number, required: true, min: 0, default: 0 },
    createdBy: { type: String, default: '' }
}, { timestamps: true });

const inventoryLotSchema = new Schema({
    tenantId: { type: String, required: true, index: true },
    inventoryItemId: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'InventoryWarehouse', required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'InventorySupplier', required: true },
    sourceEntryId: { type: Schema.Types.ObjectId, ref: 'InventoryStockEntry', required: true },
    receivedAt: { type: Date, required: true },
    expirationDate: { type: Date, default: null },
    initialQuantity: { type: Number, required: true, min: 0 },
    availableQuantity: { type: Number, required: true, min: 0 },
    unitCostMinor: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['open', 'depleted', 'cancelled'], default: 'open' }
}, { timestamps: true });
inventoryLotSchema.index({ tenantId: 1, inventoryItemId: 1, warehouseId: 1, receivedAt: 1, _id: 1 });

const allocationSchema = new Schema({
    lotId: { type: Schema.Types.ObjectId, ref: 'InventoryLot', required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitCostMinor: { type: Number, required: true, min: 0 },
    totalCostMinor: { type: Number, required: true, min: 0 }
}, { _id: false });

const inventoryMovementSchema = new Schema({
    tenantId: { type: String, required: true, index: true },
    inventoryItemId: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'InventoryWarehouse', required: true },
    type: {
        type: String,
        enum: ['entry', 'sale', 'recipe-consumption', 'production', 'adjustment', 'transfer', 'return', 'waste'],
        required: true
    },
    direction: { type: String, enum: ['in', 'out'], required: true },
    quantity: { type: Number, required: true, min: 0 },
    totalCostMinor: { type: Number, required: true, min: 0 },
    totalRevenueMinor: { type: Number, min: 0, default: 0 },
    referenceType: { type: String, trim: true, default: '' },
    referenceId: { type: String, trim: true, default: '' },
    idempotencyKey: { type: String, trim: true, default: '' },
    reason: { type: String, trim: true, default: '' },
    allocations: { type: [allocationSchema], default: [] },
    reversalOf: { type: Schema.Types.ObjectId, ref: 'InventoryMovement', default: null },
    createdBy: { type: String, default: '' }
}, { timestamps: true });
inventoryMovementSchema.index(
    { tenantId: 1, idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string', $gt: '' } } }
);
inventoryMovementSchema.index({ tenantId: 1, inventoryItemId: 1, createdAt: -1 });

const recipeComponentSchema = new Schema({
    inventoryItemId: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    wastePercentage: { type: Number, min: 0, max: 100, default: 0 }
}, { _id: false });

const recipeSchema = new Schema({
    tenantId: { type: String, required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variationId: { type: Schema.Types.ObjectId, ref: 'Variation', default: null },
    name: { type: String, required: true, trim: true },
    outputQuantity: { type: Number, required: true, min: 0, default: 1 },
    outputUnit: { type: String, required: true, default: 'unit' },
    version: { type: Number, required: true, min: 1, default: 1 },
    components: { type: [recipeComponentSchema], default: [] },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });
recipeSchema.index({ tenantId: 1, productId: 1, variationId: 1, version: 1 }, { unique: true });

function model(name, schema, collection) {
    return mongoose.models[name] || mongoose.model(name, schema, collection);
}

module.exports = {
    InventorySettings: model('InventorySettings', inventorySettingsSchema, 'inventory_settings'),
    Warehouse: model('InventoryWarehouse', warehouseSchema, 'inventory_warehouses'),
    Supplier: model('InventorySupplier', supplierSchema, 'inventory_suppliers'),
    InventoryItem: model('InventoryItem', inventoryItemSchema, 'inventory_items'),
    StockEntry: model('InventoryStockEntry', stockEntrySchema, 'inventory_entries'),
    InventoryLot: model('InventoryLot', inventoryLotSchema, 'inventory_lots'),
    InventoryMovement: model('InventoryMovement', inventoryMovementSchema, 'inventory_movements'),
    Recipe: model('InventoryRecipe', recipeSchema, 'inventory_recipes')
};
