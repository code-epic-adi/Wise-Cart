import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCJqY2dVS27CBhZ_YUH7jOnXVQcjxY3Mu4",
  authDomain: "walmart-55b94.firebaseapp.com",
  projectId: "walmart-55b94",
  storageBucket: "walmart-55b94.appspot.com",
  messagingSenderId: "728298019720",
  appId: "1:728298019720:web:a3b79876eb542e01bb383d",
  measurementId: "G-RV7Z1HVMGX"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { app, analytics, db }; 