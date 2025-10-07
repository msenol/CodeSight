import { createTestWorkspace } from './helpers';

// Mock codebase scenarios for testing
export const MOCK_CODEBASES = {
  'react-app': {
    files: {
      'src/App.tsx': `
import React, { useState, useEffect } from 'react';
import { fetchUserData, User } from './services/api';
import { validateInput, processData } from './utils/validation';
import Button from './components/Button';
import DataProcessor from './components/DataProcessor';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const userData = await fetchUserData('user123');
      if (validateInput(userData.id)) {
        setUser(userData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadUserData();
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="App">
      <h1>Welcome {user?.name}</h1>
      <Button onClick={handleRefresh}>Refresh</Button>
      <DataProcessor data={user?.data || []} />
    </div>
  );
};

export default App;
      `,
      'src/services/api.ts': `
export interface User {
  id: string;
  name: string;
  email: string;
  data: any[];
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

export async function fetchUserData(userId: string): Promise<User> {
  if (!userId || userId.length < 3) {
    throw new Error('Invalid user ID');
  }

  // Mock API call
  const response = await fetch(\`/api/users/\${userId}\`);
  if (!response.ok) {
    throw new Error('Failed to fetch user data');
  }

  return response.json();
}

export async function updateUserData(userId: string, updates: Partial<User>): Promise<User> {
  const response = await fetch(\`/api/users/\${userId}\`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    throw new Error('Failed to update user data');
  }

  return response.json();
}
      `,
      'src/utils/validation.ts': `
export function validateInput(input: string): boolean {
  return typeof input === 'string' && input.length > 0 && !input.includes(' ');
}

export function processData<T>(data: T[]): T[] {
  return data.filter(item => item !== null && item !== undefined);
}

export function sanitizeString(str: string): string {
  return str.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}
      `,
      'src/components/Button.tsx': `
import React from 'react';

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ onClick, children, disabled, className }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={\`btn \${className || ''}\`}
    >
      {children}
    </button>
  );
};

export default Button;
      `,
      'src/components/DataProcessor.tsx': `
import React, { useState } from 'react';

interface DataProcessorProps {
  data: any[];
}

const DataProcessor: React.FC<DataProcessorProps> = ({ data }) => {
  const [processedData, setProcessedData] = useState(data);

  const processItems = () => {
    const processed = data.map(item => ({
      ...item,
      processed: true,
      timestamp: new Date().toISOString()
    }));
    setProcessedData(processed);
  };

  return (
    <div>
      <h3>Data Processor</h3>
      <button onClick={processItems}>Process Data</button>
      <pre>{JSON.stringify(processedData, null, 2)}</pre>
    </div>
  );
};

export default DataProcessor;
      `,
    },
  },
  'node-api': {
    files: {
      'src/index.ts': `
import express from 'express';
import { createServer } from 'http';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import userRoutes from './routes/users';
import authRoutes from './routes/auth';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';

const app = express();
const server = createServer(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

// Routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);

// Error handling
app.use(errorHandler);

async function startServer() {
  try {
    await connectDatabase();
    const port = process.env.PORT || 3000;

    server.listen(port, () => {
      logger.info(\`Server started on port \${port}\`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
      `,
      'src/routes/users.ts': `
import express from 'express';
import { UserService } from '../services/UserService';
import { validateUserInput } from '../middleware/validation';

const router = express.Router();
const userService = new UserService();

router.get('/', async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', validateUserInput, async (req, res) => {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
      `,
      'src/services/UserService.ts': `
import { Database } from '../config/database';
import { User } from '../types/User';

export class UserService {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async getAllUsers(): Promise<User[]> {
    const query = 'SELECT * FROM users WHERE is_active = true';
    return this.db.query(query);
  }

  async getUserById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
    const users = await this.db.query(query, [id]);
    return users.length > 0 ? users[0] : null;
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const query = \`
      INSERT INTO users (name, email, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      RETURNING *
    \`;

    const [user] = await this.db.query(query, [userData.name, userData.email]);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const fields = Object.keys(updates).map((key, index) => \`\${key} = $\${index + 2}\`).join(', ');
    const values = Object.values(updates);

    const query = \`
      UPDATE users
      SET \${fields}, updated_at = NOW()
      WHERE id = $1 AND is_active = true
      RETURNING *
    \`;

    const users = await this.db.query(query, [id, ...values]);
    return users.length > 0 ? users[0] : null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const query = 'UPDATE users SET is_active = false WHERE id = $1';
    const result = await this.db.query(query, [id]);
    return result.rowCount > 0;
  }
}
      `,
    },
  },
  'python-flask': {
    files: {
      'app.py': `
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
import os
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///app.db')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-string')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)

db = SQLAlchemy(app)
jwt = JWTManager(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
            'is_active': self.is_active
        }

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    completed = db.Column(db.Boolean, default=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'completed': self.completed,
            'user_id': self.user_id,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()

    if not data or not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Missing required fields'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400

    user = User(username=data['username'], email=data['email'])
    user.set_password(data['password'])

    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(identity=user.id)

    return jsonify({
        'access_token': access_token,
        'user': user.to_dict()
    }), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()

    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Missing username or password'}), 400

    user = User.query.filter_by(username=data['username']).first()

    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401

    if not user.is_active:
        return jsonify({'error': 'Account is disabled'}), 401

    access_token = create_access_token(identity=user.id)

    return jsonify({
        'access_token': access_token,
        'user': user.to_dict()
    })

@app.route('/api/tasks', methods=['GET'])
@jwt_required()
def get_tasks():
    user_id = get_jwt_identity()
    tasks = Task.query.filter_by(user_id=user_id).all()
    return jsonify([task.to_dict() for task in tasks])

@app.route('/api/tasks', methods=['POST'])
@jwt_required()
def create_task():
    user_id = get_jwt_identity()
    data = request.get_json()

    if not data or not data.get('title'):
        return jsonify({'error': 'Title is required'}), 400

    task = Task(
        title=data['title'],
        description=data.get('description', ''),
        user_id=user_id
    )

    db.session.add(task)
    db.session.commit()

    return jsonify(task.to_dict()), 201

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
      `,
    },
  },
};

