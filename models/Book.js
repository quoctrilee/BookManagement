const { Schema } = require('mongoose');
const { readConn, writeConn } = require('../config/db');

const bookSchema = new Schema({
  maSP:       { type: String, required: true },
  tenSach:    { type: String, required: true },
  giaGoc:     { type: Number, required: true },
  vat:        { type: Number, required: true },
  giaSauThue: { type: Number, required: true },
  createdAt:  { type: Date, default: Date.now }
});

// BookRead  → dùng kết nối read-only (user_read_21110456)
// BookWrite → dùng kết nối write-only (user_write_21110456)
module.exports = {
  BookRead:  readConn.model('Book', bookSchema, 'books'),
  BookWrite: writeConn.model('Book', bookSchema, 'books')
};
