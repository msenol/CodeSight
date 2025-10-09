---
sidebar_position: 2
---

# Installation

This guide will walk you through installing the Code Intelligence MCP Server on your system. We provide multiple installation methods to suit different environments and use cases.

## System Requirements

### Minimum Requirements

- **OS**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **Memory**: 4GB RAM
- **Storage**: 1GB free space
- **Node.js**: Version 18.0 or higher
- **Rust**: Version 1.70 or higher (for building from source)

### Recommended Requirements

- **Memory**: 8GB+ RAM for large codebases
- **Storage**: 5GB+ free space
- **CPU**: Multi-core processor for parallel indexing
- **SSD**: For faster indexing and query performance

## Installation Methods

### Method 1: NPM Package (Recommended)

The easiest way to install is via npm:

```bash
# Install globally
npm install -g code-intelligence-mcp

# Verify installation
code-intel --version
```

### Method 2: Docker Container

For containerized environments:

```bash
# Pull the latest image
docker pull code-intelligence/mcp-server:latest

# Run the container
docker run -d \
  --name code-intel-server \
  -p 3000:3000 \
  -v /path/to/your/code:/workspace \
  code-intelligence/mcp-server:latest
```

### Method 3: Pre-built Binaries

Download platform-specific binaries from our [releases page](https://github.com/your-org/code-intelligence-mcp/releases):

```bash
# Linux/macOS
wget https://github.com/your-org/code-intelligence-mcp/releases/latest/download/code-intel-linux-x64.tar.gz
tar -xzf code-intel-linux-x64.tar.gz
sudo mv code-intel /usr/local/bin/

# Windows (PowerShell)
Invoke-WebRequest -Uri "https://github.com/your-org/code-intelligence-mcp/releases/latest/download/code-intel-windows-x64.zip" -OutFile "code-intel.zip"
Expand-Archive -Path "code-intel.zip" -DestinationPath "C:\Program Files\CodeIntel"
```

### Method 4: Build from Source

For developers who want the latest features:

```bash
# Clone the repository
git clone https://github.com/your-org/code-intelligence-mcp.git
cd code-intelligence-mcp

# Install dependencies
npm install

# Build the Rust core
cd rust-core
cargo build --release
cd ..

# Build the TypeScript layer
npm run build

# Install globally
npm link
```

## Platform-Specific Instructions

### Windows

1. **Install Node.js**:
   - Download from [nodejs.org](https://nodejs.org/)
   - Choose the LTS version
   - Run the installer with default settings

2. **Install Rust** (if building from source):

   ```powershell
   # Install via rustup
   Invoke-WebRequest -Uri "https://win.rustup.rs/" -OutFile "rustup-init.exe"
   .\rustup-init.exe
   ```

3. **Install Code Intelligence MCP**:

   ```powershell
   npm install -g code-intelligence-mcp
   ```

### macOS

1. **Install Homebrew** (if not already installed):

   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install Node.js**:

   ```bash
   brew install node
   ```

3. **Install Rust** (if building from source):

   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

4. **Install Code Intelligence MCP**:

   ```bash
   npm install -g code-intelligence-mcp
   ```

### Linux (Ubuntu/Debian)

1. **Update package manager**:

   ```bash
   sudo apt update
   ```

2. **Install Node.js**:

   ```bash
   # Install Node.js 18.x
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Install Rust** (if building from source):

   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source ~/.cargo/env
   ```

4. **Install Code Intelligence MCP**:

   ```bash
   sudo npm install -g code-intelligence-mcp
   ```

### Linux (CentOS/RHEL/Fedora)

1. **Install Node.js**:

   ```bash
   # CentOS/RHEL
   curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
   sudo yum install -y nodejs
   
   # Fedora
   sudo dnf install nodejs npm
   ```

2. **Install Rust** (if building from source):

   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

3. **Install Code Intelligence MCP**:

   ```bash
   sudo npm install -g code-intelligence-mcp
   ```

## Docker Installation

### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  code-intelligence:
    image: code-intelligence/mcp-server:latest
    ports:
      - "3000:3000"
    volumes:
      - ./workspace:/workspace
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - MAX_WORKERS=4
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Run with:

```bash
docker-compose up -d
```

### Custom Docker Build

To build your own Docker image:

```bash
# Clone the repository
git clone https://github.com/your-org/code-intelligence-mcp.git
cd code-intelligence-mcp

# Build the image
docker build -t my-code-intel .

# Run the container
docker run -d -p 3000:3000 -v /path/to/code:/workspace my-code-intel
```

## Kubernetes Deployment

For production Kubernetes deployments:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: code-intelligence-mcp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: code-intelligence-mcp
  template:
    metadata:
      labels:
        app: code-intelligence-mcp
    spec:
      containers:
      - name: code-intelligence
        image: code-intelligence/mcp-server:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: MAX_WORKERS
          value: "4"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        volumeMounts:
        - name: workspace
          mountPath: /workspace
        - name: data
          mountPath: /app/data
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: code-workspace-pvc
      - name: data
        persistentVolumeClaim:
          claimName: code-data-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: code-intelligence-service
spec:
  selector:
    app: code-intelligence-mcp
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Verification

After installation, verify everything is working:

```bash
# Check version
code-intel --version

# Check health
code-intel health

# Test basic functionality
code-intel init test-project
code-intel index ./test-project
```

Expected output:

```
✅ Code Intelligence MCP Server v1.0.0
✅ Rust core engine: OK
✅ TypeScript MCP layer: OK
✅ Database connection: OK
✅ Search engine: OK
```

## Configuration

After installation, you'll want to configure the server for your environment. See the [Configuration Guide](configuration) for detailed setup instructions.

## Troubleshooting

### Common Issues

**Permission denied errors on Linux/macOS:**

```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
# Or use a Node version manager like nvm
```

**Rust compilation errors:**

```bash
# Update Rust toolchain
rustup update
# Install required targets
rustup target add x86_64-unknown-linux-gnu
```

**Docker permission issues:**

```bash
# Add user to docker group (Linux)
sudo usermod -aG docker $USER
# Log out and back in
```

**Port already in use:**

```bash
# Find process using port 3000
lsof -i :3000
# Kill the process or use a different port
code-intel serve --port 3001
```

### Getting Help

If you encounter issues:

1. Check our [troubleshooting guide](../troubleshooting/common-issues)
2. Search [existing issues](https://github.com/your-org/code-intelligence-mcp/issues)
3. Join our [community discussions](https://github.com/your-org/code-intelligence-mcp/discussions)
4. Create a [new issue](https://github.com/your-org/code-intelligence-mcp/issues/new) with:
   - Your operating system and version
   - Node.js and npm versions
   - Complete error messages
   - Steps to reproduce the issue

## Next Steps

Now that you have the Code Intelligence MCP Server installed:

1. **[Quick Start Guide](quick-start)** - Index your first codebase
2. **[Configuration](configuration)** - Customize server settings
3. **[Integration Guides](../integration/claude-desktop)** - Connect with your tools

---

**Ready to start analyzing code?** Continue to the [Quick Start Guide](quick-start) to index your first project!
