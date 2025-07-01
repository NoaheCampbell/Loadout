# electron-vite-react

[![awesome-vite](https://awesome.re/mentioned-badge.svg)](https://github.com/vitejs/awesome-vite)
![GitHub stars](https://img.shields.io/github/stars/caoxiemeihao/vite-react-electron?color=fa6470)
![GitHub issues](https://img.shields.io/github/issues/caoxiemeihao/vite-react-electron?color=d8b22d)
![GitHub license](https://img.shields.io/github/license/caoxiemeihao/vite-react-electron)
[![Required Node.JS >= 14.18.0 || >=16.0.0](https://img.shields.io/static/v1?label=node&message=14.18.0%20||%20%3E=16.0.0&logo=node.js&color=3f893e)](https://nodejs.org/about/releases)

English | [简体中文](README.zh-CN.md)

## 👀 Overview

📦 Ready out of the box  
🎯 Based on the official [template-react-ts](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts), project structure will be familiar to you  
🌱 Easily extendable and customizable  
💪 Supports Node.js API in the renderer process  
🔩 Supports C/C++ native addons  
🐞 Debugger configuration included  
🖥 Easy to implement multiple windows  

## 🛫 Quick Setup

```sh
# clone the project
git clone https://github.com/electron-vite/electron-vite-react.git

# enter the project directory
cd electron-vite-react

# install dependency
npm install

# develop
npm run dev
```

## 🐞 Debug

![electron-vite-react-debug.gif](/electron-vite-react-debug.gif)

## 📂 Directory structure

Familiar React application structure, just with `electron` folder on the top :wink:  
*Files in this folder will be separated from your React application and built into `dist-electron`*  

```tree
├── electron                                 Electron-related code
│   ├── main                                 Main-process source code
│   └── preload                              Preload-scripts source code
│
├── release                                  Generated after production build, contains executables
│   └── {version}
│       ├── {os}-{os_arch}                   Contains unpacked application executable
│       └── {app_name}_{version}.{ext}       Installer for the application
│
├── public                                   Static assets
└── src                                      Renderer source code, your React application
```

<!--
## 🚨 Be aware

This template integrates Node.js API to the renderer process by default. If you want to follow **Electron Security Concerns** you might want to disable this feature. You will have to expose needed API by yourself.  

To get started, remove the option as shown below. This will [modify the Vite configuration and disable this feature](https://github.com/electron-vite/vite-plugin-electron-renderer#config-presets-opinionated).

```diff
# vite.config.ts

export default {
  plugins: [
    ...
-   // Use Node.js API in the Renderer-process
-   renderer({
-     nodeIntegration: true,
-   }),
    ...
  ],
}
```
-->

## 🔧 Additional features

1. electron-updater 👉 [see docs](src/components/update/README.md)
1. playwright

## ❔ FAQ

- [C/C++ addons, Node.js modules - Pre-Bundling](https://github.com/electron-vite/vite-plugin-electron-renderer#dependency-pre-bundling)
- [dependencies vs devDependencies](https://github.com/electron-vite/vite-plugin-electron-renderer#dependencies-vs-devdependencies)

# Loadout

🚀 Transform your raw project ideas into complete development blueprints using AI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20|%20Windows%20|%20Linux-lightgrey.svg)

## ✨ What is Loadout?

Loadout is a desktop application that uses LangGraph and OpenAI to transform your project ideas into comprehensive development blueprints. It generates:

- 📋 **Product Requirements Documents (PRD)** - Structured project specifications
- ✅ **Development Checklists** - Phase-based implementation roadmaps  
- 🧠 **Technical Decisions** - Documented assumptions and architecture choices
- 🎨 **UI Components** - Ready-to-use React/Tailwind code with live preview

## 🎯 Key Features

- **AI-Powered Workflow** - Orchestrated by LangGraph for consistent, high-quality outputs
- **Real-time Progress** - Watch as your idea transforms through each generation phase
- **Interactive Preview** - See your generated UI components come to life instantly
- **Export Everything** - Download your complete project blueprint as organized files
- **Local Storage** - All projects saved securely on your machine

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- OpenAI API key with GPT-4 access

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd loadout

# Install dependencies
npm install

# Create environment file
echo "OPENAI_API_KEY=sk-your-api-key-here" > .env.local

# Start the application
npm run dev
```

## 📖 How It Works

1. **Enter Your Idea** - Describe your project in plain English
2. **Watch AI Work** - LangGraph orchestrates multiple AI agents to analyze and plan
3. **Review & Refine** - Browse through generated PRD, checklist, and UI components
4. **Export & Build** - Download everything and start coding with a clear blueprint

## 🏗️ Architecture

Loadout uses a sophisticated LangGraph workflow:

```
Idea → PRD → Checklist → UI Plan → Component Generation → Export
```

Each step is powered by specialized AI agents that build upon previous outputs, ensuring consistency and completeness.

## 📁 Project Storage

Your projects are stored locally at:
- **macOS**: `~/Library/Application Support/Loadout/projects/`
- **Windows**: `%APPDATA%/Loadout/projects/`
- **Linux**: `~/.config/Loadout/projects/`

## 🛠️ Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Verify setup
npm run verify
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

Built with:
- [Electron](https://www.electronjs.org/) - Cross-platform desktop apps
- [React](https://react.dev/) - UI framework
- [LangGraph](https://github.com/langchain-ai/langgraph) - AI workflow orchestration
- [OpenAI](https://openai.com/) - Language models
- [Tailwind CSS](https://tailwindcss.com/) - Styling

---

Made with ❤️ for AI-first developers
