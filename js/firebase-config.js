// Firebase Configuration
// ملاحظة: يجب استبدال هذه القيم بمعلومات مشروع Firebase الخاص بك
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE", // مثال: "AIzaSyB1234567890abcdef"
    authDomain: "YOUR_AUTH_DOMAIN_HERE", // مثال: "your-project.firebaseapp.com"
    databaseURL: "YOUR_DATABASE_URL_HERE", // مثال: "https://your-project-default-rtdb.firebaseio.com"
    projectId: "YOUR_PROJECT_ID_HERE", // مثال: "your-project-id"
    storageBucket: "YOUR_STORAGE_BUCKET_HERE", // مثال: "your-project.appspot.com"
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE", // مثال: "123456789012"
    appId: "YOUR_APP_ID_HERE" // مثال: "1:123456789012:web:abcdef123456"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Database references
const db = {
    settings: database.ref('settings'),
    clinics: database.ref('clinics'),
    queue: database.ref('queue'),
    current: database.ref('current'),
    news: database.ref('news'),
    calls: database.ref('calls'),
    display: database.ref('display')
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { app, database, db };
}