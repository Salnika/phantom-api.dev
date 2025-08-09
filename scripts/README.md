# Documentation Generation Scripts

This directory contains scripts for generating and serving comprehensive documentation for the Phantom API monorepo.

## Overview

The documentation system combines:
- **TypeDoc** for API reference documentation from TypeScript code
- **MkDocs** for comprehensive project documentation with guides and tutorials
- **Custom automation** to integrate both systems seamlessly

## Scripts

### `generate-docs.js`
**Purpose**: Generates complete documentation including API reference and builds the MkDocs site.

**What it does**:
1. ✅ Checks prerequisites (TypeDoc, MkDocs availability)
2. 📝 Generates TypeDoc documentation for `phantom-api` and `phantom-api-backend` packages
3. 📁 Moves generated API docs to `public-doc/docs/api-reference/`
4. ⚙️ Updates MkDocs configuration to include API reference
5. 🏗️ Builds the complete MkDocs site
6. 📊 Provides a detailed generation report

**Usage**:
```bash
yarn docs:generate
```

**Output**:
- `phantom-api/docs/` - TypeDoc documentation for client package
- `phantom-api-backend/docs/` - TypeDoc documentation for backend
- `public-doc/docs/api-reference/` - Integrated API reference
- `public-doc/site/` - Built MkDocs site ready to serve

### `serve-docs.js`
**Purpose**: Serves the generated documentation with helpful information.

**What it does**:
1. ✅ Checks if documentation site exists
2. 🌐 Starts MkDocs development server
3. 📋 Displays helpful information about available documentation
4. 🔧 Provides guidance on regenerating docs if needed

**Usage**:
```bash
yarn docs:serve
```

**Features**:
- Serves documentation at `http://localhost:8000`
- Live reload during development
- Graceful shutdown handling
- Helpful status messages and guidance

## Documentation Structure

After running `yarn docs:generate`, the documentation structure will be:

```
public-doc/
├── docs/
│   ├── index.md                          # Home page
│   ├── api-reference/                    # Generated API docs
│   │   ├── client-package/               # phantom-api TypeDoc
│   │   └── backend-api/                  # phantom-api-backend TypeDoc
│   ├── backend-api.md                    # Backend guide
│   ├── client-package.md                # Client guide
│   ├── monorepo-structure.md            # Structure overview
│   └── ...                              # Other guides
├── mkdocs.yml                           # MkDocs configuration
└── site/                                # Built documentation site
    ├── index.html
    ├── api-reference/
    └── ...
```

## Prerequisites

Before using these scripts, ensure you have:

### Required Tools
- **Node.js** (v16+) with npm/yarn
- **TypeDoc** - `yarn add -D typedoc` (already included in devDependencies)
- **MkDocs** - `pip install mkdocs mkdocs-material`
- **Python** (for MkDocs)

### Package Configuration
Each package should have a `typedoc.json` configuration:

**phantom-api/typedoc.json**:
```json
{
  "entryPoints": ["./src/index.ts", "./src/migration-cli.ts", "./src/seed-cli.ts"],
  "out": "docs/phantom-api",
  "tsconfig": "./tsconfig.json",
  "excludePrivate": true,
  "excludeInternal": true,
  "excludeProtected": true,
  "includeVersion": true
}
```

**phantom-api-backend/typedoc.json**:
```json
{
  "entryPoints": ["./src/**/*.ts"],
  "out": "docs/phantom-api-backend", 
  "tsconfig": "./tsconfig.json",
  "excludePrivate": true,
  "excludeInternal": true,
  "excludeProtected": true,
  "includeVersion": true
}
```

## Quick Start

1. **Install dependencies**:
   ```bash
   # Install MkDocs (if not already installed)
   pip install mkdocs mkdocs-material
   
   # Install Node dependencies
   yarn install
   ```

2. **Generate documentation**:
   ```bash
   yarn docs:generate
   ```

3. **Serve documentation**:
   ```bash
   yarn docs:serve
   ```

4. **Open browser**:
   Navigate to `http://localhost:8000`

## Troubleshooting

### TypeDoc Issues
- **Error**: "typedoc: command not found"
  **Solution**: Ensure TypeDoc is installed: `yarn add -D typedoc`

- **Error**: "Entry point not found"
  **Solution**: Check `typedoc.json` entry points match your source files

### MkDocs Issues
- **Error**: "mkdocs: command not found"
  **Solution**: Install MkDocs: `pip install mkdocs mkdocs-material`

- **Error**: "Config file not found"
  **Solution**: Ensure `public-doc/mkdocs.yml` exists

### Build Issues
- **Warning**: "No TypeDoc documentation generated"
  **Solution**: Check that packages have valid TypeScript files and `typedoc.json`

- **Error**: "MkDocs build failed"
  **Solution**: Check `public-doc/mkdocs.yml` syntax and ensure all referenced files exist

## Integration with CI/CD

To integrate documentation generation in your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Install Python dependencies
  run: pip install mkdocs mkdocs-material

- name: Install Node dependencies  
  run: yarn install

- name: Generate documentation
  run: yarn docs:generate

- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./public-doc/site
```

## Customization

### Adding New Packages
To include additional packages in documentation generation:

1. Add TypeDoc configuration to the package
2. Update `generate-docs.js` packages array
3. Add corresponding move logic in `moveDocsToPublicDoc()`

### Customizing MkDocs
- Edit `public-doc/mkdocs.yml` for theme, navigation, and plugin configuration
- Add custom CSS/JS in `public-doc/docs/` directory
- Modify navigation structure to include new sections

### Extending Scripts
Both scripts export their main functions for reuse:

```javascript
const { generateTypeDocForPackage } = require('./generate-docs.js');
const { serveDocs } = require('./serve-docs.js');
```

## Maintenance

### Regular Tasks
- Review and update `typedoc.json` configurations
- Keep MkDocs and TypeDoc versions updated
- Regenerate documentation after major code changes
- Verify all external links in documentation

### Performance Tips
- Use `excludePrivate: true` in TypeDoc to reduce output size
- Enable MkDocs caching for faster builds
- Consider splitting large documentation into multiple files