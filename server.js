const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500'],
    credentials: true
}));
app.use(express.json());

// mongoose.connect('mongodb://localhost:27017/freshclean', {
//     useNewUrlParser: true,
//     useUnifiedTopology: true
// }).then(() => console.log('Connected to MongoDB'))
//   .catch(err => console.log('MongoDB connection error:', err));
let isConnected = false;
async function connectToDatabase() {
   try{
    await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    isConnected = true;
    console.log('Connected to MongoDB');
   }
    catch(error){
        console.log('MongoDB connection error:', error);
    }
}
app.use(async (req, res, next) => {
    if (!isConnected) {
        await connectToDatabase();
    }
    next();
});

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    password: { type: String, required: true },
    walletBalance: { type: Number, default: 500 },
    createdAt: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    pickupDate: { type: Date, required: true },
    pickupTime: { type: String, required: true },
    serviceType: { type: String, required: true },
    weight: { type: Number, required: true },
    express: { type: Boolean, default: false },
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    status: { type: String, default: 'scheduled' },
    createdAt: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    paymentMethod: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

const JWT_SECRET = 'freshclean-secret-key';

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findOne({ _id: decoded.userId }).select('-password');
        
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        console.log('Auth error:', error);
        res.status(401).json({ message: 'Invalid token' });
    }
};

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, phone, address, password } = req.body;

        if (!name || !email || !phone || !address || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            name,
            email,
            phone,
            address,
            password: hashedPassword,
            walletBalance: 500
        });

        await user.save();

        const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });

        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({
            message: 'Login successful',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/users/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json(user);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/users/profile', authMiddleware, async (req, res) => {
    try {
        const { name, phone, address, password } = req.body;
        const user = await User.findById(req.user._id);

        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (address) user.address = address;
        
        if (password) {
            user.password = await bcrypt.hash(password, 10);
        }

        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({
            message: 'Profile updated successfully',
            user: userResponse
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/users/add-money', authMiddleware, async (req, res) => {
    try {
        const { amount, paymentMethod } = req.body;

        if (!amount || amount < 100 || amount > 10000) {
            return res.status(400).json({ message: 'Amount must be between ₹100 and ₹10,000' });
        }

        const user = await User.findById(req.user._id);
        user.walletBalance += amount;
        await user.save();

        const transaction = new Transaction({
            userId: user._id.toString(),
            type: 'credit',
            amount,
            description: 'Wallet Top-up',
            paymentMethod
        });
        await transaction.save();

        res.json({
            message: 'Money added successfully',
            newBalance: user.walletBalance
        });

    } catch (error) {
        console.error('Add money error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/users/transactions', authMiddleware, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user._id.toString() })
            .sort({ createdAt: -1 })
            .limit(10);
        res.json(transactions);
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/orders', authMiddleware, async (req, res) => {
    try {
        console.log('Booking request received:', req.body);
        
        const {
            name,
            phone,
            address,
            pickupDate,
            pickupTime,
            serviceType,
            weight,
            express,
            totalAmount,
            paymentMethod
        } = req.body;

        if (!name || !phone || !address || !pickupDate || !pickupTime || !serviceType || !weight || !totalAmount || !paymentMethod) {
            console.log('Missing fields:', { name, phone, address, pickupDate, pickupTime, serviceType, weight, totalAmount, paymentMethod });
            return res.status(400).json({ message: 'All fields are required' });
        }

        const user = await User.findById(req.user._id);

        if (paymentMethod === 'wallet') {
            if (user.walletBalance < totalAmount) {
                return res.status(400).json({
                    message: 'Insufficient wallet balance',
                    required: totalAmount,
                    available: user.walletBalance
                });
            }

            user.walletBalance -= totalAmount;
            await user.save();

            const transaction = new Transaction({
                userId: user._id.toString(),
                type: 'debit',
                amount: totalAmount,
                description: 'Laundry Service Payment',
                paymentMethod: 'wallet'
            });
            await transaction.save();
        }

        const order = new Order({
            userId: user._id.toString(),
            name,
            phone,
            address,
            pickupDate: new Date(pickupDate),
            pickupTime,
            serviceType,
            weight,
            express: express || false,
            totalAmount,
            paymentMethod,
            status: 'scheduled'
        });

        await order.save();

        console.log('Order created successfully:', order);

        res.status(201).json({
            message: 'Order created successfully',
            order,
            newBalance: user.walletBalance
        });

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

app.get('/api/orders', authMiddleware, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user._id.toString() })
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'FreshClean API is running' });
});

// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });
module.exports = app;