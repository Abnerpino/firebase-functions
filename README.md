# About the project

Cloud Run Functions (2nd Generation) that run in response to FireBase (FireStore) events for the IPTV Player project.

# IPTV Player Project

Link => https://github.com/Abnerpino/iptv_player

# Getting Started

>**Note 1**: Don't clone the repository; you must create it from the console and copy the functions from the repository to your project.

>**Note 2**: Make sure you have Node.js and npm installed.

## Step 0: Install FireBase CLI

Run the following command in the console.

```bash
npm install -g firebase-tools
```

## Step 1: Login to FireBase

Run the following command in the console.

```bash
firebase login
```

## Step 2: Init the project (JavaScript)

Navigate to your project folder and run the following command in the console.

```bash
firebase init functions
```

## Step 3: Copy the functions

Copy the functions from the repository's index.js file and paste them into your project's index.js file.

## Step 4: Deploy to FireBase (Functions)

Run the following command in the console.

```bash
# using full command
firebase deploy --only functions

# OR using shortcut
npm run deploy
```
