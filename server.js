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
            error: 'Missing required fields' 
        });
    }

    // Validate phone number (Moroccan format)
    const phoneRegex = /^(?:(?:\+|00)212|0)[5-7]\d{8}$/;
    if (!phoneRegex.test(phone)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid phone number format' 
        });
    }

    // Validate price
    if (isNaN(productPrice) || Number(productPrice) <= 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid price' 
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

// Product Management
const productsFile = path.join(__dirname, 'products.json');

// Initialize products.json if it doesn't exist
if (!fs.existsSync(productsFile)) {
    fs.writeFileSync(productsFile, JSON.stringify([]));
}

// Get all products
app.get('/api/products', (req, res) => {
    try {
        const products = JSON.parse(fs.readFileSync(productsFile));
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Error reading products' });
    }
});

// Add new product
app.post('/api/products', (req, res) => {
    try {
        const products = JSON.parse(fs.readFileSync(productsFile));
        const newProduct = {
            id: Date.now().toString(),
            ...req.body,
            createdAt: new Date().toISOString()
        };
        products.push(newProduct);
        fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(500).json({ error: 'Error adding product' });
    }
});

// Update product
app.put('/api/products/:id', (req, res) => {
    try {
        const products = JSON.parse(fs.readFileSync(productsFile));
        const index = products.findIndex(p => p.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Product not found' });
        }
        products[index] = {
            ...products[index],
            ...req.body,
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
        res.json(products[index]);
    } catch (error) {
        res.status(500).json({ error: 'Error updating product' });
    }
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
    try {
        const products = JSON.parse(fs.readFileSync(productsFile));
        const filteredProducts = products.filter(p => p.id !== req.params.id);
        if (filteredProducts.length === products.length) {
            return res.status(404).json({ error: 'Product not found' });
        }
        fs.writeFileSync(productsFile, JSON.stringify(filteredProducts, null, 2));
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting product' });
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