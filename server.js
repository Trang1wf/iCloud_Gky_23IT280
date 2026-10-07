const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
// Khai báo bằng let để xử lý lỗi tương thích phiên bản
let MongoStore = require('connect-mongo'); 
require('dotenv').config();

// Bản vá lỗi: "MongoStore.create is not a function" khi deploy lên Render
MongoStore = MongoStore.default || MongoStore;

const app = express();
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'hbs');

// ==========================================
// 1. Cấu hình Stateless Session trên MongoDB Atlas
// ==========================================
app.use(session({
    secret: 'cloud-secret-key-23it280',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.WRITE_URI, // Dùng luồng WRITE để lưu session
        collectionName: 'sessions'
    })
}));

// ==========================================
// 2. Kết nối đa luồng (Read & Write độc lập)
// ==========================================
const connRead = mongoose.createConnection(process.env.READ_URI);
const connWrite = mongoose.createConnection(process.env.WRITE_URI);

const bookSchema = new mongoose.Schema({
    code: String,
    name: String,
    originalPrice: Number,
    finalPrice: Number
});

// Gắn Schema vào từng luồng kết nối tương ứng
const BookRead = connRead.model('Book', bookSchema);
const BookWrite = connWrite.model('Book', bookSchema);

// ==========================================
// 3. Logic Routes & Cài đặt bộ lọc cá nhân hóa
// ==========================================

// Route GET: Lấy danh sách (Sử dụng luồng Read)
app.get('/', async (req, res) => {
    try {
        // Tăng biến đếm trong Session lưu trên Cloud
        if (req.session.views) {
            req.session.views++;
        } else {
            req.session.views = 1;
        }

        const books = await BookRead.find().lean();
        
        // Truyền cả mảng sách và số lượt truy cập (views) ra ngoài giao diện
        res.render('index', { 
            books: books, 
            views: req.session.views 
        });
    } catch (error) {
        console.error("Lỗi lấy dữ liệu:", error);
        res.status(500).send("Đã xảy ra lỗi khi tải danh sách sách.");
    }
});

// Route POST: Thêm mới (Sử dụng luồng Write)
app.post('/add', async (req, res) => {
    try {
        const { code, name, price } = req.body;

        // BỘ LỌC DỮ LIỆU: Yêu cầu mã sản phẩm phải bắt đầu bằng 3 số cuối MSSV (280)
        if (!code.startsWith('280')) {
            return res.status(400).send('Mã sản phẩm không hợp lệ! Phải bắt đầu bằng 280.');
        }

        // THUẬT TOÁN TÍNH THUẾ ĐỘNG:
        // Chữ số cuối MSSV của bạn là 0 -> VAT = (0 + 6)% = 6%
        const originalPrice = parseFloat(price);
        const vat = 6; 
        const finalPrice = originalPrice + (originalPrice * vat / 100);

        // Tạo dữ liệu mới và lưu qua luồng Write
        const newBook = new BookWrite({ code, name, originalPrice, finalPrice });
        await newBook.save();
        
        // Trở về trang chủ
        res.redirect('/');
    } catch (error) {
        console.error("Lỗi thêm dữ liệu:", error);
        res.status(500).send("Đã xảy ra lỗi khi thêm sách mới.");
    }
});

// ==========================================
// 4. Khởi động máy chủ
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});