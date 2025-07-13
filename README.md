# Firestore Database Integration

This project demonstrates how to connect a web application to Firebase Firestore database.

## Prerequisites

- A Google account
- Basic knowledge of HTML, CSS, and JavaScript

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter a project name (e.g., "my-firestore-demo")
4. Choose whether to enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Firestore Database

1. In your Firebase project console, click on "Firestore Database" in the left sidebar
2. Click "Create database"
3. Choose "Start in test mode" (for development - you can add security rules later)
4. Select a location for your database (choose the closest to your users)
5. Click "Done"

## Step 3: Get Your Firebase Configuration

1. In the Firebase console, click the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon (</>) to add a web app
5. Register your app with a nickname (e.g., "my-web-app")
6. Copy the Firebase configuration object

## Step 4: Update Your Code

Replace the `firebaseConfig` object in your `index.html` file with your actual configuration:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};
```

## Step 5: Test Your Application

1. Open `index.html` in a web browser
2. Try adding a new document using the form
3. Click "Load Documents" to see your data
4. Check the Firebase console to see your data in the Firestore database

## Features Included

- **Add Documents**: Create new documents in the "users" collection
- **Read Documents**: Load and display all documents from the collection
- **Delete Documents**: Remove documents from the database
- **Real-time Updates**: Data is automatically refreshed after operations

## Security Rules

For production, you should set up proper Firestore security rules. Here's a basic example:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Common Issues and Solutions

### 1. "Firebase App named '[DEFAULT]' already exists"
- This happens if you initialize Firebase multiple times
- Solution: Make sure you only call `initializeApp()` once

### 2. "Missing or insufficient permissions"
- This happens when Firestore security rules are too restrictive
- Solution: Check your Firestore rules in the Firebase console

### 3. "Network error"
- This can happen if your API key is incorrect
- Solution: Double-check your Firebase configuration

## Next Steps

- Add authentication to secure your data
- Implement real-time listeners for live updates
- Add data validation and error handling
- Create more complex queries and filters
- Add offline support with Firebase persistence

## Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase JavaScript SDK](https://firebase.google.com/docs/web/setup) 