// Mock MCP responses
export const MOCK_MCP_RESPONSES = {
  search_code: {
    'data processing functions': {
      content: [{
        type: 'text',
        text: JSON.stringify({
          results: [
            {
              file: 'src/utils/validation.ts',
              line: 6,
              function: 'processData',
              code: 'export function processData<T>(data: T[]): T[]',
              description: 'Generic function to filter and process array data',
            },
            {
              file: 'src/components/DataProcessor.tsx',
              line: 12,
              function: 'processItems',
              code: 'const processItems = () => {',
              description: 'Component method to process data items',
            },
          ],
        }, null, 2),
      }],
    },
  },
  explain_function: {
    'processData': {
      content: [{
        type: 'text',
        text: JSON.stringify({
          function: 'processData',
          signature: 'processData<T>(data: T[]): T[]',
          description: 'Generic function that filters out null and undefined values from an array',
          parameters: [
            {
              name: 'data',
              type: 'T[]',
              description: 'Array of items to be processed',
            },
          ],
          returns: 'T[] - Filtered array without null/undefined values',
          complexity: 'O(n) - Linear time complexity',
          usage: 'Used in components to clean data before processing',
        }, null, 2),
      }],
    },
  },
  find_references: {
    'validateInput': {
      content: [{
        type: 'text',
        text: JSON.stringify({
          symbol: 'validateInput',
          references: [
            {
              file: 'src/App.tsx',
              line: 15,
              context: 'if (validateInput(userData.id)) {',
            },
            {
              file: 'src/utils/validation.ts',
              line: 2,
              context: 'export function validateInput(input: string): boolean {',
            },
          ],
        }, null, 2),
      }],
    },
  },
};

// Mock tool schemas
export const MOCK_TOOL_SCHEMAS = [
  {
    name: 'search_code',
    description: 'Search for code using natural language queries',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query',
        },
        codebase: {
          type: 'string',
          description: 'Path to the codebase to search',
        },
        language: {
          type: 'string',
          description: 'Programming language filter (optional)',
        },
      },
      required: ['query', 'codebase'],
    },
  },
  {
    name: 'explain_function',
    description: 'Explain what a function does and how it works',
    inputSchema: {
      type: 'object',
      properties: {
        function_name: {
          type: 'string',
          description: 'Name of the function to explain',
        },
        file_path: {
          type: 'string',
          description: 'Path to the file containing the function',
        },
        codebase: {
          type: 'string',
          description: 'Path to the codebase',
        },
      },
      required: ['function_name', 'file_path', 'codebase'],
    },
  },
];

// Create test workspaces
export function createTestWorkspaces() {
  const workspaces: Record<string, string> = {};

  Object.entries(MOCK_CODEBASES).forEach(([name, config]) => {
    workspaces[name] = createTestWorkspace(name, config.files);
  });

  return workspaces;
}