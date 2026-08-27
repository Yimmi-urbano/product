const mongoose = require('mongoose');

const passthroughSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const productSchema = new mongoose.Schema(
    {
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
        category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
        brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' }
    },
    { strict: false, timestamps: true }
);

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

let connection;

function getConnection() {
    if (!connection) {
        if (!MONGODB_URI) {
            throw new Error('Please define MONGODB_URI in .env');
        }

        connection = mongoose.createConnection(MONGODB_URI, {
            ...(MONGODB_DB_NAME ? { dbName: MONGODB_DB_NAME } : {}),
            maxPoolSize: 20,
            serverSelectionTimeoutMS: 5000
        });
    }

    return connection;
}

function getModel(name, schema, collection) {
    const db = getConnection();
    return db.models[name] || db.model(name, schema, collection);
}

function Product() {
    return getModel('Product', productSchema, 'products');
}

function Vendor() {
    return getModel('Vendor', passthroughSchema, 'vendors');
}

function Category() {
    return getModel('Category', passthroughSchema, 'categories');
}

function Brand() {
    return getModel('Brand', passthroughSchema, 'brands');
}

module.exports = {
    Product,
    Vendor,
    Category,
    Brand,
    getConnection
};
