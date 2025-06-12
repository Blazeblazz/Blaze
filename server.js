const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes with more permissive configuration
app.use(cors({
    origin: true, // Allow all origins
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Parse JSON bodies with increased limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Function to read orders from file
function readOrders() {
    try {
        if (fs.existsSync('orders.json')) {
            console.log('Orders file exists');
            const data = fs.readFileSync('orders.json', 'utf8');
            return JSON.parse(data);
        } else {
            console.log('Creating new orders file');
            fs.writeFileSync('orders.json', JSON.stringify([]));
            return [];
        }
    } catch (error) {
        console.error('Error reading orders:', error);
        return [];
    }
}

// Function to write orders to file
function writeOrders(orders) {
    try {
        fs.writeFileSync('orders.json', JSON.stringify(orders, null, 2));
        console.log('Orders written successfully');
        return true;
    } catch (error) {
        console.error('Error writing orders:', error);
        return false;
    }
}

// API endpoint to handle order submission
app.post('/api/orders', (req, res) => {
    console.log('Received order request:', req.body);

    try {
        // Validate required fields
        const { fullName, city, phone, productId, productName, productPrice, productImage } = req.body;
        
        if (!fullName || !city || !phone || !productId || !productName || !productPrice) {
            console.log('Validation error: Missing required fields');
            return res.status(400).json({ 
                success: false, 
                message: 'Tous les champs sont requis' 
            });
        }

        // Validate phone number format (Moroccan format)
        const phoneRegex = /^(?:(?:\+|00)212|0)[5-7]\d{8}$/;
        if (!phoneRegex.test(phone)) {
            console.log('Validation error: Invalid phone number format');
            return res.status(400).json({ 
                success: false, 
                message: 'Numéro de téléphone invalide' 
            });
        }

        // Read existing orders
        const orders = readOrders();

        // Create new order
        const newOrder = {
            id: Date.now().toString(),
            fullName,
            city,
            phone,
            productId,
            productName,
            productPrice,
            productImage,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        console.log('Processing order:', newOrder);

        // Add new order to array
        orders.push(newOrder);

        // Write updated orders back to file
        if (writeOrders(orders)) {
            console.log('Order saved successfully');
            res.json({ 
                success: true, 
                message: 'Commande enregistrée avec succès',
                orderId: newOrder.id
            });
        } else {
            throw new Error('Failed to save order');
        }
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Une erreur est survenue lors du traitement de votre commande' 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Une erreur est survenue sur le serveur' 
    });
});

// Start server with error handling
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Trying to kill the process...`);
        // Try to kill the process using the port
        require('child_process').exec(`netstat -ano | findstr :${PORT}`, (error, stdout) => {
            if (stdout) {
                const pid = stdout.split(' ').filter(Boolean).pop();
                if (pid) {
                    require('child_process').exec(`taskkill /F /PID ${pid}`, (err) => {
                        if (err) {
                            console.error('Failed to kill process:', err);
                            process.exit(1);
                        } else {
                            console.log(`Killed process ${pid} using port ${PORT}`);
                            // Try to start the server again
                            server.listen(PORT, '0.0.0.0');
                        }
                    });
                }
            }
        });
    } else {
        console.error('Server error:', err);
        process.exit(1);
    }
}); 