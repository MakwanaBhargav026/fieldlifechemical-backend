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
    type: String, // will store ImageKit URL
  },
  description: {
    type: String
  }
}, {
  timestamps: true,
  collection: 'product'
});

module.exports = mongoose.model('Product', productSchema, 'product');
