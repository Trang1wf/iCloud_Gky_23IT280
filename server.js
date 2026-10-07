const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config();

// Cau hinh Stateless Session luu tren MongoDB Atlas
const sessionConfig = session({
    secret: 'cloud-secret-key-23it280',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.WRITE_URI,
        collectionName: 'sessions'
    })
});

module.exports = sessionConfig;




const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'hbs');

// Kết nối 2 luồng độc lập
const connRead = mongoose.createConnection(process.env.READ_URI);
const connWrite = mongoose.createConnection(process.env.WRITE_URI);

const bookSchema = new mongoose.Schema({
    code: String,
    name: String,
    originalPrice: Number,
    finalPrice: Number
});

const BookRead = connRead.model('Book', bookSchema);
const BookWrite = connWrite.model('Book', bookSchema);

app.get('/', async (req, res) => {
    const books = await BookRead.find().lean();
    res.render('index', { books });
});

app.post('/add', async (req, res) => {
    const { code, name, price } = req.body;

    // Bắt buộc tiền tố 3 số cuối MSSV (280)
    if (!code.startsWith('280')) {
        return res.status(400).send('Mã sản phẩm không hợp lệ! Phải bắt đầu bằng 280.');
    }

    // Tính VAT: Chữ số cuối MSSV là 0 -> VAT = (0 + 6)% = 6%
    const originalPrice = parseFloat(price);
    const vat = 6; 
    const finalPrice = originalPrice + (originalPrice * vat / 100);

    const newBook = new BookWrite({ code, name, originalPrice, finalPrice });
    await newBook.save();
    res.redirect('/');
});

app.listen(process.env.PORT || 3000, () => console.log('Server running on port 3000'));