const mongoose = require('mongoose');

// Tắt autoIndex và autoCreate vì user không có quyền tạo index/collection
const opts = { autoIndex: false, autoCreate: false };

const readConn  = mongoose.createConnection(process.env.MONGO_URI_READ, opts);
const writeConn = mongoose.createConnection(process.env.MONGO_URI_WRITE, opts);

readConn.on('connected',  () => console.log('✅ READ connection OK'));
writeConn.on('connected', () => console.log('✅ WRITE connection OK'));
readConn.on('error',  e => console.error('❌ READ error:', e.message));
writeConn.on('error', e => console.error('❌ WRITE error:', e.message));

// Ngăn unhandled rejection làm crash process khi URI sai / DNS lỗi
readConn.asPromise().catch(e => console.error('❌ READ connect failed:', e.message));
writeConn.asPromise().catch(e => console.error('❌ WRITE connect failed:', e.message));

module.exports = { readConn, writeConn };
