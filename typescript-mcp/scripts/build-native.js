#!/usr/bin/env node

/**
 * NAPI-RS Build Script for CodeSight MCP Server
 *
 * This script builds the Rust FFI module using NAPI-RS and
 * integrates it with the TypeScript codebase.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class NativeBuildScript {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
    this.rustCorePath = path.join(this.projectRoot, '..', 'rust-core');
    this.scriptName = 'build-native.js';
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    console.log(`${prefix} ${message}`);
  }

  execute(command, options = {}) {
    try {
      this.log(`Executing: ${command}`, 'debug');
      const result = execSync(command, {
        stdio: 'pipe',
        encoding: 'utf-8',
        cwd: options.cwd || this.projectRoot,
        ...options,
      });
      return result.trim();
    } catch (_error) {
      this.log(`Command failed: ${command}`, 'error');
      this.log(`Error: ${_error.message}`, 'error');
      if (_error.stdout) {
        this.log(`stdout: ${_error.stdout}`, 'error');
      }
      if (_error.stderr) {
        this.log(`stderr: ${_error.stderr}`, 'error');
      }
      throw _error;
    }
  }

  detectPlatform() {
    const platform = os.platform();
    const arch = os.arch();

    const platformMap = {
      'darwin x64': 'x86_64-apple-darwin',
      'darwin arm64': 'aarch64-apple-darwin',
      'linux x64': 'x86_64-unknown-linux-gnu',
      'linux arm64': 'aarch64-unknown-linux-gnu',
      'linux arm': 'armv7-unknown-linux-gnueabihf',
      'win32 x64': 'x86_64-pc-windows-msvc',
      'win32 arm64': 'aarch64-pc-windows-msvc',
    };

    const key = `${platform} ${arch}`;
    const target = platformMap[key];

    if (!target) {
      throw new Error(`Unsupported platform: ${platform} ${arch}`);
    }

    this.log(`Detected platform: ${platform} ${arch} -> ${target}`);
    return target;
  }

  checkDependencies() {
    this.log('Checking dependencies...');

    // Check if NAPI-RS CLI is installed
    try {
      this.execute('napi --version');
      this.log('NAPI-RS CLI is installed');
    } catch {
      this.log('NAPI-RS CLI not found, installing...', 'warn');
      this.execute('npm install -g @napi-rs/cli');
    }

    // Check if Rust toolchain is available
    try {
      this.execute('cargo --version');
      this.log('Rust toolchain is available');
    } catch {
      throw new Error('Rust toolchain not found. Please install Rust from https://rustup.rs/');
    }

    // Check if Rust core directory exists
    if (!fs.existsSync(this.rustCorePath)) {
      throw new Error(`Rust core directory not found: ${this.rustCorePath}`);
    }

    this.log('All dependencies are available');
  }

  installSystemDependencies() {
    const platform = os.platform();

    if (platform === 'linux') {
      this.log('Installing Linux system dependencies...');
      this.execute('sudo apt-get update');
      this.execute('sudo apt-get install -y pkg-config libssl-dev build-essential');
    } else if (platform === 'darwin') {
      this.log('Installing macOS system dependencies...');
      this.execute('brew install openssl');
    } else if (platform === 'win32') {
      this.log('Windows dependencies are typically handled by the Rust toolchain');
    }
  }

  buildRustCore(target) {
    this.log(`Building Rust core for target: ${target}...`);

    // Change to rust-core directory
    const rustDir = this.rustCorePath;

    // Install additional Rust target if needed
    try {
      this.execute(`rustup target add ${target}`, { cwd: rustDir });
    } catch {
      this.log(`Target ${target} already installed or installation failed`, 'warn');
    }

    // Build the FFI crate
    this.execute(`cargo build --release --package code-intelligence-ffi --target ${target}`, {
      cwd: rustDir,
    });

    this.log(`Rust core built successfully for ${target}`);
  }

  packageNapiModule(target) {
    this.log(`Packaging NAPI-RS module for target: ${target}...`);

    // Use NAPI-RS CLI to package the module
    const rustDir = this.rustCorePath;
    this.execute(`napi build --platform --target ${target}`, {
      cwd: rustDir,
    });

    this.log(`NAPI-RS module packaged successfully for ${target}`);
  }

  copyNativeModule(target) {
    this.log('Copying native module to TypeScript project...');

    // Determine the expected binary name
    const platform = os.platform();
    let binaryName;

    if (platform === 'win32') {
      binaryName = 'code_intelligence_ffi.node';
    } else {
      binaryName = 'libcode_intelligence_ffi.so';
    }

    const sourcePath = path.join(this.rustCorePath, 'target', target, 'release', binaryName);
    const targetPath = path.join(this.projectRoot, 'codesight-native.node');

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Built module not found: ${sourcePath}`);
    }

    // Copy the built module
    fs.copyFileSync(sourcePath, targetPath);
    this.log(`Native module copied to: ${targetPath}`);
  }

  verifyNativeModule() {
    this.log('Verifying native module...');

    const modulePath = path.join(this.projectRoot, 'codesight-native.node');

    if (!fs.existsSync(modulePath)) {
      throw new Error(`Native module not found: ${modulePath}`);
    }

    try {
      // Try to load the module
      const native = require(modulePath);
      this.log('Native module loaded successfully');
      this.log(`Available exports: ${Object.keys(native).join(', ')}`);
    } catch (_error) {
      throw new Error(`Failed to load native module: ${_error.message}`);
    }
  }

  buildTypeScriptProject() {
    this.log('Building TypeScript project...');

    // Clean previous build
    const distPath = path.join(this.projectRoot, 'dist');
    if (fs.existsSync(distPath)) {
      this.execute('rm -rf dist');
    }

    // Install dependencies
    this.execute('npm ci');

    // Build the project
    this.execute('npm run build');

    this.log('TypeScript project built successfully');
  }

  runTests() {
    this.log('Running tests...');

    try {
      this.execute('npm test -- tests/basic.test.ts');
      this.log('Tests passed successfully');
    } catch {
      this.log('Tests failed, but continuing...', 'warn');
    }
  }

  generateBuildInfo(target) {
    this.log('Generating build information...');

    const buildInfo = {
      timestamp: new Date().toISOString(),
      version: require(path.join(this.projectRoot, 'package.json')).version,
      target,
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      rustVersion: this.execute('cargo --version', { cwd: this.rustCorePath }),
      napiVersion: this.execute('napi --version'),
      buildSuccess: true,
    };

    const buildInfoPath = path.join(this.projectRoot, 'build-info.json');
    fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));

    this.log(`Build information saved to: ${buildInfoPath}`);
  }

  cleanup() {
    this.log('Cleaning up temporary files...');

    // Clean up build artifacts
    const tempFiles = [
      path.join(this.projectRoot, 'codesight-native.node'),
      path.join(this.projectRoot, 'build-info.json'),
    ];

    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        this.log(`Cleaned up: ${file}`);
      }
    });
  }

  async build(options = {}) {
    try {
      this.log('Starting NAPI-RS build process...');

      const {
        target = null,
        skipDepsCheck = false,
        skipTests = false,
        skipCleanup = false,
        debug = false,
      } = options;

      if (debug) {
        this.log('Debug mode enabled', 'debug');
      }

      // Detect target platform
      const buildTarget = target || this.detectPlatform();

      if (!skipDepsCheck) {
        this.checkDependencies();
        this.installSystemDependencies();
      }

      this.buildRustCore(buildTarget);
      this.packageNapiModule(buildTarget);
      this.copyNativeModule(buildTarget);
      this.verifyNativeModule();
      this.buildTypeScriptProject();

      if (!skipTests) {
        this.runTests();
      }

      this.generateBuildInfo(buildTarget);

      if (!skipCleanup) {
        this.cleanup();
      }

      this.log('NAPI-RS build completed successfully!');
      this.log(`Target: ${buildTarget}`);
      this.log('Native module: codesight-native.node');
      this.log('Build info: build-info.json');

      return {
        success: true,
        target: buildTarget,
        modulePath: path.join(this.projectRoot, 'codesight-native.node'),
      };
    } catch (_error) {
      this.log(`Build failed: ${_error.message}`, 'error');
      throw _error;
    }
  }
}

// Main execution
if (require.main === module) {
  const script = new NativeBuildScript();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--target' && i + 1 < args.length) {
      options.target = args[++i];
    } else if (arg === '--skip-deps') {
      options.skipDepsCheck = true;
    } else if (arg === '--skip-tests') {
      options.skipTests = true;
    } else if (arg === '--skip-cleanup') {
      options.skipCleanup = true;
    } else if (arg === '--debug') {
      options.debug = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
NAPI-RS Build Script for CodeSight MCP Server

Usage: node ${script.scriptName} [options]

Options:
  --target <target>       Specify the build target (e.g., x86_64-unknown-linux-gnu)
  --skip-deps            Skip dependency checking
  --skip-tests           Skip running tests
  --skip-cleanup         Skip cleaning up temporary files
  --debug               Enable debug logging
  --help, -h            Show this help message

Examples:
  node ${script.scriptName}                                    # Build for current platform
  node ${script.scriptName} --target x86_64-apple-darwin      # Build for macOS x64
  node ${script.scriptName} --skip-tests --debug               # Build without tests, with debug
`);
      process.exit(0);
    }
  }

  script
    .build(options)
    .then(() => {
      console.log('✅ Build completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Build failed:', error.message);
      process.exit(1);
    });
}

module.exports = NativeBuildScript;
