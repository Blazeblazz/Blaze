const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// File path for orders
const ORDERS_FILE = path.join(__dirname, 'orders.json');

// Initialize orders file if it doesn't exist
async function initializeOrdersFile() {
    try {
        await fs.access(ORDERS_FILE);
        console.log('Orders file exists');
    } catch {
        console.log('Creating new orders file');
        await fs.writeFile(ORDERS_FILE, JSON.stringify([], null, 2));
    }
}

// Read orders from file
async function readOrders() {
    try {
        const data = await fs.readFile(ORDERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading orders:', error);
        return [];
    }
}

// Write orders to file
async function writeOrders(orders) {
    try {
        await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
        console.log('Orders written successfully');
    } catch (error) {
        console.error('Error writing orders:', error);
        throw error;
    }
}

// Validate order data
function validateOrder(order) {
    const errors = [];

    if (!order.fullName || order.fullName.trim().length < 3) {
        errors.push('Le nom complet est requis et doit contenir au moins 3 caractères');
    }

    if (!order.city || order.city.trim().length === 0) {
        errors.push('La ville est requise');
    }

    const phoneRegex = /^(?:(?:\+|00)212|0)[5-7]\d{8}$/;
    if (!order.phone || !phoneRegex.test(order.phone)) {
        errors.push('Le numéro de téléphone doit être au format marocain valide');
    }

    return errors;
}

// API Routes
app.post('/api/orders', async (req, res) => {
    try {
        console.log('Received order request:', req.body);
        const order = req.body;
        
        // Validate order data
        const errors = validateOrder(order);
        if (errors.length > 0) {
            console.log('Validation errors:', errors);
            return res.status(400).json({ 
                success: false, 
                message: 'Validation failed', 
                errors 
            });
        }

        // Add timestamp and status
        const orderWithMetadata = {
            ...order,
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        console.log('Processing order:', orderWithMetadata);

        // Read existing orders
        const orders = await readOrders();
        
        // Add new order
        orders.push(orderWithMetadata);
        
        // Save updated orders
        await writeOrders(orders);

        console.log('Order saved successfully');
        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            orderId: orderWithMetadata.id
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Get all orders (for future admin dashboard)
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await readOrders();
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message
    });
});

// Initialize orders file and start server
initializeOrdersFile().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}).catch(error => {
    console.error('Failed to start server:', error);
}); 