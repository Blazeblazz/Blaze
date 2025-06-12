const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('.')); // Serve static files from current directory

// Validation middleware
const validateOrder = (req, res, next) => {
    const { productId, productName, productPrice, customerName, city, phone } = req.body;
    
    if (!productId || !productName || !productPrice || !customerName || !city || !phone) {
        return res.status(400).json({ 
            success: false, 
            error: 'Veuillez remplir tous les champs obligatoires' 
        });
    }

    // Validate phone number (more flexible format)
    const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
    if (!phoneRegex.test(phone)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Format de numéro de téléphone invalide. Exemple: 0612345678 ou +33612345678' 
        });
    }

    // Validate price
    if (isNaN(productPrice) || Number(productPrice) <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Prix invalide' 
        });
    }

    next();
};

// Read orders from JSON file
async function readOrders() {
    try {
        const data = await fs.readFile('orders.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { orders: [] };
    }
}

// Write orders to JSON file
async function writeOrders(orders) {
    await fs.writeFile('orders.json', JSON.stringify(orders, null, 2));
}

// Handle order submission
app.post('/submit-order', validateOrder, async (req, res) => {
    try {
        const orderData = req.body;
        const orders = await readOrders();
        
        // Add timestamp and order ID
        const order = {
            ...orderData,
            orderId: Date.now().toString(),
            timestamp: new Date().toISOString(),
            status: 'pending'
        };
        
        orders.orders.push(order);
        await writeOrders(orders);
        
        res.json({ 
            success: true, 
            orderId: order.orderId,
            message: 'Order submitted successfully'
        });
    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save order' 
        });
    }
});

// Get all orders
app.get('/orders', async (req, res) => {
    try {
        const orders = await readOrders();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to fetch orders' 
        });
    }
});

// Get single order
app.get('/orders/:orderId', async (req, res) => {
    try {
        const orders = await readOrders();
        const order = orders.orders.find(o => o.orderId === req.params.orderId);
        
        if (!order) {
            return res.status(404).json({ 
                error: 'Order not found' 
            });
        }
        
        res.json(order);
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to fetch order' 
        });
    }
});

// Update order status
app.patch('/orders/:orderId', async (req, res) => {
    try {
        const { status } = req.body;
        if (!status || !['pending', 'completed'].includes(status)) {
            return res.status(400).json({ 
                error: 'Invalid status' 
            });
        }

        const orders = await readOrders();
        const orderIndex = orders.orders.findIndex(o => o.orderId === req.params.orderId);
        
        if (orderIndex === -1) {
            return res.status(404).json({ 
                error: 'Order not found' 
            });
        }
        
        orders.orders[orderIndex].status = status;
        await writeOrders(orders);
        
        res.json({ 
            success: true, 
            message: 'Order status updated' 
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to update order' 
        });
    }
});

// Delete order
app.delete('/orders/:orderId', async (req, res) => {
    try {
        const orders = await readOrders();
        const orderIndex = orders.orders.findIndex(o => o.orderId === req.params.orderId);
        
        if (orderIndex === -1) {
            return res.status(404).json({ 
                error: 'Order not found' 
            });
        }
        
        orders.orders.splice(orderIndex, 1);
        await writeOrders(orders);
        
        res.json({ 
            success: true, 
            message: 'Order deleted successfully' 
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to delete order' 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!' 
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 