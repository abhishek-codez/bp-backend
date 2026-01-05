const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Feedback = require('../models/feedback'); 
const Order = require('../models/Order');
const { body, validationResult } = require('express-validator');


router.post('/', auth, [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('serviceQuality').optional().isInt({ min: 1, max: 5 }).withMessage('Service quality must be between 1 and 5'),
    body('recommend').optional().isIn(['yes', 'no', 'maybe']).withMessage('Invalid recommendation value')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { orderId, rating, comments, serviceQuality, recommend } = req.body;
        
        let orderDetails = null;
        
        
        if (orderId) {
            const order = await Order.findOne({ 
                _id: orderId, 
                userId: req.user._id 
            });
            
            if (order) {
                const serviceName = order.serviceType === 'dry-clean' ? 'Dry Cleaning' : 'Wash & Fold';
                orderDetails = `Order #${order._id.toString().slice(-6)} - ${serviceName} - ₹${order.totalAmount}`;
            }
        }

        const feedback = new Feedback({
            userId: req.user._id,
            orderId: orderId || null,
            orderDetails: orderDetails || 'General Feedback',
            rating,
            comments: comments || '',
            serviceQuality: serviceQuality || null,
            recommend: recommend || 'yes'
        });

        await feedback.save();

        res.status(201).json({
            message: 'Feedback submitted successfully',
            feedback
        });

    } catch (error) {
        console.error('Submit feedback error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        const feedbacks = await Feedback.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20);

        res.json(feedbacks);
    } catch (error) {
        console.error('Get feedback error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/order/:orderId', auth, async (req, res) => {
    try {
        const feedback = await Feedback.findOne({
            userId: req.user._id,
            orderId: req.params.orderId
        });

        if (!feedback) {
            return res.status(404).json({ message: 'No feedback found for this order' });
        }

        res.json(feedback);
    } catch (error) {
        console.error('Get order feedback error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;