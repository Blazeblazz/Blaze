require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Orders file path
const ORDERS_FILE = path.join(__dirname, 'orders.json');

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Verify email configuration
transporter.verify(function(error, success) {
    if (error) {
        console.error('Email configuration error:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

// Initialize orders file if it doesn't exist
async function initializeOrdersFile() {
    try {
        await fs.access(ORDERS_FILE);
        console.log('Orders file exists');
    } catch {
        console.log('Creating new orders file');
        await fs.writeFile(ORDERS_FILE, JSON.stringify([]));
    }
}

// Read orders
async function readOrders() {
    try {
        const data = await fs.readFile(ORDERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading orders:', error);
        return [];
    }
}

// Write orders
async function writeOrders(orders) {
    try {
        await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
        console.log('Orders written successfully');
    } catch (error) {
        console.error('Error writing orders:', error);
        throw error;
    }
}

// Send email notification
async function sendOrderNotification(order) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.ADMIN_EMAIL) {
        console.error('Email configuration missing:', {
            hasEmailUser: !!process.env.EMAIL_USER,
            hasEmailPass: !!process.env.EMAIL_PASS,
            hasAdminEmail: !!process.env.ADMIN_EMAIL
        });
        return;
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.ADMIN_EMAIL,
        subject: 'Nouvelle Commande - Giveaway',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                    Nouvelle Commande Reçue
                </h2>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
                    <p><strong>ID:</strong> ${order.id}</p>
                    <p><strong>Client:</strong> ${order.name}</p>
                    <p><strong>Téléphone:</strong> ${order.phone}</p>
                    <p><strong>Ville:</strong> ${order.city}</p>
                    <p><strong>Produit:</strong> ${order.productName}</p>
                    <p><strong>Prix:</strong> ${order.productPrice} MAD</p>
                    <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                    <p><strong>Statut:</strong> ${order.status}</p>
                </div>
                <div style="margin-top: 20px; text-align: center;">
                    <a href="http://localhost:3000/admin.html" 
                       style="background-color: #3498db; color: white; padding: 10px 20px; 
                              text-decoration: none; border-radius: 5px;">
                        Voir dans le panneau d'administration
                    </a>
                </div>
            </div>
        `
    };

    try {
        console.log('Attempting to send email to:', process.env.ADMIN_EMAIL);
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.response);
    } catch (error) {
        console.error('Error sending email:', error);
        // Log detailed error information
        if (error.code) {
            console.error('Error code:', error.code);
        }
        if (error.command) {
            console.error('Failed command:', error.command);
        }
        if (error.responseCode) {
            console.error('SMTP response code:', error.responseCode);
        }
        if (error.response) {
            console.error('SMTP response:', error.response);
        }
    }
}

// API Routes
app.post('/api/orders', async (req, res) => {
    try {
        console.log('Received order request:', req.body);
        const { name, phone, city, productId, productName, productPrice, productImage } = req.body;
        
        // Validate required fields
        if (!name || !phone || !city || !productId || !productName || !productPrice) {
            console.log('Missing required fields');
            return res.status(400).json({ 
                error: 'Champs requis manquants',
                details: 'Veuillez remplir tous les champs obligatoires'
            });
        }

        // Validate phone number (Moroccan format)
        const phoneRegex = /^(?:(?:\+|00)212|0)[5-7]\d{8}$/;
        if (!phoneRegex.test(phone)) {
            console.log('Invalid phone number format');
            return res.status(400).json({ 
                error: 'Format de numéro de téléphone invalide',
                details: 'Veuillez entrer un numéro de téléphone marocain valide'
            });
        }

        const orders = await readOrders();
        
        const newOrder = {
            id: Date.now().toString(),
            name,
            phone,
            city,
            productId,
            productName,
            productPrice,
            productImage,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        orders.push(newOrder);
        await writeOrders(orders);
        console.log('Order saved successfully:', newOrder.id);

        // Send email notification
        await sendOrderNotification(newOrder);

        res.status(201).json(newOrder);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la création de la commande',
            details: error.message 
        });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        console.log('Fetching orders...');
        const orders = await readOrders();
        console.log(`Found ${orders.length} orders`);
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ 
            error: 'Erreur lors du chargement des commandes',
            details: error.message 
        });
    }
});

app.patch('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !['pending', 'processing', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({ 
                error: 'Statut invalide',
                details: 'Le statut doit être pending, processing, completed ou cancelled'
            });
        }

        const orders = await readOrders();
        const orderIndex = orders.findIndex(order => order.id === id);

        if (orderIndex === -1) {
            return res.status(404).json({ 
                error: 'Commande non trouvée',
                details: `Aucune commande trouvée avec l'ID ${id}`
            });
        }

        orders[orderIndex].status = status;
        orders[orderIndex].updatedAt = new Date().toISOString();

        await writeOrders(orders);
        console.log(`Order ${id} status updated to ${status}`);

        // Send status update notification
        await sendOrderNotification(orders[orderIndex]);

        res.json(orders[orderIndex]);
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la mise à jour de la commande',
            details: error.message 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Erreur serveur',
        details: err.message
    });
});

// Initialize and start server
initializeOrdersFile().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(error => {
    console.error('Failed to start server:', error);
}); 