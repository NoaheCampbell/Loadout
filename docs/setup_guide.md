# Loadout Setup Guide

This guide will help you set up the development environment for Loadout.

## Prerequisites

1. **Node.js 18+** and npm
2. **OpenAI API Key** with access to GPT-4

## Setup Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd loadout
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a `.env.local` file in the root directory:

```bash
OPENAI_API_KEY=sk-your-api-key-here
```

### 4. Run the Application

```bash
npm run dev
```

The app will open automatically. If not, navigate to `http://localhost:5173`.

## Verify Installation

Run the verification script:

```bash
npm run verify
```

This will check:
- All dependencies are installed
- Required directories exist
- Environment variables are set
- OpenAI API key is valid

## Troubleshooting

### Missing Dependencies
If packages are missing, run:
```bash
npm install
```

### API Key Issues
- Ensure your OpenAI API key starts with `sk-`
- Verify it has GPT-4 access
- Check for any spaces or quotes in the `.env.local` file

### Build Issues
Clean and rebuild:
```bash
rm -rf node_modules dist dist-electron
npm install
npm run dev
```

## Next Steps

1. Create your first project by entering an idea
2. Watch as Loadout generates a complete development plan
3. Export your project files when ready

Happy building! 🚀 