const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Order = require('../models/Order');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { body, validationResult } = require('express-validator');

router.post('/', auth, [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').matches(/^[0-9]{10}$/).withMessage('Please enter a valid 10-digit phone number'),
    body('address').notEmpty().withMessage('Address is required'),
    body('pickupDate').isISO8601().withMessage('Valid pickup date is required'),
    body('pickupTime').notEmpty().withMessage('Pickup time is required'),
    body('serviceType').isIn(['dry-clean', 'wash-fold']).withMessage('Invalid service type'),
    body('weight').isFloat({ min: 1, max: 20 }).withMessage('Weight must be between 1 and 20 kg'),
    body('totalAmount').isFloat({ min: 0 }).withMessage('Invalid total amount'),
    body('paymentMethod').isIn(['wallet', 'card', 'upi']).withMessage('Invalid payment method')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

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
                userId: user._id,
                type: 'debit',
                amount: totalAmount,
                description: 'Laundry Service Payment',
                paymentMethod: 'wallet'
            });
            await transaction.save();
        }

        const order = new Order({
            userId: user._id,
            name,
            phone,
            address,
            pickupDate,
            pickupTime,
            serviceType,
            weight,
            express: express || false,
            totalAmount,
            paymentMethod,
            status: 'scheduled'
        });

        await order.save();

        res.status(201).json({
            message: 'Order created successfully',
            order,
            newBalance: user.walletBalance
        });

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user._id })
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;