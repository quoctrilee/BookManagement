require('dotenv').config();

// Ngăn unhandled rejection từ MongoStore / mongoose làm crash process
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason?.message || reason);
});

const express  = require('express');
const { engine } = require('express-handlebars');
const { BookRead, BookWrite } = require('./models/Book'); // [database]

const app    = express();
const MSSV   = process.env.MSSV   || '21110456';
const SUFFIX3 = MSSV.slice(-3);               // 3 số cuối MSSV → tiền tố bắt buộc
const VAT     = Number(MSSV.slice(-1)) + 4;   // chữ số cuối + 4 → VAT %

// ─── Trust proxy (cần khi deploy trên Render / Heroku) ───────────────────────
app.set('trust proxy', 1);

// ─── Handlebars với custom helpers ───────────────────────────────────────────
app.engine('hbs', engine({
  extname: '.hbs',
  helpers: {
    // Định dạng số có dấu phẩy hàng nghìn
    formatNumber: (n) => Number(n).toLocaleString('vi-VN'),
    // Định dạng ngày dd/mm/yyyy HH:mm
    formatDate: (d) => {
      if (!d) return '';
      const dt = new Date(d);
      return dt.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
    },
    // Đánh số thứ tự (index + 1)
    addOne: (i) => i + 1,
  }
}));
app.set('view engine', 'hbs');
app.use(express.urlencoded({ extended: true }));

// ─── Health check (cho UptimeRobot hoặc Render) ──────────────────────────────
app.get('/health', (_req, res) => res.send('OK'));

// >>> SESSION ─────────────────────────────────────────────────────────────────
const session    = require('express-session');
const { MongoStore } = require('connect-mongo');

app.use(session({
  secret:            process.env.SESSION_SECRET || 'fallback_secret',
  resave:            false,
  saveUninitialized: false,
  store: new MongoStore({
    client:         require('./config/db').writeConn.getClient(),
    dbName:         process.env.DB_NAME,
    collectionName: 'sessions',
    ttl:            60 * 60,          // Session hết hạn sau 1 giờ
    autoRemove:     'disabled',       // Tắt tạo TTL index (user không có quyền createIndex)
    touchAfter:     3600              // Không ghi lại session mỗi request (giảm writes)
  }),
  cookie: {
    maxAge:   3600000,
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production'
  }
}));

// Middleware tăng bộ đếm lượt truy cập (lưu xuống Atlas)
app.use((req, res, next) => {
  req.session.views = (req.session.views || 0) + 1;
  res.locals.views  = req.session.views;
  next();
});
// <<< SESSION ─────────────────────────────────────────────────────────────────

// ─── GET / – Xem danh sách (kết nối READ)       [database] ──────────────────
app.get('/', async (req, res) => {
  try {
    const books = await BookRead.find().sort({ createdAt: -1 }).lean();
    res.render('home', {
      books,
      totalBooks: books.length,
      error:  req.query.error || null,
      hoTen:  process.env.HO_TEN,
      mssv:   MSSV,
      vat:    VAT,
      suffix: SUFFIX3
    });
  } catch (e) {
    res.status(500).send('Lỗi đọc dữ liệu: ' + e.message);
  }
});

// ─── POST /add – Thêm sách (kết nối WRITE)      [database] ──────────────────
app.post('/add', async (req, res) => {
  try {
    const maSP    = (req.body.maSP    || '').trim();
    const tenSach = (req.body.tenSach || '').trim();
    const giaGoc  = Number(req.body.gia);

    // Validate tiền tố mã sản phẩm
    if (!maSP.startsWith(SUFFIX3)) {
      return res.redirect(
        '/?error=' + encodeURIComponent(`Mã sản phẩm phải bắt đầu bằng "${SUFFIX3}" (3 số cuối MSSV)`)
      );
    }
    // Validate dữ liệu
    if (!tenSach || isNaN(giaGoc) || giaGoc < 0) {
      return res.redirect(
        '/?error=' + encodeURIComponent('Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.')
      );
    }

    // Tính giá sau thuế theo công thức: giaSauThue = giaGoc × (1 + VAT/100)
    const giaSauThue = Math.round(giaGoc * (1 + VAT / 100));

    await BookWrite.create({ maSP, tenSach, giaGoc, vat: VAT, giaSauThue });
    res.redirect('/');
  } catch (e) {
    res.status(500).send('Lỗi ghi dữ liệu: ' + e.message);
  }
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`   MSSV: ${MSSV} | Suffix: ${SUFFIX3} | VAT: ${VAT}%`);
});
