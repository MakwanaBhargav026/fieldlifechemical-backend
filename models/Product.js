const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Insecticides', 'Fungicides', 'Weedicides', 'Plant Growth Regulators']
  },
  image: {
    type: String
  },
  description: {
    type: String
  }
}, {
  timestamps: true,
  collection: 'product'  // Specify the exact collection name
});

module.exports = mongoose.model('Product', productSchema, 'product');