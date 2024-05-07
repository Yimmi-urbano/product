const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://data_user:wY1v50t8fX4lMA85@cluster0.entyyeb.mongodb.net/products', { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'Error de conexión a MongoDB:'));
db.once('open', () => {
  console.log('Conectado a la base de datos MongoDB');
});

const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
});

module.exports = {
  Product: mongoose.model('Product', productSchema),
  db,
};
