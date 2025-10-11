/**
 * API layer for sample test project
 * Express.js routes and middleware examples
 */

import express, { Request, Response, NextFunction } from 'express';
import { User, UserManager, fetchUserData, validateUser } from './utils';

// Express app setup
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Error handling middleware
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
};

// Rate limiting middleware
const rateLimit = (req: Request, res: Response, next: NextFunction) => {
  // Simple rate limiting implementation
  const clientIp = req.ip || 'unknown';
  console.log(`Request from ${clientIp}: ${req.method} ${req.path}`);
  next();
};

// API Routes

// GET /api/users - Get all users
app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const userManager = new UserManager();

    // Add some test users
    userManager.addUser(new User('1', 'John Doe', 'john@example.com'));
    userManager.addUser(new User('2', 'Jane Smith', 'jane@example.com'));

    const users = userManager.getAllUsers();
    res.json({ users, count: users.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/:id - Get user by ID
app.get('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await fetchUserData(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/users - Create new user
app.post('/api/users', rateLimit, async (req: Request, res: Response) => {
  try {
    const userData = req.body;

    // Validate user data
    const isValid = await validateUser(userData);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid user data' });
    }

    const newUser = new User(
      Math.random().toString(36).substr(2, 9),
      userData.name,
      userData.email
    );

    const userManager = new UserManager();
    userManager.addUser(newUser);

    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id - Update user
app.put('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existingUser = await fetchUserData(id);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user logic would go here
    const updatedUser = { ...existingUser, ...updateData };

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id - Delete user
app.delete('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userManager = new UserManager();

    const deleted = userManager.removeUser(id);
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /api/search - Search functionality
app.get('/api/search', async (req: Request, res: Response) => {
  try {
    const { q: query, type = 'users', limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Simple search implementation
    const userManager = new UserManager();
    const allUsers = userManager.getAllUsers();

    const results = allUsers.filter(user =>
      user.name.toLowerCase().includes(query as string) ||
      user.email.toLowerCase().includes(query as string)
    ).slice(0, Number(limit));

    res.json({
      query,
      type,
      results,
      count: results.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// POST /api/batch - Batch operations
app.post('/api/batch', async (req: Request, res: Response) => {
  try {
    const { operations } = req.body;

    if (!Array.isArray(operations)) {
      return res.status(400).json({ error: 'Operations must be an array' });
    }

    const results = [];

    for (const operation of operations) {
      try {
        // Process each operation
        switch (operation.type) {
          case 'create_user':
            const user = await fetchUserData('test-user');
            results.push({ success: true, data: user, operationId: operation.id });
            break;
          default:
            results.push({ success: false, error: 'Unknown operation type', operationId: operation.id });
        }
      } catch (error) {
        results.push({ success: false, error: error.message, operationId: operation.id });
      }
    }

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Batch operation failed' });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Error handling
app.use(errorHandler);

// Start server
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app;