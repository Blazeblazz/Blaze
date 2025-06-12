const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Serve static files from root directory
app.use(express.static('./'));

// Orders data file path
const ORDERS_FILE = path.join(__dirname, 'orders.json');

// Initialize orders file if it doesn't exist
async function initializeOrdersFile() {
    try {
        await fs.access(ORDERS_FILE);
    } catch {
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
    } catch (error) {
        console.error('Error writing orders:', error);
        throw error;
    }
}

// API Routes
app.post('/api/orders', async (req, res) => {
    try {
        const { fullName, city, phone, address, product, quantity, paymentMethod } = req.body;

        // Validate required fields
        if (!fullName || !city || !phone || !product || !quantity || !paymentMethod) {
            return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
        }

        // Validate phone number format
        if (!/^(05|06|07)[0-9]{8}$/.test(phone)) {
            return res.status(400).json({ error: 'Numéro de téléphone invalide' });
        }

        const orders = await readOrders();
        const newOrder = {
            id: Date.now().toString(),
            fullName,
            city,
            phone,
            address: address || '',
            product,
            quantity,
            paymentMethod,
            status: 'pending',
            timestamp: new Date().toISOString()
        };

        orders.push(newOrder);
        await writeOrders(orders);

        res.status(201).json({ message: 'Commande créée avec succès', order: newOrder });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Erreur lors de la création de la commande' });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const orders = await readOrders();
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
    }
});

app.put('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Statut requis' });
        }

        const orders = await readOrders();
        const orderIndex = orders.findIndex(order => order.id === id);

        if (orderIndex === -1) {
            return res.status(404).json({ error: 'Commande non trouvée' });
        }

        orders[orderIndex].status = status;
        await writeOrders(orders);

        res.json({ message: 'Statut de la commande mis à jour', order: orders[orderIndex] });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour de la commande' });
    }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const orders = await readOrders();
        const filteredOrders = orders.filter(order => order.id !== id);

        if (filteredOrders.length === orders.length) {
            return res.status(404).json({ error: 'Commande non trouvée' });
        }

        await writeOrders(filteredOrders);
        res.json({ message: 'Commande supprimée avec succès' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression de la commande' });
    }
});

// Export orders to CSV
app.get('/api/orders/export/csv', async (req, res) => {
    try {
        const orders = await readOrders();
        const headers = ['ID', 'Nom', 'Ville', 'Téléphone', 'Adresse', 'Produit', 'Quantité', 'Statut', 'Date'];
        
        const csvContent = [
            headers.join(','),
            ...orders.map(order => [
                order.id,
                `"${order.fullName}"`,
                `"${order.city}"`,
                order.phone,
                `"${order.address}"`,
                `"${order.product}"`,
                order.quantity,
                order.status,
                order.timestamp
            ].join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
        res.send(csvContent);
    } catch (error) {
        console.error('Error exporting orders:', error);
        res.status(500).json({ error: 'Erreur lors de l\'exportation des commandes' });
    }
});

// Initialize server
async function startServer() {
    await initializeOrdersFile();
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

startServer(); 