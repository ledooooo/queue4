// Firebase Configuration
// ملاحظة: يجب استبدال هذه القيم بمعلومات مشروع Firebase الخاص بك


// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAU1VRuWIzg_i6zPQdcI2qlpLKe3RCSWbk",
  authDomain: "queue3-1c986.firebaseapp.com",
  databaseURL: "https://queue3-1c986-default-rtdb.firebaseio.com",
  projectId: "queue3-1c986",
  storageBucket: "queue3-1c986.firebasestorage.app",
  messagingSenderId: "607086598036",
  appId: "1:607086598036:web:9da0e4be5db7c62cd82181",
  measurementId: "G-Y02LH633BH"
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
